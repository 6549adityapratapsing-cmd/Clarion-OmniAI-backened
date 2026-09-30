import { v4 as uuidv4 } from 'uuid';
import { getAIProvider } from '../../providers/ai';
import { getOCRProvider } from '../../providers/ocr';
import { dataStore } from '../../repositories/dataStore';
import {
  DocumentEntity,
  DocumentStatus,
  ExtractionVersion,
  Insight,
  NotificationItem
} from '../../types';
import { decisionEngine } from '../decision/decisionEngine';
import { duplicateService } from '../duplicate/duplicateService';
import { poMatchingService } from '../poMatching/poMatchingService';
import { validationEngine } from '../validation/validationEngine';

export class DocumentOrchestrator {
  private ocrProvider = getOCRProvider();
  private aiProvider = getAIProvider();

  async processDocument(documentId: string): Promise<DocumentEntity> {
    const doc = dataStore.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found.`);
    }

    try {
      // 1. Transition state to PROCESSING
      doc.status = 'PROCESSING';
      doc.updatedAt = new Date().toISOString();
      dataStore.documents.set(doc.id, doc);

      // 2. OCR Stage
      const ocrResult = await this.ocrProvider.process(
        Buffer.from(''), // Mock / Stream
        doc.mimeType,
        doc.originalFilename
      );

      doc.status = 'OCR_COMPLETED';
      doc.qualityScore = ocrResult.qualityScore;
      doc.pageCount = ocrResult.pages;

      // 3. Classification Stage
      const classification = await this.aiProvider.classify(ocrResult, doc.originalFilename);
      doc.documentType = classification.documentType;
      doc.classificationConfidence = classification.confidence;
      doc.status = 'CLASSIFIED';

      // 4. Extraction Stage
      const extraction = await this.aiProvider.extract(
        ocrResult,
        classification.documentType,
        doc.originalFilename
      );

      doc.overallConfidence = extraction.overallConfidence;
      doc.supplierName = extraction.domainData?.supplierName || extraction.domainData?.merchantName;
      doc.referenceNumber =
        extraction.domainData?.invoiceNumber ||
        extraction.domainData?.poNumber ||
        extraction.domainData?.receiptNumber;
      doc.documentDate = extraction.domainData?.invoiceDate || extraction.domainData?.poDate;
      doc.dueDate = extraction.domainData?.dueDate;
      doc.totalAmount = extraction.domainData?.totalAmount || 0;
      doc.status = 'EXTRACTED';

      // Link Supplier if exists
      if (doc.supplierName) {
        for (const sup of dataStore.suppliers.values()) {
          if (sup.name.toLowerCase().includes(doc.supplierName.toLowerCase())) {
            doc.supplierId = sup.id;
            break;
          }
        }
      }

      // Save Extracted Fields and Line Items in DataStore
      dataStore.extractionFields.set(doc.id, extraction.fields);
      dataStore.lineItems.set(doc.id, extraction.lineItems);

      // 5. Deterministic Validation Stage
      const validationResult = validationEngine.validate(
        doc.documentType,
        extraction.fields,
        extraction.lineItems,
        extraction.domainData
      );
      dataStore.validationResults.set(doc.id, validationResult);
      doc.status = 'VALIDATED';

      // 6. Duplicate Detection
      const duplicateResult = duplicateService.checkDuplicate(
        doc.id,
        doc.documentHash,
        doc.supplierName,
        doc.referenceNumber,
        doc.documentDate,
        doc.totalAmount
      );

      if (duplicateResult.isExactDuplicate) {
        doc.isExactDuplicate = true;
        doc.duplicateOfId = duplicateResult.matchedDocument?.id;
      }

      // 7. Purchase Order Cross-Matching
      const poRef = extraction.domainData?.poReferenceNumber;
      const poMatch = poMatchingService.matchPurchaseOrder(doc, poRef, extraction.lineItems);

      // 8. 3-Layer Decision Triad
      const decisionResult = decisionEngine.evaluateDecision(
        extraction.overallConfidence,
        validationResult,
        duplicateResult,
        poMatch
      );

      doc.decision = decisionResult.decision;
      doc.decisionReason = decisionResult.reason;

      if (decisionResult.decision === 'AUTO_APPROVE') {
        doc.status = 'APPROVED';
      } else if (decisionResult.decision === 'REJECT') {
        doc.status = 'REJECTED';
      } else {
        doc.status = 'REVIEW_REQUIRED';
      }

      doc.updatedAt = new Date().toISOString();

      // 9. Create Version 1 (AI Initial Extraction Snapshot)
      const version1: ExtractionVersion = {
        id: uuidv4(),
        documentId: doc.id,
        versionNumber: 1,
        changeType: 'AI_INITIAL',
        summary: `Initial automated extraction via ${extraction.provider} (${extraction.model})`,
        dataSnapshot: {
          fields: extraction.fields,
          lineItems: extraction.lineItems,
          domainData: extraction.domainData
        },
        createdAt: new Date().toISOString()
      };
      dataStore.extractionVersions.set(doc.id, [version1]);

      // 10. Generate Document Chunks for Hybrid Search & Grounded Assistant
      const chunkText = `Document: ${doc.title} (${doc.documentType}) | Reference: ${doc.referenceNumber || 'N/A'} | Supplier: ${doc.supplierName || 'N/A'} | Date: ${doc.documentDate || 'N/A'} | Total Amount: INR ${doc.totalAmount || 0} | Status: ${doc.status} | Extracted Text: ${ocrResult.text}`;
      const embedding = await this.aiProvider.generateEmbedding(chunkText);
      dataStore.documentChunks.push({
        id: uuidv4(),
        documentId: doc.id,
        pageNumber: 1,
        chunkIndex: 0,
        content: chunkText,
        embedding,
        metadata: {
          title: doc.title,
          supplierName: doc.supplierName,
          referenceNumber: doc.referenceNumber,
          totalAmount: doc.totalAmount
        }
      });

      // 11. Create Actionable Insights if anomalies found
      if (duplicateResult.isBusinessDuplicate) {
        const dupInsight: Insight = {
          id: uuidv4(),
          documentId: doc.id,
          supplierId: doc.supplierId,
          insightType: 'POTENTIAL_DUPLICATE',
          severity: 'HIGH',
          title: `Duplicate Invoice Alert: ${doc.referenceNumber || doc.title}`,
          explanation: duplicateResult.reason || 'Identical supplier and invoice number found in another document.',
          evidence: {
            currentDocId: doc.id,
            matchedDocId: duplicateResult.matchedDocument?.id,
            supplier: doc.supplierName,
            invoiceNumber: doc.referenceNumber
          },
          isDismissed: false,
          createdAt: new Date().toISOString()
        };
        dataStore.insights.set(dupInsight.id, dupInsight);
      }

      if (poMatch && poMatch.discrepancies.length > 0) {
        const poInsight: Insight = {
          id: uuidv4(),
          documentId: doc.id,
          supplierId: doc.supplierId,
          insightType: 'PO_MISMATCH',
          severity: 'HIGH',
          title: `PO Discrepancy on ${doc.referenceNumber}: +₹${(poMatch.varianceAmount || 0).toLocaleString('en-IN')}`,
          explanation: poMatch.discrepancies.join(' | '),
          evidence: {
            invoiceDocId: doc.id,
            poDocId: poMatch.targetDocumentId,
            variance: poMatch.varianceAmount,
            discrepancies: poMatch.discrepancies
          },
          isDismissed: false,
          createdAt: new Date().toISOString()
        };
        dataStore.insights.set(poInsight.id, poInsight);
      }

      if (validationResult.ruleFailureCount > 0) {
        const valInsight: Insight = {
          id: uuidv4(),
          documentId: doc.id,
          supplierId: doc.supplierId,
          insightType: 'TAX_ANOMALY',
          severity: 'CRITICAL',
          title: `Validation Failure: ${doc.referenceNumber || doc.title}`,
          explanation: validationResult.issues[0]?.message || 'Deterministic mathematical mismatch flagged.',
          evidence: { issues: validationResult.issues },
          isDismissed: false,
          createdAt: new Date().toISOString()
        };
        dataStore.insights.set(valInsight.id, valInsight);
      }

      // 12. Send in-app notification
      const notification: NotificationItem = {
        id: uuidv4(),
        userId: doc.userId,
        documentId: doc.id,
        title: `Document Processed: ${doc.title}`,
        message:
          doc.status === 'APPROVED'
            ? `Document auto-approved with ${Math.round(doc.overallConfidence * 100)}% confidence.`
            : `Review required: ${doc.decisionReason}`,
        type: doc.status === 'APPROVED' ? 'DOCUMENT_PROCESSING_COMPLETED' : 'REVIEW_REQUIRED',
        isRead: false,
        createdAt: new Date().toISOString()
      };
      dataStore.notifications.set(notification.id, notification);

      // Audit log
      dataStore.auditLogs.push({
        id: uuidv4(),
        userId: doc.userId,
        action: 'DOCUMENT_PROCESSED',
        entityType: 'DOCUMENT',
        entityId: doc.id,
        metadata: {
          decision: doc.decision,
          status: doc.status,
          confidence: doc.overallConfidence
        },
        createdAt: new Date().toISOString()
      });

      return doc;
    } catch (err: any) {
      console.error(`Processing error for document ${documentId}:`, err);
      doc.status = 'PROCESSING_FAILED';
      doc.decision = 'REJECT';
      doc.decisionReason = `Processing error: ${err.message || 'Internal pipeline fault.'}`;
      doc.updatedAt = new Date().toISOString();
      dataStore.documents.set(doc.id, doc);
      throw err;
    }
  }
}

export const documentOrchestrator = new DocumentOrchestrator();
