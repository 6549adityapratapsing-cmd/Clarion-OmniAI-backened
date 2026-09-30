import { z } from 'zod';
import {
  BoundingBox,
  DocumentType,
  ExtractedField,
  LineItem
} from '../../types';
import { OCRResult } from '../ocr';

export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
  provider: string;
  model: string;
}

export interface ExtractionResult {
  fields: ExtractedField[];
  lineItems: LineItem[];
  domainData: Record<string, any>;
  overallConfidence: number;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface AIProvider {
  classify(ocrResult: OCRResult, filename?: string): Promise<ClassificationResult>;
  extract(ocrResult: OCRResult, docType: DocumentType, filename?: string): Promise<ExtractionResult>;
  generateEmbedding(text: string): Promise<number[]>;
  askAssistant(
    query: string,
    contextDocuments: any[]
  ): Promise<{
    answer: string;
    sources: Array<{ documentId: string; documentTitle: string; page: number; excerpt: string }>;
  }>;
}

// Strict Zod schema for structured invoice extraction
export const InvoiceExtractionSchema = z.object({
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  supplierName: z.string().min(1),
  supplierGstin: z.string().optional(),
  buyerName: z.string().optional(),
  buyerGstin: z.string().optional(),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  discountAmount: z.number().default(0),
  cgst: z.number().optional(),
  sgst: z.number().optional(),
  igst: z.number().optional(),
  totalAmount: z.number().positive(),
  poReferenceNumber: z.string().optional(),
  lineItems: z.array(
    z.object({
      lineNumber: z.number(),
      itemName: z.string(),
      skuCode: z.string().optional(),
      hsnSac: z.string().optional(),
      quantity: z.number().positive(),
      unit: z.string().default('PCS'),
      unitPrice: z.number().nonnegative(),
      taxRate: z.number().optional(),
      taxAmount: z.number().optional(),
      lineTotal: z.number().nonnegative()
    })
  )
});

export class MockAIProvider implements AIProvider {
  async classify(ocrResult: OCRResult, filename: string = ''): Promise<ClassificationResult> {
    const upperFilename = filename.toUpperCase();
    const upperText = ocrResult.text.toUpperCase();

    if (upperFilename.startsWith('PO_') || (upperText.includes('PURCHASE ORDER') && !upperText.includes('TAX INVOICE') && !upperFilename.includes('INV_'))) {
      return {
        documentType: 'PURCHASE_ORDER',
        confidence: 0.985,
        reasoning: 'Explicit PURCHASE ORDER header and structured procurement requisition tables identified.',
        provider: 'MockAIProvider',
        model: 'clarion-idp-mock-v1'
      };
    }

    if (upperFilename.startsWith('DN_') || upperText.includes('DELIVERY NOTE') || upperText.includes('DELIVERY CHALLAN')) {
      return {
        documentType: 'DELIVERY_NOTE',
        confidence: 0.962,
        reasoning: 'Delivery note consignment details and recipient confirmation fields detected.',
        provider: 'MockAIProvider',
        model: 'clarion-idp-mock-v1'
      };
    }

    if (upperFilename.startsWith('RCP_') || upperText.includes('RECEIPT') || upperText.includes('PAYMENT METHOD')) {
      return {
        documentType: 'RECEIPT',
        confidence: 0.954,
        reasoning: 'Point of sale receipt format with payment method acknowledgement detected.',
        provider: 'MockAIProvider',
        model: 'clarion-idp-mock-v1'
      };
    }

    if (upperFilename.startsWith('CN_') || upperText.includes('CREDIT NOTE')) {
      return {
        documentType: 'CREDIT_NOTE',
        confidence: 0.971,
        reasoning: 'Credit note adjustment referencing original tax invoice found.',
        provider: 'MockAIProvider',
        model: 'clarion-idp-mock-v1'
      };
    }

    return {
      documentType: 'INVOICE',
      confidence: 0.978,
      reasoning: 'Standard commercial Tax Invoice with GST breakdown, bill-to, and payable line items.',
      provider: 'MockAIProvider',
      model: 'clarion-idp-mock-v1'
    };
  }

