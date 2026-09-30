import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  AuditLog,
  DocumentEntity,
  ExtractedField,
  ExtractionVersion,
  Insight,
  LineItem,
  NotificationItem,
  Supplier,
  User,
  ValidationResult
} from '../types';

export class DataStore {
  public users: Map<string, User> = new Map();
  public suppliers: Map<string, Supplier> = new Map();
  public documents: Map<string, DocumentEntity> = new Map();
  public extractionVersions: Map<string, ExtractionVersion[]> = new Map(); // documentId -> versions
  public extractionFields: Map<string, ExtractedField[]> = new Map(); // documentId -> fields
  public lineItems: Map<string, LineItem[]> = new Map(); // documentId -> lines
  public validationResults: Map<string, ValidationResult> = new Map(); // documentId -> result
  public insights: Map<string, Insight> = new Map();
  public notifications: Map<string, NotificationItem> = new Map();
  public auditLogs: AuditLog[] = [];
  public comments: Map<string, Array<{ id: string; userId: string; userFullName: string; text: string; fieldAnchor?: string; createdAt: string }>> = new Map();
  public documentChunks: Array<{ id: string; documentId: string; pageNumber: number; chunkIndex: number; content: string; embedding?: number[]; metadata?: any }> = [];

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // 1. Password hash for 'Password@123' generated with bcrypt 12 rounds
    const passwordHash = bcrypt.hashSync('Password@123', 12);

    const adminUser: User = {
      id: 'a0000000-0000-0000-0000-000000000001',
      email: 'admin@clarion.ai',
      passwordHash,
      fullName: 'Alexander Wright',
      role: 'ADMIN',
      department: 'Finance Operations',
      isActive: true,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z'
    };

    const reviewerUser: User = {
      id: 'a0000000-0000-0000-0000-000000000002',
      email: 'reviewer@clarion.ai',
      passwordHash,
      fullName: 'Sarah Jenkins',
      role: 'REVIEWER',
      department: 'Accounts Payable',
      isActive: true,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z'
    };

