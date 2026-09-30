import { dataStore } from '../../repositories/dataStore';
import { CrossDocumentMatch, DocumentEntity, LineItem } from '../../types';

export class POMatchingService {
  matchPurchaseOrder(
    invoiceDocument: DocumentEntity,
    poReferenceNumber?: string,
    invoiceLineItems: LineItem[] = []
  ): CrossDocumentMatch | null {
    if (!poReferenceNumber) return null;

    const normalizedPoRef = poReferenceNumber.trim().toUpperCase();

    // Look for matching PO in dataStore
    let matchedPo: DocumentEntity | null = null;
    for (const doc of dataStore.documents.values()) {
      if (
        doc.documentType === 'PURCHASE_ORDER' &&
        doc.referenceNumber &&
        doc.referenceNumber.trim().toUpperCase() === normalizedPoRef
      ) {
        matchedPo = doc;
        break;
      }
    }

    if (!matchedPo) {
      return null;
    }

    const discrepancies: string[] = [];
    const invoiceTotal = invoiceDocument.totalAmount || 0;
    const poTotal = matchedPo.totalAmount || 0;
    const variance = invoiceTotal - poTotal;
    const variancePercentage = poTotal > 0 ? (variance / poTotal) * 100 : 0;

    // Check Supplier Match
    if (
      invoiceDocument.supplierName &&
      matchedPo.supplierName &&
      invoiceDocument.supplierName.trim().toLowerCase() !== matchedPo.supplierName.trim().toLowerCase()
    ) {
      discrepancies.push(
        `Supplier mismatch: Invoice supplier '${invoiceDocument.supplierName}' does not match PO vendor '${matchedPo.supplierName}'.`
      );
    }

    // Check Total Amount Variance
    if (Math.abs(variance) > 1.0) {
      discrepancies.push(
        `PO Total mismatch: Invoice total (₹${invoiceTotal.toLocaleString('en-IN')}) differs from approved PO total (₹${poTotal.toLocaleString('en-IN')}) by ₹${Math.abs(variance).toLocaleString('en-IN')} (${variancePercentage > 0 ? '+' : ''}${variancePercentage.toFixed(1)}%).`
      );
    }

    // Check Line Items if available
    const poLineItems = dataStore.lineItems.get(matchedPo.id) || [];
    if (poLineItems.length > 0 && invoiceLineItems.length > 0) {
      for (const invItem of invoiceLineItems) {
        // Try to match line item by SKU or Item Name
        const poItem = poLineItems.find(
          (p) =>
            (p.skuCode && invItem.skuCode && p.skuCode.toUpperCase() === invItem.skuCode.toUpperCase()) ||
            p.itemName.toLowerCase().includes(invItem.itemName.toLowerCase()) ||
            invItem.itemName.toLowerCase().includes(p.itemName.toLowerCase())
        );

        if (poItem) {
          if (invItem.unitPrice > poItem.unitPrice) {
            discrepancies.push(
              `Unit price increase on '${invItem.itemName}': Billed at ₹${invItem.unitPrice.toLocaleString('en-IN')} vs contracted PO price ₹${poItem.unitPrice.toLocaleString('en-IN')}.`
            );
          }
          if (invItem.quantity > poItem.quantity) {
            discrepancies.push(
              `Excess quantity on '${invItem.itemName}': Billed qty ${invItem.quantity} exceeds PO authorized qty ${poItem.quantity}.`
            );
          }
        }
      }
    }

    return {
      targetDocumentId: matchedPo.id,
      targetType: 'PURCHASE_ORDER',
      referenceNumber: matchedPo.referenceNumber || poReferenceNumber,
      matchType: 'PO_MATCH',
      confidence: 0.98,
      varianceAmount: variance,
      variancePercentage: Number(variancePercentage.toFixed(2)),
      discrepancies
    };
  }
}

export const poMatchingService = new POMatchingService();
