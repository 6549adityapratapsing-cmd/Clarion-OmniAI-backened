// Clarion OmniAI: Core System Types and Interfaces

export type UserRole = 'ADMIN' | 'REVIEWER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  fullName: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus =
  | 'UPLOADED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'OCR_COMPLETED'
  | 'CLASSIFIED'
  | 'EXTRACTED'
  | 'VALIDATED'
  | 'REVIEW_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING_FAILED'
  | 'ARCHIVED';

export type DocumentType =
  | 'INVOICE'
  | 'PURCHASE_ORDER'
  | 'RECEIPT'
  | 'DELIVERY_NOTE'
  | 'CREDIT_NOTE'
  | 'OTHER';

export type DocumentQualityScore = 'GOOD' | 'FAIR' | 'POOR' | 'UNREADABLE';

export type DecisionStatus = 'AUTO_APPROVE' | 'REVIEW_REQUIRED' | 'REJECT';

export interface BoundingBox {
  x: number; // Left coordinate (pixels or pt)
  y: number; // Top coordinate
  width: number;
  height: number;
}

export interface ExtractedField {
  id?: string;
  fieldName: string;
  value: string | number | null;
  normalizedValue?: any;
  confidence: number; // 0.00 to 1.00
  pageNumber: number;
  sourceText?: string;
  boundingBox?: BoundingBox;
  isValid: boolean;
  isHumanCorrected?: boolean;
  originalAiValue?: string | number | null;
  extractionMethod?: string;
  provider?: string;
  model?: string;
}

export interface LineItem {
  id?: string;
  lineNumber: number;
  itemName: string;
  skuCode?: string;
  hsnSac?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  lineTotal: number;
  confidence: number;
  boundingBox?: BoundingBox;
  pageNumber?: number;
}

export interface InvoiceDetails {
  invoiceNumber: string;
  invoiceDate?: string;
  dueDate?: string;
  paymentTerms?: string;
  supplierGstin?: string;
  buyerName?: string;
  buyerAddress?: string;
  buyerGstin?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalAmount: number;
  poReferenceNumber?: string;
}

export interface PurchaseOrderDetails {
  poNumber: string;
  poDate?: string;
  deliveryDate?: string;
  supplierName?: string;
  buyerName?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface ReceiptDetails {
  receiptNumber?: string;
  merchantName?: string;
  receiptDate?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod?: string;
}

export interface DeliveryNoteDetails {
  deliveryNoteNumber: string;
  deliveryDate?: string;
  supplierName?: string;
  customerName?: string;
  poReferenceNumber?: string;
  deliveryLocation?: string;
  deliveryStatus?: string;
}

export interface CreditNoteDetails {
  creditNoteNumber: string;
  originalInvoiceNumber?: string;
  creditDate?: string;
  reason?: string;
  taxAmount?: number;
  creditAmount: number;
}

export type IssueSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface ValidationIssue {
  id: string;
  fieldName?: string;
  issueCode: string;
  severity: IssueSeverity;
  message: string;
  suggestedFix?: string;
  metadata?: Record<string, any>;
  isResolved?: boolean;
}

export interface ValidationResult {
  id?: string;
  documentId?: string;
  status: 'PASS' | 'WARNING' | 'FAIL';
  rulePassCount: number;
  ruleWarningCount: number;
  ruleFailureCount: number;
  issues: ValidationIssue[];
  executedAt: string;
}

export interface CrossDocumentMatch {
  targetDocumentId: string;
  targetType: DocumentType;
  referenceNumber: string;
  matchType: 'EXACT' | 'PO_MATCH' | 'DUPLICATE_SUSPECTED';
  confidence: number;
  varianceAmount?: number;
  variancePercentage?: number;
  discrepancies: string[];
}

export interface DecisionResult {
  decision: DecisionStatus;
  reason: string;
  layer1Confidence: number;
  layer2ValidationPass: boolean;
  layer3CrossDocPass: boolean;
  metrics: {
    overallConfidence: number;
    validationWarningCount: number;
    validationFailureCount: number;
    duplicateRisk: boolean;
    poDiscrepancy: boolean;
  };
}

export interface DocumentEntity {
  id: string;
  userId: string;
  title: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  storagePath: string;
  documentHash: string;
  status: DocumentStatus;
  qualityScore: DocumentQualityScore;
  documentType?: DocumentType;
  classificationConfidence?: number;
  overallConfidence?: number;
  decision?: DecisionStatus;
  decisionReason?: string;
  supplierId?: string;
  supplierName?: string;
  referenceNumber?: string;
  documentDate?: string;
  dueDate?: string;
  currency: string;
  totalAmount?: number;
  pageCount: number;
  isExactDuplicate?: boolean;
  duplicateOfId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  createdByUserId?: string;
  changeType: 'AI_INITIAL' | 'HUMAN_CORRECTION' | 'REPROCESSED';
  summary?: string;
  dataSnapshot: {
    fields: ExtractedField[];
    lineItems: LineItem[];
    domainData?: any;
  };
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxIdentifier?: string;
  email?: string;
  phone?: string;
  address?: string;
  currency: string;
  riskScore: number;
  totalSpend: number;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Insight {
  id: string;
  documentId?: string;
  supplierId?: string;
  insightType:
    | 'POTENTIAL_DUPLICATE'
    | 'PO_MISMATCH'
    | 'LOW_CONFIDENCE'
    | 'TAX_ANOMALY'
    | 'UNUSUAL_AMOUNT'
    | 'SPEND_CONCENTRATION'
    | 'UPCOMING_DUE_DATE'
    | 'SUPPLIER_RISK';
  severity: IssueSeverity;
  title: string;
  explanation: string;
  evidence: Record<string, any>;
  isDismissed: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  documentId?: string;
  title: string;
  message: string;
  type:
    | 'DOCUMENT_PROCESSING_COMPLETED'
    | 'DOCUMENT_PROCESSING_FAILED'
    | 'REVIEW_REQUIRED'
    | 'VALIDATION_ERROR'
    | 'DUPLICATE_DETECTED'
    | 'PO_MISMATCH'
    | 'PAYMENT_DUE';
  isRead: boolean;
  createdAt: string;
}