    const viewerUser: User = {
      id: 'a0000000-0000-0000-0000-000000000003',
      email: 'viewer@clarion.ai',
      passwordHash,
      fullName: 'Michael Chang',
      role: 'VIEWER',
      department: 'Internal Audit',
      isActive: true,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z'
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(reviewerUser.id, reviewerUser);
    this.users.set(viewerUser.id, viewerUser);

    // 2. Core Suppliers
    const suppliersList: Supplier[] = [
      {
        id: 's0000000-0000-0000-0000-000000000001',
        name: 'Acme Industrial Supplies Ltd',
        taxIdentifier: '27AABCA1234A1Z5',
        email: 'billing@acmeindustrial.com',
        phone: '+91 22 2456 7890',
        address: 'Plot 45, MIDC Industrial Area, Andheri East, Mumbai, Maharashtra 400093',
        currency: 'INR',
        riskScore: 2.5,
        totalSpend: 118000.0,
        documentCount: 2,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 's0000000-0000-0000-0000-000000000002',
        name: 'Bharat Electronics & Hardware',
        taxIdentifier: '29AABCB5678B1Z2',
        email: 'accounts@bharatelec.in',
        phone: '+91 80 4123 4567',
        address: '78 Electronic City Phase 1, Hosur Road, Bengaluru, Karnataka 560100',
        currency: 'INR',
        riskScore: 1.8,
        totalSpend: 245000.0,
        documentCount: 3,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 's0000000-0000-0000-0000-000000000003',
        name: 'TechFlow IT Infrastructure',
        taxIdentifier: '07AABCT9999T1Z1',
        email: 'invoices@techflow.io',
        phone: '+91 11 6789 1234',
        address: '12 Barakhamba Road, Connaught Place, New Delhi 110001',
        currency: 'INR',
        riskScore: 5.4,
        totalSpend: 95000.0,
        documentCount: 2,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 's0000000-0000-0000-0000-000000000004',
        name: 'Alpha Logistics & Warehousing',
        taxIdentifier: '33AABCA4321A1Z9',
        email: 'support@alphalogistics.com',
        phone: '+91 44 2829 1122',
        address: '56 Harbour Express Road, Chennai, Tamil Nadu 600001',
        currency: 'INR',
        riskScore: 2.0,
        totalSpend: 34000.0,
        documentCount: 1,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z'
      },
      {
        id: 's0000000-0000-0000-0000-000000000005',
        name: 'QuickPrint & Stationery Depot',
        taxIdentifier: '19AABCQ8888Q1Z4',
        email: 'orders@quickprintdepot.in',
        phone: '+91 33 2211 4455',
        address: '88 Park Street, Kolkata, West Bengal 700016',
        currency: 'INR',
        riskScore: 8.9,
        totalSpend: 14200.0,
        documentCount: 2,
        createdAt: '2026-09-01T08:00:00.000Z',
        updatedAt: '2026-09-01T08:00:00.000Z'
      }
    ];

    for (const sup of suppliersList) {
      this.suppliers.set(sup.id, sup);
    }

    // 3. Baseline Purchase Order: PO-2026-088 (Used for PO matching in the Golden Demo)
    const poDocId = 'd0000000-0000-0000-0000-000000000001';
    const poDoc: DocumentEntity = {
      id: poDocId,
      userId: adminUser.id,
      title: 'Purchase Order PO-2026-088',
      originalFilename: 'PO_2026_088_TechFlow.pdf',
      fileSizeBytes: 245780,
      mimeType: 'application/pdf',
      storagePath: 'storage/sample_documents/PO_2026_088_TechFlow.pdf',
      documentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'APPROVED',
      qualityScore: 'GOOD',
      documentType: 'PURCHASE_ORDER',
      classificationConfidence: 0.992,
      overallConfidence: 0.985,
      decision: 'AUTO_APPROVE',
      decisionReason: 'Verified enterprise PO issued by procurement.',
      supplierId: 's0000000-0000-0000-0000-000000000003',
      supplierName: 'TechFlow IT Infrastructure',
      referenceNumber: 'PO-2026-088',
      documentDate: '2026-09-10',
      dueDate: '2026-09-25',
      currency: 'INR',
      totalAmount: 95000.0,
      pageCount: 1,
      isExactDuplicate: false,
      metadata: {
        buyerName: 'Clarion Enterprise Systems Pvt Ltd',
        deliveryAddress: 'Tech Hub Tower 4, Sector 62, Noida, UP 201301',
        paymentTerms: 'Net 30 Days'
      },
      createdAt: '2026-09-10T10:00:00.000Z',
      updatedAt: '2026-09-10T10:00:00.000Z'
    };

    this.documents.set(poDocId, poDoc);

    const poLineItems: LineItem[] = [
      {
        id: 'l0000000-0000-0000-0000-000000000001',
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
        boundingBox: { x: 50, y: 320, width: 500, height: 25 }
      },
      {
        id: 'l0000000-0000-0000-0000-000000000002',
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
        boundingBox: { x: 50, y: 350, width: 500, height: 25 }
      }
    ];

    this.lineItems.set(poDocId, poLineItems);

    const poFields: ExtractedField[] = [
      {
        fieldName: 'po_number',
        value: 'PO-2026-088',
        confidence: 0.99,
        pageNumber: 1,
        sourceText: 'PURCHASE ORDER: PO-2026-088',
        boundingBox: { x: 420, y: 80, width: 150, height: 24 },
        isValid: true
      },
      {
        fieldName: 'supplier_name',
        value: 'TechFlow IT Infrastructure',
        confidence: 0.98,
        pageNumber: 1,
        sourceText: 'VENDOR: TechFlow IT Infrastructure',
        boundingBox: { x: 50, y: 140, width: 220, height: 22 },
        isValid: true
      },
      {
        fieldName: 'total_amount',
        value: 95000.0,
        confidence: 0.99,
        pageNumber: 1,
        sourceText: 'TOTAL ORDER VALUE: INR 95,000.00',
        boundingBox: { x: 400, y: 450, width: 170, height: 26 },
        isValid: true
      }
    ];
    this.extractionFields.set(poDocId, poFields);

    // Initial audit log
    this.auditLogs.push({
      id: uuidv4(),
      userId: adminUser.id,
      action: 'SYSTEM_INITIALIZED',
      entityType: 'SYSTEM',
      entityId: 'ROOT',
      metadata: { seedCount: 5, baselinePo: 'PO-2026-088' },
      createdAt: new Date().toISOString()
    });
  }
}

export const dataStore = new DataStore();
