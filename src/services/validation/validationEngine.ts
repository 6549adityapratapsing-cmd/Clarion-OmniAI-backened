import { v4 as uuidv4 } from 'uuid';
import {
  DocumentType,
  ExtractedField,
  LineItem,
  ValidationIssue,
  ValidationResult
} from '../../types';

export class ValidationEngine {
  private gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  validate(
    documentType: DocumentType,
    fields: ExtractedField[],
    lineItems: LineItem[] = [],
    domainData: Record<string, any> = {}
  ): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Helper map for fast field lookup
    const fieldMap = new Map<string, ExtractedField>();
    for (const f of fields) {
      fieldMap.set(f.fieldName, f);
    }

    // 1. Required Fields Validation
    if (documentType === 'INVOICE') {
      this.checkRequiredField('invoice_number', 'Invoice Number', fieldMap, issues);
      this.checkRequiredField('supplier_name', 'Supplier Name', fieldMap, issues);
      this.checkRequiredField('invoice_date', 'Invoice Date', fieldMap, issues);
      this.checkRequiredField('total_amount', 'Total Amount', fieldMap, issues);

      // 2. Mathematical Consistency: subtotal + tax - discount == total
      const subtotal = Number(fieldMap.get('subtotal')?.value ?? domainData.subtotal ?? 0);
      const tax = Number(fieldMap.get('tax_amount')?.value ?? domainData.taxAmount ?? 0);
      const discount = Number(fieldMap.get('discount_amount')?.value ?? domainData.discountAmount ?? 0);
      const total = Number(fieldMap.get('total_amount')?.value ?? domainData.totalAmount ?? 0);

      const expectedTotal = subtotal + tax - discount;
      const discrepancy = Math.abs(expectedTotal - total);

      // Tolerance of ₹1.00 for rounding differences
      if (discrepancy > 1.0) {
        issues.push({
          id: uuidv4(),
          fieldName: 'total_amount',
          issueCode: 'MATH_MISMATCH',
          severity: discrepancy > 500 ? 'CRITICAL' : 'HIGH',
          message: `Mathematical mismatch: Subtotal (₹${subtotal.toLocaleString('en-IN')}) + Tax (₹${tax.toLocaleString('en-IN')}) - Discount (₹${discount.toLocaleString('en-IN')}) = ₹${expectedTotal.toLocaleString('en-IN')}, but extracted Total is ₹${total.toLocaleString('en-IN')}. Difference: ₹${discrepancy.toLocaleString('en-IN')}.`,
          suggestedFix: `Adjust line item taxes or recalculate final invoice total to ₹${expectedTotal.toFixed(2)}.`,
          metadata: { subtotal, tax, discount, total, expectedTotal, discrepancy }
        });
      }

      // 3. Indian GST Validation
      const gstinField = fieldMap.get('supplier_gstin');
      if (gstinField && gstinField.value) {
        const gstinStr = String(gstinField.value).trim().toUpperCase();
        if (!this.gstinRegex.test(gstinStr)) {
          issues.push({
            id: uuidv4(),
            fieldName: 'supplier_gstin',
            issueCode: 'INVALID_GSTIN_FORMAT',
            severity: 'HIGH',
            message: `Supplier GSTIN '${gstinStr}' does not conform to the 15-character Indian GST format (2-digit state code + 10-digit PAN + entity code + Z + checksum).`,
            suggestedFix: 'Verify vendor registration certificate on the GST portal.'
          });
        }
      }

      // GST Split Sanity: CGST & SGST vs IGST
      const cgst = Number(domainData.cgst ?? 0);
      const sgst = Number(domainData.sgst ?? 0);
      const igst = Number(domainData.igst ?? 0);

      if (cgst > 0 && sgst > 0) {
        if (Math.abs(cgst - sgst) > 0.5) {
          issues.push({
            id: uuidv4(),
            fieldName: 'tax_amount',
            issueCode: 'CGST_SGST_ASYMMETRY',
            severity: 'WARNING',
            message: `Intra-state GST requires CGST (₹${cgst}) and SGST (₹${sgst}) to be identical.`,
            suggestedFix: 'Rebalance CGST and SGST rates equally.'
          });
        }
      }

      // 4. Date Sanity
      const invoiceDateStr = fieldMap.get('invoice_date')?.value;
      const dueDateStr = fieldMap.get('due_date')?.value;

      if (invoiceDateStr && dueDateStr) {
        const invDate = new Date(String(invoiceDateStr));
        const dueDate = new Date(String(dueDateStr));
        if (dueDate < invDate) {
          issues.push({
            id: uuidv4(),
            fieldName: 'due_date',
            issueCode: 'DUE_DATE_PRECEDES_INVOICE_DATE',
            severity: 'HIGH',
            message: `Invoice Due Date (${dueDateStr}) precedes the Invoice Date (${invoiceDateStr}).`,
            suggestedFix: 'Update payment terms or due date.'
          });
        }
      }
    } else if (documentType === 'PURCHASE_ORDER') {
      this.checkRequiredField('po_number', 'Purchase Order Number', fieldMap, issues);
      this.checkRequiredField('supplier_name', 'Supplier Name', fieldMap, issues);
      this.checkRequiredField('total_amount', 'Total Amount', fieldMap, issues);
    }

