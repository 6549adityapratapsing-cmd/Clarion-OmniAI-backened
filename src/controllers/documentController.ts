import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { jobManager } from '../jobs/queue';
import { AuthenticatedRequest } from '../middleware/auth';
import { computeSha256, validateFileMagicBytes } from '../middleware/upload';
import { dataStore } from '../repositories/dataStore';
import { documentOrchestrator } from '../services/document/documentOrchestrator';
import { duplicateService } from '../services/duplicate/duplicateService';
import { reviewService } from '../services/review/reviewService';
import { DocumentEntity } from '../types';

export const uploadDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({
        success: false,
        error: { code: 'FILE_REQUIRED', message: 'No file uploaded.' }
      });
      return;
    }

    // 1. Verify Magic Bytes
    const isValidBytes = validateFileMagicBytes(file.buffer, file.mimetype);
    if (!isValidBytes) {
      res.status(400).json({
        success: false,
        error: {
          code: 'CORRUPTED_FILE_OR_MIME_MISMATCH',
          message: 'File content does not match reported MIME type.'
        }
      });
      return;
    }

    // 2. Compute SHA-256 Hash
    const docHash = computeSha256(file.buffer);

    // 3. Save to disk safely with UUID name
    const ext = path.extname(file.originalname) || '.pdf';
    const safeFilename = `${uuidv4()}${ext}`;
    const storageDir = path.resolve(__dirname, '../../storage/uploads');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const targetFilePath = path.join(storageDir, safeFilename);
    fs.writeFileSync(targetFilePath, file.buffer);

    // 4. Check for exact duplicate
    const docId = uuidv4();
    const dupCheck = duplicateService.checkDuplicate(docId, docHash);

    const newDoc: DocumentEntity = {
      id: docId,
      userId: req.user?.id || 'anonymous',
      title: req.body.title || file.originalname.replace(/\.[^/.]+$/, ''),
      originalFilename: file.originalname,
      fileSizeBytes: file.size,
      mimeType: file.mimetype,
      storagePath: `storage/uploads/${safeFilename}`,
      documentHash: docHash,
      status: 'QUEUED',
      qualityScore: 'GOOD',
      currency: 'INR',
      pageCount: 1,
      isExactDuplicate: dupCheck.isExactDuplicate,
      duplicateOfId: dupCheck.matchedDocument?.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.documents.set(newDoc.id, newDoc);

    // 5. Enqueue background processing job
    const jobId = await jobManager.addJob(newDoc.id, 'ALL');

    res.status(202).json({
      success: true,
      data: {
        document: newDoc,
        jobId,
        duplicateWarning: dupCheck.isBusinessDuplicate ? dupCheck.reason : null
      },
      message: 'Document uploaded and queued for processing.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'UPLOAD_FAILED', message: err.message }
    });
  }
};

export const listDocuments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { status, type, supplier, search, page = '1', limit = '20' } = req.query;

    let docs = Array.from(dataStore.documents.values());

    if (status) {
      docs = docs.filter((d) => d.status === status);
    }
    if (type) {
      docs = docs.filter((d) => d.documentType === type);
    }
    if (supplier) {
      docs = docs.filter((d) => d.supplierName && d.supplierName.toLowerCase().includes(String(supplier).toLowerCase()));
    }
    if (search) {
      const q = String(search).toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          (d.referenceNumber && d.referenceNumber.toLowerCase().includes(q)) ||
          (d.supplierName && d.supplierName.toLowerCase().includes(q))
      );
    }

    // Sort by latest created
    docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const p = parseInt(page as string, 10) || 1;
    const l = parseInt(limit as string, 10) || 20;
    const startIndex = (p - 1) * l;
    const paginated = docs.slice(startIndex, startIndex + l);

    res.json({
      success: true,
      data: {
        documents: paginated,
        pagination: {
          page: p,
          limit: l,
          total: docs.length,
          totalPages: Math.ceil(docs.length / l)
        }
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_DOCUMENTS_FAILED', message: err.message }
    });
  }
};

