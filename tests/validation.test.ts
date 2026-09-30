import { duplicateService } from '../src/services/duplicate/duplicateService';
import { poMatchingService } from '../src/services/poMatching/poMatchingService';
import { validationEngine } from '../src/services/validation/validationEngine';
import { DocumentEntity, ExtractedField, LineItem } from '../src/types';

describe('Deterministic Validation Engine & Cross-Document Matching', () => {
  it('should pass validation on a mathematically consistent invoice', () => {
    const fields: ExtractedField[] = [
      { fieldName: 'invoice_number', value: 'INV-100', confidence: 0.99, pageNumber: 1, isValid: true },
      { fieldName: 'supplier_name', value: 'Acme Corp', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'invoice_date', value: '2026-09-01', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'subtotal', value: 10000, confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'tax_amount', value: 1800, confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'discount_amount', value: 0, confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'total_amount', value: 11800, confidence: 0.99, pageNumber: 1, isValid: true },
      { fieldName: 'supplier_gstin', value: '27AABCA1234A1Z5', confidence: 0.98, pageNumber: 1, isValid: true }
    ];

    const result = validationEngine.validate('INVOICE', fields);
    expect(result.status).toBe('PASS');
    expect(result.ruleFailureCount).toBe(0);
  });

  it('should flag CRITICAL error when subtotal + tax does not equal total amount', () => {
    const fields: ExtractedField[] = [
      { fieldName: 'invoice_number', value: 'INV-101', confidence: 0.99, pageNumber: 1, isValid: true },
      { fieldName: 'supplier_name', value: 'Acme Corp', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'invoice_date', value: '2026-09-01', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'subtotal', value: 10000, confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'tax_amount', value: 1800, confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'total_amount', value: 15000, confidence: 0.99, pageNumber: 1, isValid: true } // Mismatch!
    ];

    const result = validationEngine.validate('INVOICE', fields);
    expect(result.status).toBe('FAIL');
    expect(result.issues.some((i) => i.issueCode === 'MATH_MISMATCH')).toBe(true);
  });

  it('should flag HIGH error on invalid Indian GSTIN format', () => {
    const fields: ExtractedField[] = [
      { fieldName: 'invoice_number', value: 'INV-102', confidence: 0.99, pageNumber: 1, isValid: true },
      { fieldName: 'supplier_name', value: 'Acme Corp', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'invoice_date', value: '2026-09-01', confidence: 0.98, pageNumber: 1, isValid: true },
      { fieldName: 'total_amount', value: 1000, confidence: 0.99, pageNumber: 1, isValid: true },
      { fieldName: 'supplier_gstin', value: 'INVALID_GSTIN_123', confidence: 0.95, pageNumber: 1, isValid: true }
    ];

    const result = validationEngine.validate('INVOICE', fields);
    expect(result.issues.some((i) => i.issueCode === 'INVALID_GSTIN_FORMAT')).toBe(true);
  });

  it('should detect PO total mismatch when invoice exceeds approved PO value', () => {
    const invoiceDoc: DocumentEntity = {
      id: 'inv-test-1',
      userId: 'user-1',
      title: 'Invoice Test',
      originalFilename: 'inv.pdf',
      fileSizeBytes: 1000,
      mimeType: 'application/pdf',
      storagePath: 'storage/inv.pdf',
      documentHash: 'hash1',
      status: 'PROCESSING',
      qualityScore: 'GOOD',
      documentType: 'INVOICE',
      supplierName: 'TechFlow IT Infrastructure',
      referenceNumber: 'INV-2026-005',
      totalAmount: 102000, // PO-2026-088 is 95,000
      currency: 'INR',
      pageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const match = poMatchingService.matchPurchaseOrder(invoiceDoc, 'PO-2026-088');
    expect(match).not.toBeNull();
    expect(match?.varianceAmount).toBe(7000);
    expect(match?.discrepancies.length).toBeGreaterThan(0);
  });
});