    // 5. Line items consistency check
    if (lineItems.length > 0) {
      for (const item of lineItems) {
        const expectedLineTotal = item.quantity * item.unitPrice + (item.taxAmount || 0) - (item.discountAmount || 0);
        if (Math.abs(expectedLineTotal - item.lineTotal) > 1.0) {
          issues.push({
            id: uuidv4(),
            fieldName: 'line_items',
            issueCode: 'LINE_ITEM_TOTAL_MISMATCH',
            severity: 'WARNING',
            message: `Line item #${item.lineNumber} ('${item.itemName}') calculation mismatch: Qty ${item.quantity} * Price ₹${item.unitPrice} = ₹${expectedLineTotal.toFixed(2)}, but line total is ₹${item.lineTotal.toFixed(2)}.`,
            suggestedFix: `Update line total to ₹${expectedLineTotal.toFixed(2)}.`
          });
        }
      }
    }

    // 6. Confidence Warnings
    for (const f of fields) {
      if (f.confidence < 0.70) {
        issues.push({
          id: uuidv4(),
          fieldName: f.fieldName,
          issueCode: 'LOW_EXTRACTION_CONFIDENCE',
          severity: 'WARNING',
          message: `Field '${f.fieldName}' was extracted with low OCR/AI confidence (${Math.round(f.confidence * 100)}%). Review required.`,
          suggestedFix: 'Manually inspect original document and verify value.'
        });
      }
    }

    const warningCount = issues.filter((i) => i.severity === 'WARNING' || i.severity === 'INFO').length;
    const failureCount = issues.filter((i) => i.severity === 'HIGH' || i.severity === 'CRITICAL').length;
    const passCount = Math.max(0, fields.length - issues.length);

    let status: 'PASS' | 'WARNING' | 'FAIL' = 'PASS';
    if (failureCount > 0) {
      status = 'FAIL';
    } else if (warningCount > 0) {
      status = 'WARNING';
    }

    return {
      status,
      rulePassCount: passCount,
      ruleWarningCount: warningCount,
      ruleFailureCount: failureCount,
      issues,
      executedAt: new Date().toISOString()
    };
  }

  private checkRequiredField(
    fieldName: string,
    displayName: string,
    fieldMap: Map<string, ExtractedField>,
    issues: ValidationIssue[]
  ) {
    const field = fieldMap.get(fieldName);
    if (!field || field.value === null || field.value === undefined || String(field.value).trim() === '') {
      issues.push({
        id: uuidv4(),
        fieldName,
        issueCode: 'MISSING_REQUIRED_FIELD',
        severity: 'HIGH',
        message: `Mandatory field '${displayName}' is missing from the document extraction.`,
        suggestedFix: `Extract or manually enter '${displayName}' from the source document.`
      });
    }
  }
}

export const validationEngine = new ValidationEngine();
