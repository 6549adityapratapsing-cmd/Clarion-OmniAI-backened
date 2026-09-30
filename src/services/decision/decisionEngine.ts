import {
  CrossDocumentMatch,
  DecisionResult,
  DecisionStatus,
  ValidationResult
} from '../../types';
import { DuplicateCheckResult } from '../duplicate/duplicateService';

export class DecisionEngine {
  evaluateDecision(
    overallConfidence: number,
    validationResult: ValidationResult,
    duplicateResult: DuplicateCheckResult,
    poMatchResult: CrossDocumentMatch | null
  ): DecisionResult {
    const hasCriticalValidation = validationResult.ruleFailureCount > 0;
    const hasValidationWarning = validationResult.ruleWarningCount > 0;
    const isDuplicate = duplicateResult.isBusinessDuplicate || duplicateResult.isExactDuplicate;
    const hasPoDiscrepancy = poMatchResult ? poMatchResult.discrepancies.length > 0 : false;
    const lowConfidence = overallConfidence < 0.88;

    let decision: DecisionStatus = 'AUTO_APPROVE';
    let reason = 'High confidence extraction, zero validation discrepancies, and verified supplier ledger alignment.';

    // Triad checks
    if (duplicateResult.isExactDuplicate) {
      decision = 'REJECT';
      reason = `Exact file duplicate rejected: ${duplicateResult.reason}`;
    } else if (hasCriticalValidation) {
      decision = 'REVIEW_REQUIRED';
      const topCritical = validationResult.issues.find((i) => i.severity === 'CRITICAL' || i.severity === 'HIGH');
      reason = `Validation failure: ${topCritical ? topCritical.message : 'Mathematical or tax integrity errors detected.'}`;
    } else if (isDuplicate) {
      decision = 'REVIEW_REQUIRED';
      reason = `Potential duplicate risk: ${duplicateResult.reason}`;
    } else if (hasPoDiscrepancy && poMatchResult) {
      decision = 'REVIEW_REQUIRED';
      reason = `Purchase Order mismatch: ${poMatchResult.discrepancies[0]}`;
    } else if (hasValidationWarning || lowConfidence) {
      decision = 'REVIEW_REQUIRED';
      reason = lowConfidence
        ? `Low extraction confidence (${Math.round(overallConfidence * 100)}%). Human verification required.`
        : `Validation warnings flagged: ${validationResult.issues[0]?.message || 'Please inspect extracted values.'}`;
    }

    return {
      decision,
      reason,
      layer1Confidence: overallConfidence,
      layer2ValidationPass: !hasCriticalValidation && !hasValidationWarning,
      layer3CrossDocPass: !isDuplicate && !hasPoDiscrepancy,
      metrics: {
        overallConfidence,
        validationWarningCount: validationResult.ruleWarningCount,
        validationFailureCount: validationResult.ruleFailureCount,
        duplicateRisk: isDuplicate,
        poDiscrepancy: hasPoDiscrepancy
      }
    };
  }
}

export const decisionEngine = new DecisionEngine();
