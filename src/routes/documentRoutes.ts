import { Router } from 'express';
import {
  addComment,
  approveDocument,
  deleteDocument,
  getDocumentById,
  getDocumentExtraction,
  getExtractionVersions,
  listDocuments,
  rejectDocument,
  reprocessDocument,
  updateExtraction,
  uploadDocument
} from '../controllers/documentController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { uploadMiddleware } from '../middleware/upload';

const router = Router();

// Upload
router.post(
  '/',
  authenticateToken as any,
  uploadMiddleware.single('file'),
  uploadDocument as any
);

// List & Detail
router.get('/', authenticateToken as any, listDocuments as any);
router.get('/:id', authenticateToken as any, getDocumentById as any);
router.delete('/:id', authenticateToken as any, requireRole(['ADMIN']) as any, deleteDocument as any);
router.post('/:id/reprocess', authenticateToken as any, reprocessDocument as any);

// Extraction & Provenance
router.get('/:id/extraction', authenticateToken as any, getDocumentExtraction as any);
router.get('/:id/versions', authenticateToken as any, getExtractionVersions as any);
router.patch('/:id/extraction', authenticateToken as any, requireRole(['ADMIN', 'REVIEWER']) as any, updateExtraction as any);

// Review Decisions
router.post('/:id/approve', authenticateToken as any, requireRole(['ADMIN', 'REVIEWER']) as any, approveDocument as any);
router.post('/:id/reject', authenticateToken as any, requireRole(['ADMIN', 'REVIEWER']) as any, rejectDocument as any);

// Comments
router.post('/:id/comments', authenticateToken as any, addComment as any);

export default router;