export const getDocumentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const doc = dataStore.documents.get(id);

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
      });
      return;
    }

    const fields = dataStore.extractionFields.get(id) || [];
    const lineItems = dataStore.lineItems.get(id) || [];
    const validationResult = dataStore.validationResults.get(id) || null;
    const versions = dataStore.extractionVersions.get(id) || [];
    const comments = dataStore.comments.get(id) || [];

    res.json({
      success: true,
      data: {
        document: doc,
        fields,
        lineItems,
        validationResult,
        versions,
        comments
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_DOCUMENT_FAILED', message: err.message }
    });
  }
};

export const getDocumentExtraction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const fields = dataStore.extractionFields.get(id) || [];
    const lineItems = dataStore.lineItems.get(id) || [];

    res.json({
      success: true,
      data: {
        fields,
        lineItems
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_EXTRACTION_FAILED', message: err.message }
    });
  }
};

export const getExtractionVersions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const versions = dataStore.extractionVersions.get(id) || [];

    res.json({
      success: true,
      data: { versions }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_VERSIONS_FAILED', message: err.message }
    });
  }
};

export const updateExtraction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { fieldUpdates, reason } = req.body;

    if (!Array.isArray(fieldUpdates) || fieldUpdates.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_UPDATES', message: 'Array of fieldUpdates is required.' }
      });
      return;
    }

    const reviewerId = req.user?.id || 'reviewer-1';
    const result = await reviewService.correctFields(id, reviewerId, fieldUpdates, reason);

    res.json({
      success: true,
      data: result,
      message: 'Extraction corrected and revalidated successfully.'
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'CORRECTION_FAILED', message: err.message }
    });
  }
};

export const approveDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;
    const reviewerId = req.user?.id || 'reviewer-1';

    const doc = await reviewService.approveDocument(id, reviewerId, reason);

    res.json({
      success: true,
      data: { document: doc },
      message: 'Document approved.'
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'APPROVAL_FAILED', message: err.message }
    });
  }
};

export const rejectDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({
        success: false,
        error: { code: 'REASON_REQUIRED', message: 'Rejection reason is required.' }
      });
      return;
    }

    const reviewerId = req.user?.id || 'reviewer-1';
    const doc = await reviewService.rejectDocument(id, reviewerId, reason);

    res.json({
      success: true,
      data: { document: doc },
      message: 'Document rejected.'
    });
  } catch (err: any) {
    res.status(err.status || 500).json({
      success: false,
      error: { code: err.code || 'REJECTION_FAILED', message: err.message }
    });
  }
};

export const addComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { text, fieldAnchor } = req.body;

    if (!text) {
      res.status(400).json({
        success: false,
        error: { code: 'TEXT_REQUIRED', message: 'Comment text is required.' }
      });
      return;
    }

    const userId = req.user?.id || 'reviewer-1';
    const comment = await reviewService.addComment(id, userId, text, fieldAnchor);

    res.status(201).json({
      success: true,
      data: { comment },
      message: 'Comment added.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'COMMENT_FAILED', message: err.message }
    });
  }
};

export const reprocessDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const doc = dataStore.documents.get(id);

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
      });
      return;
    }

    // Direct reprocess or background job
    await documentOrchestrator.processDocument(id);

    res.json({
      success: true,
      data: { document: dataStore.documents.get(id) },
      message: 'Document reprocessed successfully.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'REPROCESS_FAILED', message: err.message }
    });
  }
};

export const deleteDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const doc = dataStore.documents.get(id);

    if (!doc) {
      res.status(404).json({
        success: false,
        error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found.' }
      });
      return;
    }

    dataStore.documents.delete(id);
    dataStore.extractionFields.delete(id);
    dataStore.lineItems.delete(id);
    dataStore.validationResults.delete(id);
    dataStore.extractionVersions.delete(id);
    dataStore.comments.delete(id);

    res.json({
      success: true,
      message: 'Document deleted successfully.'
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message: err.message }
    });
  }
};