  async extract(ocrResult: OCRResult, docType: DocumentType, filename: string = ''): Promise<ExtractionResult> {
    const lowerFilename = filename.toLowerCase();

    // Check specific scenario triggers from filename:
    const isMathMismatch = lowerFilename.includes('math_mismatch') || lowerFilename.includes('scenario_3');
    const isLowQuality = lowerFilename.includes('scanned') || lowerFilename.includes('scenario_2') || lowerFilename.includes('low_quality');
    const isPoMismatch = lowerFilename.includes('po_mismatch') || lowerFilename.includes('scenario_5');
    const isDuplicate = lowerFilename.includes('duplicate') || lowerFilename.includes('scenario_4');

    if (docType === 'PURCHASE_ORDER') {
      const fields: ExtractedField[] = [
        {
          fieldName: 'po_number',
          value: 'PO-2026-088',
          confidence: 0.99,
          pageNumber: 1,
          sourceText: 'PURCHASE ORDER: PO-2026-088',
          boundingBox: { x: 420, y: 80, width: 140, height: 24 },
          isValid: true,
          extractionMethod: 'OCR_LLM'
        },
        {
          fieldName: 'po_date',
          value: '2026-09-10',
          confidence: 0.98,
          pageNumber: 1,
          sourceText: 'PO DATE: 2026-09-10',
          boundingBox: { x: 420, y: 110, width: 120, height: 20 },
          isValid: true,
          extractionMethod: 'OCR_LLM'
        },
        {
          fieldName: 'supplier_name',
          value: 'TechFlow IT Infrastructure',
          confidence: 0.98,
          pageNumber: 1,
          sourceText: 'VENDOR: TechFlow IT Infrastructure',
          boundingBox: { x: 50, y: 130, width: 220, height: 22 },
          isValid: true,
          extractionMethod: 'OCR_LLM'
        },
        {
          fieldName: 'total_amount',
          value: 95000.0,
          confidence: 0.99,
          pageNumber: 1,
          sourceText: 'TOTAL AMOUNT: ₹95,000.00',
          boundingBox: { x: 430, y: 450, width: 140, height: 26 },
          isValid: true,
          extractionMethod: 'OCR_LLM'
        }
      ];

      const lineItems: LineItem[] = [
        {
          lineNumber: 1,
          itemName: 'Dell 27-inch 4K UHD UltraSharp Monitor',
          skuCode: 'MON-U2723QE',
          hsnSac: '84716060',
          quantity: 2,
          unit: 'PCS',
          unitPrice: 32000.0,
          taxRate: 18.0,
          taxAmount: 11520.0,
          lineTotal: 75520.0,
          confidence: 0.99,
          pageNumber: 1,
          boundingBox: { x: 50, y: 250, width: 520, height: 25 }
        },
        {
          lineNumber: 2,
          itemName: 'Logitech MX Mechanical Wireless Keyboard',
          skuCode: 'KEY-MX-MECH',
          hsnSac: '84716040',
          quantity: 2,
          unit: 'PCS',
          unitPrice: 8254.24,
          taxRate: 18.0,
          taxAmount: 2971.53,
          lineTotal: 19480.0,
          confidence: 0.98,
          pageNumber: 1,
          boundingBox: { x: 50, y: 280, width: 520, height: 25 }
        }
      ];

      return {
        fields,
        lineItems,
        domainData: {
          poNumber: 'PO-2026-088',
          poDate: '2026-09-10',
          supplierName: 'TechFlow IT Infrastructure',
          subtotal: 80508.47,
          taxAmount: 14491.53,
          totalAmount: 95000.0
        },
        overallConfidence: 0.985,
        provider: 'MockAIProvider',
        model: 'clarion-idp-mock-v1',
        promptVersion: 'po-extraction-v1'
      };
    }

    // Default: INVOICE extraction
    let invoiceNumber = 'INV-2026-001';
    let supplierName = 'Acme Industrial Supplies Ltd';
    let gstin = '27AABCA1234A1Z5';
    let gstinConfidence = isLowQuality ? 0.61 : 0.98;
    let subtotal = 100000.0;
    let taxAmount = 18000.0;
    let totalAmount = 118000.0;
    let poRef = 'PO-2026-088';

    if (isMathMismatch) {
      invoiceNumber = 'INV-2026-003';
      subtotal = 100000.0;
      taxAmount = 18000.0;
      totalAmount = 125000.0; // Math mismatch! (100k + 18k != 125k)
    } else if (isPoMismatch) {
      invoiceNumber = 'INV-2026-005';
      supplierName = 'TechFlow IT Infrastructure';
      gstin = '07AABCT9999T1Z1';
      // In linked PO-2026-088, the total was 95,000. Here invoice says 1,02,000 (variance of 7,000!)
      subtotal = 86440.68;
      taxAmount = 15559.32;
      totalAmount = 102000.0;
      poRef = 'PO-2026-088';
    } else if (isDuplicate) {
      invoiceNumber = 'INV-2026-001'; // Duplicate of Scenario 1!
      supplierName = 'Acme Industrial Supplies Ltd';
    } else if (isLowQuality) {
      invoiceNumber = 'INV-2026-002';
      gstin = '27AABCA1234A1Z5'; // Low confidence OCR
    }

    const fields: ExtractedField[] = [
      {
        fieldName: 'invoice_number',
        value: invoiceNumber,
        confidence: 0.99,
        pageNumber: 1,
        sourceText: `INVOICE NUMBER: ${invoiceNumber}`,
        boundingBox: { x: 450, y: 85, width: 130, height: 24 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'invoice_date',
        value: '2026-09-12',
        confidence: 0.97,
        pageNumber: 1,
        sourceText: 'DATE: 2026-09-12',
        boundingBox: { x: 450, y: 110, width: 110, height: 20 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'due_date',
        value: '2026-10-12',
        confidence: 0.96,
        pageNumber: 1,
        sourceText: 'PAYMENT DUE: 2026-10-12',
        boundingBox: { x: 450, y: 135, width: 120, height: 20 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'supplier_name',
        value: supplierName,
        confidence: 0.98,
        pageNumber: 1,
        sourceText: `SUPPLIER: ${supplierName}`,
        boundingBox: { x: 50, y: 120, width: 240, height: 24 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'supplier_gstin',
        value: gstin,
        confidence: gstinConfidence,
        pageNumber: 1,
        sourceText: `GSTIN: ${gstin}`,
        boundingBox: { x: 50, y: 150, width: 190, height: 20 },
        isValid: gstinConfidence >= 0.85,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'buyer_name',
        value: 'Clarion Enterprise Systems Pvt Ltd',
        confidence: 0.98,
        pageNumber: 1,
        sourceText: 'BUYER: Clarion Enterprise Systems Pvt Ltd',
        boundingBox: { x: 50, y: 200, width: 270, height: 22 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'po_reference_number',
        value: poRef,
        confidence: 0.96,
        pageNumber: 1,
        sourceText: `PO REF: ${poRef}`,
        boundingBox: { x: 450, y: 160, width: 120, height: 20 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'subtotal',
        value: subtotal,
        confidence: 0.98,
        pageNumber: 1,
        sourceText: `SUBTOTAL: ₹${subtotal.toLocaleString('en-IN')}`,
        boundingBox: { x: 440, y: 460, width: 140, height: 20 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'tax_amount',
        value: taxAmount,
        confidence: 0.97,
        pageNumber: 1,
        sourceText: `TAX: ₹${taxAmount.toLocaleString('en-IN')}`,
        boundingBox: { x: 440, y: 490, width: 140, height: 20 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      },
      {
        fieldName: 'total_amount',
        value: totalAmount,
        confidence: 0.99,
        pageNumber: 1,
        sourceText: `TOTAL AMOUNT: ₹${totalAmount.toLocaleString('en-IN')}`,
        boundingBox: { x: 430, y: 535, width: 160, height: 28 },
        isValid: true,
        extractionMethod: 'OCR_LLM'
      }
    ];

    const lineItems: LineItem[] = [
      {
        lineNumber: 1,
        itemName: isPoMismatch ? 'Dell 27-inch 4K UHD UltraSharp Monitor' : 'Industrial CNC Carbide Milling Cutters',
        skuCode: isPoMismatch ? 'MON-U2723QE' : 'MILL-CARB-10',
        hsnSac: '84716060',
        quantity: isPoMismatch ? 2 : 10,
        unit: 'PCS',
        unitPrice: isPoMismatch ? 35000.0 : 10000.0, // Variance: in PO unit price was 32,000, now 35,000!
        taxRate: 18.0,
        taxAmount: taxAmount,
        lineTotal: totalAmount,
        confidence: 0.98,
        pageNumber: 1,
        boundingBox: { x: 50, y: 290, width: 530, height: 26 }
      }
    ];

    const overallConfidence = fields.reduce((acc, f) => acc + f.confidence, 0) / fields.length;

    return {
      fields,
      lineItems,
      domainData: {
        invoiceNumber,
        invoiceDate: '2026-09-12',
        dueDate: '2026-10-12',
        supplierName,
        supplierGstin: gstin,
        subtotal,
        taxAmount,
        totalAmount,
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        poReferenceNumber: poRef
      },
      overallConfidence: Number(overallConfidence.toFixed(4)),
      provider: 'MockAIProvider',
      model: 'clarion-idp-mock-v1',
      promptVersion: 'invoice-extraction-v1'
    };
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    // Generate deterministic 1536-dimensional mock embedding
    const embedding = new Array(1536).fill(0).map((_, i) => Math.sin(i * 0.1) * 0.05);
    return embedding;
  }

  async askAssistant(
    query: string,
    contextDocuments: any[]
  ): Promise<{
    answer: string;
    sources: Array<{ documentId: string; documentTitle: string; page: number; excerpt: string }>;
  }> {
    const q = query.toLowerCase();

    if (q.includes('acme') || q.includes('supplier')) {
      return {
        answer:
          'Acme Industrial Supplies Ltd currently has 2 active documents in the system totaling ₹1,18,000.00. Invoice INV-2026-001 was extracted with 98.4% average confidence and verified with 0 mathematical errors.',
        sources: [
          {
            documentId: 'd-acme-inv-1',
            documentTitle: 'Invoice INV-2026-001 (Acme Industrial)',
            page: 1,
            excerpt: 'Total Amount: ₹1,18,000.00 | GSTIN: 27AABCA1234A1Z5 | Status: AUTO_APPROVED'
          }
        ]
      };
    }

    if (q.includes('mismatch') || q.includes('po') || q.includes('variance') || q.includes('techflow')) {
      return {
        answer:
          'Yes, Invoice INV-2026-005 from TechFlow IT Infrastructure was flagged with a Purchase Order mismatch against PO-2026-088. The invoice total was ₹1,02,000.00 versus the approved PO total of ₹95,000.00, resulting in a positive variance of ₹7,000.00 on Dell UltraSharp monitors.',
        sources: [
          {
            documentId: 'd-po-088',
            documentTitle: 'Purchase Order PO-2026-088',
            page: 1,
            excerpt: 'Total Order Value: INR 95,000.00 (Dell UltraSharp Monitor @ ₹32,000/pc)'
          },
          {
            documentId: 'd-inv-005',
            documentTitle: 'Invoice INV-2026-005',
            page: 1,
            excerpt: 'Billed Amount: INR 1,02,000.00 (Dell UltraSharp Monitor @ ₹35,000/pc)'
          }
        ]
      };
    }

    if (q.includes('duplicate')) {
      return {
        answer:
          'Potential duplicate risk detected: Document INV-2026-004 shares the exact supplier (Acme Industrial) and invoice reference number (INV-2026-001) as an earlier approved record. It has been routed to human review.',
        sources: [
          {
            documentId: 'd-dup-004',
            documentTitle: 'Invoice INV-2026-004 (Duplicate Risk)',
            page: 1,
            excerpt: 'Supplier: Acme Industrial Supplies Ltd | Invoice No: INV-2026-001 | Risk: DUPLICATE_SUSPECTED'
          }
        ]
      };
    }

    return {
      answer: `Based on your processed documents: ${contextDocuments.length} relevant records were analyzed. The accounts payable ledger shows consistent procurement tracking across hardware, industrial tools, and IT infrastructure.`,
      sources: contextDocuments.slice(0, 2).map((d) => ({
        documentId: d.id || 'doc-1',
        documentTitle: d.title || 'Document Record',
        page: 1,
        excerpt: `Document ${d.referenceNumber || d.title}: Total ₹${(d.totalAmount || 0).toLocaleString('en-IN')}`
      }))
    };
  }
}

export function getAIProvider(): AIProvider {
  return new MockAIProvider();
}
