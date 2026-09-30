import crypto from 'crypto';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../repositories/dataStore';
import { documentOrchestrator } from '../services/document/documentOrchestrator';
import { DocumentEntity } from '../types';

export interface DemoScenario {
  id: string;
  title: string;
  filename: string;
  documentType: string;
  description: string;
  expectedOutcome: 'AUTO_APPROVE' | 'REVIEW_REQUIRED' | 'REJECT';
  keyDifferentiator: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'clean-invoice',
    title: 'Clean Commercial Invoice (Acme Industrial)',
    filename: 'INV_2026_001_Acme_Industrial_Clean.pdf',
    documentType: 'INVOICE',
    description: 'Crisp vector invoice with clean mathematical totals and valid Indian GSTIN. Exercises Layer 1 & 2 verification.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'High confidence + perfect math + verified supplier = Instant Auto-Approval.'
  },
  {
    id: 'scanned-low-quality',
    title: 'Low-Quality Scanned Invoice (INV-2026-002)',
    filename: 'INV_2026_002_Scanned_Blur_Artifacts.pdf',
    documentType: 'INVOICE',
    description: 'Noisy scan with blurry font and OCR uncertainty. Calibrated GSTIN confidence drops to 61%.',
    expectedOutcome: 'REVIEW_REQUIRED',
    keyDifferentiator: 'Exposes model uncertainty instead of pretending 99% accuracy.'
  },
  {
    id: 'math-mismatch',
    title: 'Mathematical Mismatch Invoice (INV-2026-003)',
    filename: 'INV_2026_003_Math_Mismatch_Scenario_3.pdf',
    documentType: 'INVOICE',
    description: 'Subtotal ₹1,00,000 + 18% Tax ₹18,000 billed as ₹1,25,000. Flagged by deterministic validation engine.',
    expectedOutcome: 'REVIEW_REQUIRED',
    keyDifferentiator: 'Deterministic rule catches arithmetic error that pure LLMs frequently hallucinate or overlook.'
  },
  {
    id: 'duplicate-invoice',
    title: 'Potential Duplicate Invoice (INV-2026-004)',
    filename: 'INV_2026_004_Duplicate_Invoice_Scenario_4.pdf',
    documentType: 'INVOICE',
    description: 'Identical supplier (Acme Industrial) and invoice reference number (INV-2026-001) as earlier approved document.',
    expectedOutcome: 'REVIEW_REQUIRED',
    keyDifferentiator: 'Cross-document business key duplicate detection stops double-payment risk.'
  },
  {
    id: 'po-mismatch',
    title: 'PO Mismatch Invoice (TechFlow IT)',
    filename: 'INV_2026_005_PO_Mismatch_Scenario_5.pdf',
    documentType: 'INVOICE',
    description: 'References PO-2026-088 (₹95,000 approved), but invoice billed at ₹1,02,000 (+₹7,000 unit price variance on Dell monitors).',
    expectedOutcome: 'REVIEW_REQUIRED',
    keyDifferentiator: '2-way cross-document matching detects unapproved vendor price markup.'
  },
  {
    id: 'purchase-order',
    title: 'Baseline Purchase Order (PO-2026-088)',
    filename: 'PO_2026_088_TechFlow_Baseline.pdf',
    documentType: 'PURCHASE_ORDER',
    description: 'Approved procurement purchase order for 2x Dell UltraSharp Monitors and 2x Logitech MX Mechanical Keyboards.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'Extracts buyer terms, payment milestones, and line items.'
  },
  {
    id: 'delivery-note',
    title: 'Logistics Delivery Challan (DN-4401)',
    filename: 'DN_4401_Logistics_Express.pdf',
    documentType: 'DELIVERY_NOTE',
    description: 'Consignment delivery receipt linking goods physical receipt against PO-2026-088.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'Proof of delivery for 3-way matching.'
  },
  {
    id: 'receipt',
    title: 'Corporate Travel & Expense Receipt (RCP-9012)',
    filename: 'RCP_9012_Executive_Supplies.pdf',
    documentType: 'RECEIPT',
    description: 'Point-of-sale receipt with date, merchant, itemization, and credit card payment verification.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'Retail receipt parsing with payment method extraction.'
  },
  {
    id: 'credit-note',
    title: 'Vendor Credit Adjustment Note (CN-304)',
    filename: 'CN_304_Damaged_Goods_Return.pdf',
    documentType: 'CREDIT_NOTE',
    description: 'Credit adjustment for returned damaged unit referencing original invoice INV-2026-001.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'Negative reconciliation ledger entry.'
  },
  {
    id: 'indian-gst-tax',
    title: 'Multi-Rate GST Tax Invoice (Bharat Electronics)',
    filename: 'INV_2026_010_Bharat_GST_Comprehensive.pdf',
    documentType: 'INVOICE',
    description: 'Intra-state tax invoice featuring HSN codes, 9% CGST + 9% SGST breakdown, and PAN verification.',
    expectedOutcome: 'AUTO_APPROVE',
    keyDifferentiator: 'Complex Indian compliance tax engine.'
  }
];

export const getScenarios = (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: { scenarios: DEMO_SCENARIOS }
  });
};

export const loadScenario = async (req: Request, res: Response): Promise<void> => {
  try {
    const scenarioId = req.params.scenarioId as string;
    const scenario = DEMO_SCENARIOS.find((s) => s.id === scenarioId);

    if (!scenario) {
      res.status(404).json({
        success: false,
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario '${scenarioId}' not found.` }
      });
      return;
    }

    // Create unique hash based on scenario name + timestamp
    const fakeContent = `Clarion_OmniAI_Demo_File_${scenario.filename}_${Date.now()}`;
    const docHash = crypto.createHash('sha256').update(fakeContent).digest('hex');

    const newDoc: DocumentEntity = {
      id: uuidv4(),
      userId: 'a0000000-0000-0000-0000-000000000002', // reviewer
      title: scenario.title,
      originalFilename: scenario.filename,
      fileSizeBytes: 215430,
      mimeType: 'application/pdf',
      storagePath: `storage/demo/${scenario.filename}`,
      documentHash: docHash,
      status: 'QUEUED',
      qualityScore: 'GOOD',
      currency: 'INR',
      pageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    dataStore.documents.set(newDoc.id, newDoc);

    // Process through complete pipeline synchronously so demo is instantly visible
    const processedDoc = await documentOrchestrator.processDocument(newDoc.id);

    res.json({
      success: true,
      data: {
        document: processedDoc,
        fields: dataStore.extractionFields.get(processedDoc.id) || [],
        lineItems: dataStore.lineItems.get(processedDoc.id) || [],
        validationResult: dataStore.validationResults.get(processedDoc.id) || null,
        scenario
      },
      message: `Scenario '${scenario.title}' loaded and processed.`
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'LOAD_SCENARIO_FAILED', message: err.message }
    });
  }
};
