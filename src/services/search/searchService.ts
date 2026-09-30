import { dataStore } from '../../repositories/dataStore';
import { DocumentEntity } from '../../types';

export interface SearchFilter {
  query?: string;
  documentType?: string;
  supplierName?: string;
  status?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
}

export interface SearchResultItem {
  document: DocumentEntity;
  score: number;
  highlights: string[];
}

export class SearchService {
  search(filters: SearchFilter): SearchResultItem[] {
    const q = (filters.query || '').trim().toLowerCase();
    const results: SearchResultItem[] = [];

    for (const doc of dataStore.documents.values()) {
      // 1. Apply structural filters
      if (filters.documentType && doc.documentType !== filters.documentType) continue;
      if (filters.status && doc.status !== filters.status) continue;
      if (filters.supplierName && (!doc.supplierName || !doc.supplierName.toLowerCase().includes(filters.supplierName.toLowerCase()))) continue;
      if (filters.minAmount !== undefined && (doc.totalAmount || 0) < filters.minAmount) continue;
      if (filters.maxAmount !== undefined && (doc.totalAmount || 0) > filters.maxAmount) continue;
      if (filters.startDate && doc.documentDate && doc.documentDate < filters.startDate) continue;
      if (filters.endDate && doc.documentDate && doc.documentDate > filters.endDate) continue;

      let score = 0.5; // Baseline inclusion
      const highlights: string[] = [];

      // 2. Textual search across title, reference, supplier, fields, line items
      if (q) {
        let matched = false;

        if (doc.title.toLowerCase().includes(q)) {
          matched = true;
          score += 0.4;
          highlights.push(`Title: ${doc.title}`);
        }

        if (doc.referenceNumber && doc.referenceNumber.toLowerCase().includes(q)) {
          matched = true;
          score += 0.5;
          highlights.push(`Reference #: ${doc.referenceNumber}`);
        }

        if (doc.supplierName && doc.supplierName.toLowerCase().includes(q)) {
          matched = true;
          score += 0.3;
          highlights.push(`Supplier: ${doc.supplierName}`);
        }

        // Check line items
        const lineItems = dataStore.lineItems.get(doc.id) || [];
        for (const item of lineItems) {
          if (item.itemName.toLowerCase().includes(q)) {
            matched = true;
            score += 0.35;
            highlights.push(`Item: ${item.itemName} (Qty: ${item.quantity})`);
            break;
          }
        }

        // Check extracted fields
        const fields = dataStore.extractionFields.get(doc.id) || [];
        for (const field of fields) {
          if (field.value && String(field.value).toLowerCase().includes(q)) {
            matched = true;
            score += 0.2;
            highlights.push(`${field.fieldName}: ${field.value}`);
            break;
          }
        }

        if (!matched) {
          continue; // Skip if query was provided and did not match
        }
      }

      results.push({
        document: doc,
        score: Math.min(1.0, Number(score.toFixed(2))),
        highlights
      });
    }

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

export const searchService = new SearchService();
