import { BoundingBox, DocumentQualityScore } from '../../types';

export interface OCRToken {
  text: string;
  page: number;
  bbox: BoundingBox;
  confidence: number;
}

export interface OCRResult {
  text: string;
  pages: number;
  tokens: OCRToken[];
  qualityScore: DocumentQualityScore;
  qualityReason: string;
  latencyMs: number;
}

export interface OCRProvider {
  process(buffer: Buffer, mimeType: string, filename?: string): Promise<OCRResult>;
}

export class MockOCRProvider implements OCRProvider {
  async process(buffer: Buffer, mimeType: string, filename: string = 'document.pdf'): Promise<OCRResult> {
    const startTime = Date.now();
    const isImage = mimeType.startsWith('image/');
    const isLowQuality = filename.toLowerCase().includes('scanned') || filename.toLowerCase().includes('blur');

    let qualityScore: DocumentQualityScore = 'GOOD';
    let qualityReason = 'High resolution text with sharp contrast and clean edge boundaries.';

    if (isLowQuality) {
      qualityScore = 'FAIR';
      qualityReason = 'Moderate DPI scan with mild skew and background noise artifacts.';
    }

    // Default simulated tokens with bounding boxes on a standard 612x792 pt document
    const tokens: OCRToken[] = [
      { text: 'TAX', page: 1, bbox: { x: 50, y: 50, width: 35, height: 18 }, confidence: 0.99 },
      { text: 'INVOICE', page: 1, bbox: { x: 90, y: 50, width: 70, height: 18 }, confidence: 0.99 },
      { text: 'ORIGINAL', page: 1, bbox: { x: 480, y: 50, width: 65, height: 14 }, confidence: 0.98 },
      { text: 'INVOICE', page: 1, bbox: { x: 400, y: 85, width: 60, height: 15 }, confidence: 0.99 },
      { text: 'NO:', page: 1, bbox: { x: 465, y: 85, width: 25, height: 15 }, confidence: 0.99 },
      { text: 'INV-2026-001', page: 1, bbox: { x: 495, y: 85, width: 90, height: 16 }, confidence: 0.99 },
      { text: 'DATE:', page: 1, bbox: { x: 400, y: 105, width: 45, height: 15 }, confidence: 0.98 },
      { text: '2026-09-12', page: 1, bbox: { x: 450, y: 105, width: 85, height: 15 }, confidence: 0.98 },
      { text: 'SUPPLIER:', page: 1, bbox: { x: 50, y: 110, width: 75, height: 15 }, confidence: 0.98 },
      { text: 'Acme', page: 1, bbox: { x: 50, y: 130, width: 45, height: 18 }, confidence: 0.99 },
      { text: 'Industrial', page: 1, bbox: { x: 100, y: 130, width: 75, height: 18 }, confidence: 0.99 },
      { text: 'Supplies', page: 1, bbox: { x: 180, y: 130, width: 65, height: 18 }, confidence: 0.98 },
      { text: 'Ltd', page: 1, bbox: { x: 250, y: 130, width: 25, height: 18 }, confidence: 0.97 },
      { text: 'GSTIN:', page: 1, bbox: { x: 50, y: 155, width: 50, height: 15 }, confidence: 0.98 },
      { text: '27AABCA1234A1Z5', page: 1, bbox: { x: 105, y: 155, width: 140, height: 15 }, confidence: isLowQuality ? 0.62 : 0.98 },
      { text: 'BUYER:', page: 1, bbox: { x: 50, y: 190, width: 55, height: 15 }, confidence: 0.97 },
      { text: 'Clarion', page: 1, bbox: { x: 50, y: 210, width: 55, height: 16 }, confidence: 0.99 },
      { text: 'Enterprise', page: 1, bbox: { x: 110, y: 210, width: 80, height: 16 }, confidence: 0.99 },
      { text: 'PO', page: 1, bbox: { x: 400, y: 130, width: 25, height: 15 }, confidence: 0.98 },
      { text: 'REF:', page: 1, bbox: { x: 430, y: 130, width: 35, height: 15 }, confidence: 0.98 },
      { text: 'PO-2026-088', page: 1, bbox: { x: 470, y: 130, width: 90, height: 15 }, confidence: 0.97 },
      { text: 'SUBTOTAL:', page: 1, bbox: { x: 380, y: 460, width: 80, height: 16 }, confidence: 0.98 },
      { text: '1,00,000.00', page: 1, bbox: { x: 470, y: 460, width: 90, height: 16 }, confidence: 0.98 },
      { text: 'CGST', page: 1, bbox: { x: 380, y: 485, width: 45, height: 15 }, confidence: 0.97 },
      { text: '9%:', page: 1, bbox: { x: 430, y: 485, width: 30, height: 15 }, confidence: 0.97 },
      { text: '9,000.00', page: 1, bbox: { x: 470, y: 485, width: 75, height: 15 }, confidence: 0.98 },
      { text: 'SGST', page: 1, bbox: { x: 380, y: 505, width: 45, height: 15 }, confidence: 0.97 },
      { text: '9%:', page: 1, bbox: { x: 430, y: 505, width: 30, height: 15 }, confidence: 0.97 },
      { text: '9,000.00', page: 1, bbox: { x: 470, y: 505, width: 75, height: 15 }, confidence: 0.98 },
      { text: 'TOTAL', page: 1, bbox: { x: 380, y: 535, width: 55, height: 18 }, confidence: 0.99 },
      { text: 'AMOUNT:', page: 1, bbox: { x: 440, y: 535, width: 75, height: 18 }, confidence: 0.99 },
      { text: '₹1,18,000.00', page: 1, bbox: { x: 520, y: 535, width: 100, height: 18 }, confidence: 0.99 }
    ];

    const fullText = tokens.map((t) => t.text).join(' ');

    return {
      text: fullText,
      pages: 1,
      tokens,
      qualityScore,
      qualityReason,
      latencyMs: Date.now() - startTime
    };
  }
}

export function getOCRProvider(): OCRProvider {
  return new MockOCRProvider();
}
