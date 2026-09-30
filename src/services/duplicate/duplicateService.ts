import { dataStore } from '../../repositories/dataStore';
import { DocumentEntity } from '../../types';

export interface DuplicateCheckResult {
  isExactDuplicate: boolean;
  isBusinessDuplicate: boolean;
  matchedDocument?: DocumentEntity;
  reason?: string;
}

export class DuplicateService {
  checkDuplicate(
    currentDocumentId: string,
    documentHash: string,
    supplierName?: string,
    referenceNumber?: string,
    documentDate?: string,
    totalAmount?: number
  ): DuplicateCheckResult {
    for (const doc of dataStore.documents.values()) {
      if (doc.id === currentDocumentId) continue;

      // 1. Exact file hash duplicate check (SHA-256)
      if (doc.documentHash && doc.documentHash === documentHash) {
        return {
          isExactDuplicate: true,
          isBusinessDuplicate: true,
          matchedDocument: doc,
          reason: `Exact file binary duplicate detected. SHA-256 hash matches existing document '${doc.title}' (${doc.id}).`
        };
      }

      // 2. Business key duplicate check: Supplier + Invoice Number
      if (
        supplierName &&
        referenceNumber &&
        doc.supplierName &&
        doc.referenceNumber &&
        doc.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase() &&
        doc.referenceNumber.trim().toLowerCase() === referenceNumber.trim().toLowerCase()
      ) {
        return {
          isExactDuplicate: false,
          isBusinessDuplicate: true,
          matchedDocument: doc,
          reason: `Potential business duplicate detected: Matching supplier '${supplierName}' and reference number '${referenceNumber}' found in document '${doc.title}'.`
        };
      }

      // 3. Business key duplicate check: Supplier + Date + Amount
      if (
        supplierName &&
        documentDate &&
        totalAmount &&
        doc.supplierName &&
        doc.documentDate &&
        doc.totalAmount &&
        doc.supplierName.trim().toLowerCase() === supplierName.trim().toLowerCase() &&
        doc.documentDate === documentDate &&
        Math.abs(doc.totalAmount - totalAmount) < 0.01
      ) {
        return {
          isExactDuplicate: false,
          isBusinessDuplicate: true,
          matchedDocument: doc,
          reason: `Potential business duplicate detected: Same supplier '${supplierName}', date '${documentDate}', and identical total amount (₹${totalAmount.toLocaleString('en-IN')}) found in document '${doc.title}'.`
        };
      }
    }

    return {
      isExactDuplicate: false,
      isBusinessDuplicate: false
    };
  }
}

export const duplicateService = new DuplicateService();
