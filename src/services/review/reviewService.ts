import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../../repositories/dataStore';
import {
  DocumentEntity,
  ExtractedField,
  ExtractionVersion
} from '../../types';
import { validationEngine } from '../validation/validationEngine';

export class ReviewService {
  async correctFields(
    documentId: string,
    reviewerId: string,
    corrections: Array<{ fieldName: string; correctedValue: any }>,
    reason?: string
  ): Promise<{ document: DocumentEntity; version: ExtractionVersion }> {
    const doc = dataStore.documents.get(documentId);
    if (!doc) {
      throw { status: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };
    }

    const currentFields = dataStore.extractionFields.get(documentId) || [];
    const currentLines = dataStore.lineItems.get(documentId) || [];
    const versions = dataStore.extractionVersions.get(documentId) || [];

    const updatedFields: ExtractedField[] = currentFields.map((f) => {
      const match = corrections.find((c) => c.fieldName === f.fieldName);
      if (match) {
        return {
          ...f,
          value: match.correctedValue,
          isHumanCorrected: true,
          originalAiValue: f.originalAiValue ?? f.value,
          isValid: true,
          confidence: 1.0 // Human verified
        };
      }
      return f;
    });

    dataStore.extractionFields.set(documentId, updatedFields);

    // Update document entity top-level attributes if corrected
    for (const c of corrections) {
      if (c.fieldName === 'total_amount') doc.totalAmount = Number(c.correctedValue);
      if (c.fieldName === 'invoice_number' || c.fieldName === 'po_number') doc.referenceNumber = String(c.correctedValue);
      if (c.fieldName === 'supplier_name') doc.supplierName = String(c.correctedValue);
      if (c.fieldName === 'invoice_date') doc.documentDate = String(c.correctedValue);
      if (c.fieldName === 'due_date') doc.dueDate = String(c.correctedValue);
    }

    // Re-run validation on corrected state
    const domainData: Record<string, any> = {};
    for (const uf of updatedFields) {
      domainData[uf.fieldName] = uf.value;
    }
    const newValidation = validationEngine.validate(
      doc.documentType || 'INVOICE',
      updatedFields,
      currentLines,
      domainData
    );
    dataStore.validationResults.set(documentId, newValidation);

    // Create New Immutable Extraction Version
    const nextVersionNumber = versions.length + 1;
    const newVersion: ExtractionVersion = {
      id: uuidv4(),
      documentId,
      versionNumber: nextVersionNumber,
      createdByUserId: reviewerId,
      changeType: 'HUMAN_CORRECTION',
      summary: reason || `Manual reviewer correction applied to ${corrections.length} field(s).`,
      dataSnapshot: {
        fields: updatedFields,
        lineItems: currentLines,
        domainData
      },
      createdAt: new Date().toISOString()
    };

    versions.push(newVersion);
    dataStore.extractionVersions.set(documentId, versions);

    // If all validation errors resolved, update decision
    if (newValidation.ruleFailureCount === 0) {
      doc.decision = 'AUTO_APPROVE';
      doc.decisionReason = 'All validation discrepancies resolved by human correction.';
    }

    doc.updatedAt = new Date().toISOString();
    dataStore.documents.set(documentId, doc);

    // Audit log
    dataStore.auditLogs.push({
      id: uuidv4(),
      userId: reviewerId,
      action: 'EXTRACTION_CORRECTED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: {
        version: nextVersionNumber,
        corrections,
        validationStatus: newValidation.status
      },
      createdAt: new Date().toISOString()
    });

    return { document: doc, version: newVersion };
  }

  async approveDocument(
    documentId: string,
    reviewerId: string,
    reason?: string
  ): Promise<DocumentEntity> {
    const doc = dataStore.documents.get(documentId);
    if (!doc) {
      throw { status: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };
    }

    doc.status = 'APPROVED';
    doc.decision = 'AUTO_APPROVE';
    doc.decisionReason = reason || 'Approved by human reviewer.';
    doc.updatedAt = new Date().toISOString();
    dataStore.documents.set(documentId, doc);

    // Update supplier spend if document is an invoice
    if (doc.supplierId && doc.totalAmount) {
      const supplier = dataStore.suppliers.get(doc.supplierId);
      if (supplier) {
        supplier.totalSpend += doc.totalAmount;
        supplier.documentCount += 1;
        supplier.updatedAt = new Date().toISOString();
        dataStore.suppliers.set(supplier.id, supplier);
      }
    }

    dataStore.auditLogs.push({
      id: uuidv4(),
      userId: reviewerId,
      action: 'DOCUMENT_APPROVED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: { reason },
      createdAt: new Date().toISOString()
    });

    return doc;
  }

  async rejectDocument(
    documentId: string,
    reviewerId: string,
    reason: string
  ): Promise<DocumentEntity> {
    const doc = dataStore.documents.get(documentId);
    if (!doc) {
      throw { status: 404, code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' };
    }

    doc.status = 'REJECTED';
    doc.decision = 'REJECT';
    doc.decisionReason = reason;
    doc.updatedAt = new Date().toISOString();
    dataStore.documents.set(documentId, doc);

    dataStore.auditLogs.push({
      id: uuidv4(),
      userId: reviewerId,
      action: 'DOCUMENT_REJECTED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: { reason },
      createdAt: new Date().toISOString()
    });

    return doc;
  }

  async addComment(
    documentId: string,
    userId: string,
    text: string,
    fieldAnchor?: string
  ) {
    const user = dataStore.users.get(userId);
    const commentsList = dataStore.comments.get(documentId) || [];

    const comment = {
      id: uuidv4(),
      userId,
      userFullName: user?.fullName || 'Reviewer',
      text,
      fieldAnchor,
      createdAt: new Date().toISOString()
    };

    commentsList.push(comment);
    dataStore.comments.set(documentId, commentsList);

    dataStore.auditLogs.push({
      id: uuidv4(),
      userId,
      action: 'COMMENT_ADDED',
      entityType: 'DOCUMENT',
      entityId: documentId,
      metadata: { fieldAnchor, commentId: comment.id },
      createdAt: new Date().toISOString()
    });

    return comment;
  }
}

export const reviewService = new ReviewService();
