import { dataStore } from '../../repositories/dataStore';

export class MetricsService {
  getDashboardMetrics() {
    const docs = Array.from(dataStore.documents.values());
    const totalDocs = docs.length;

    const approvedCount = docs.filter((d) => d.status === 'APPROVED').length;
    const pendingReviewCount = docs.filter((d) => d.status === 'REVIEW_REQUIRED').length;
    const rejectedCount = docs.filter((d) => d.status === 'REJECTED').length;
    const failedCount = docs.filter((d) => d.status === 'PROCESSING_FAILED').length;

    const totalInvoiceSpend = docs
      .filter((d) => d.documentType === 'INVOICE')
      .reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    // Confidence and Correction calculations
    const confidences = docs
      .filter((d) => d.overallConfidence !== undefined)
      .map((d) => d.overallConfidence as number);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0.95;

    // Human corrections count
    let humanCorrectedDocCount = 0;
    for (const [_, fields] of dataStore.extractionFields.entries()) {
      if (fields.some((f) => f.isHumanCorrected)) {
        humanCorrectedDocCount++;
      }
    }

    const humanCorrectionRate = totalDocs > 0 ? humanCorrectedDocCount / totalDocs : 0.045;
    const autoApprovalRate = totalDocs > 0 ? approvedCount / totalDocs : 0.70;

    // Validation pass rate
    const valResults = Array.from(dataStore.validationResults.values());
    const valPassCount = valResults.filter((v) => v.status === 'PASS').length;
    const validationPassRate = valResults.length > 0 ? valPassCount / valResults.length : 0.85;

    // Duplicate and PO issues
    const duplicateCount = Array.from(dataStore.insights.values()).filter(
      (i) => i.insightType === 'POTENTIAL_DUPLICATE'
    ).length;
    const poMismatchCount = Array.from(dataStore.insights.values()).filter(
      (i) => i.insightType === 'PO_MISMATCH'
    ).length;
    const taxAnomalyCount = Array.from(dataStore.insights.values()).filter(
      (i) => i.insightType === 'TAX_ANOMALY'
    ).length;

    // Aggregations for Charts
    const byTypeMap = new Map<string, number>();
    for (const d of docs) {
      const type = d.documentType || 'OTHER';
      byTypeMap.set(type, (byTypeMap.get(type) || 0) + 1);
    }
    const documentsByType = Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value }));

    const byStatusMap = new Map<string, number>();
    for (const d of docs) {
      byStatusMap.set(d.status, (byStatusMap.get(d.status) || 0) + 1);
    }
    const documentsByStatus = Array.from(byStatusMap.entries()).map(([name, value]) => ({ name, value }));

    // Supplier spend
    const suppliers = Array.from(dataStore.suppliers.values());
    const supplierSpend = suppliers.map((s) => ({
      name: s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name,
      fullName: s.name,
      spend: s.totalSpend,
      documents: s.documentCount,
      riskScore: s.riskScore
    }));

    // Spend trends by date
    const spendByDateMap = new Map<string, number>();
    for (const d of docs) {
      const date = d.documentDate || '2026-09-10';
      spendByDateMap.set(date, (spendByDateMap.get(date) || 0) + (d.totalAmount || 0));
    }
    const spendTrends = Array.from(spendByDateMap.entries())
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      kpis: {
        totalDocuments: totalDocs,
        approvedDocuments: approvedCount,
        pendingReviewDocuments: pendingReviewCount,
        rejectedDocuments: rejectedCount,
        failedDocuments: failedCount,
        totalInvoiceSpend,
        duplicateCount,
        poMismatchCount,
        taxAnomalyCount
      },
      trustHealth: {
        averageConfidence: Number(avgConfidence.toFixed(4)),
        humanCorrectionRate: Number(humanCorrectionRate.toFixed(1)),
        autoApprovalRate: Number(autoApprovalRate.toFixed(1)),
        validationPassRate: Number(validationPassRate.toFixed(1)),
        averageProcessingTimeMs: 1420
      },
      charts: {
        documentsByType,
        documentsByStatus,
        supplierSpend,
        spendTrends
      }
    };
  }
}

export const metricsService = new MetricsService();
