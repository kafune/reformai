import { CaseStatus, RiskLevel } from "@reformai/database"
import type {
  PolicyData,
  PolicyEvaluationResult,
  ReformScope,
  RuleCondition,
  TriggeredRule,
} from "./types"

export class DeterministicEvaluator {
  evaluate(scope: ReformScope, policy: PolicyData): PolicyEvaluationResult {
    let score = 0
    let requiresART = false
    let requiresHumanReview = false
    let mandatoryInspection = false
    const triggered: TriggeredRule[] = []

    const sorted = policy.rules
      .filter((r) => r.active)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of sorted) {
      if (this.matches(rule.condition, scope)) {
        score += rule.action.riskDelta ?? 0
        if (rule.action.requiresART) requiresART = true
        if (rule.action.requiresHumanReview) requiresHumanReview = true
        if (rule.action.mandatoryInspection) mandatoryInspection = true
        triggered.push({
          ruleId: rule.id,
          ruleName: rule.name,
          reason: rule.description,
        })
      }
    }

    const triageScore = Math.min(score, 100)
    const riskLevel = this.scoreToRisk(triageScore)
    const recommendedStatus = this.resolveStatus(riskLevel, requiresHumanReview)

    return {
      riskLevel,
      triageScore,
      requiresART,
      requiresHumanReview,
      mandatoryInspection,
      recommendedStatus,
      triggeredRules: triggered,
    }
  }

  private matches(cond: RuleCondition, scope: ReformScope): boolean {
    const fieldValue = this.readField(cond.field, scope)
    switch (cond.operator) {
      case "contains":
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((v) => String(v).toLowerCase() === String(cond.value).toLowerCase())
        }
        return typeof fieldValue === "string" && fieldValue.toLowerCase().includes(String(cond.value).toLowerCase())
      case "equals":
        return fieldValue === cond.value
      case "is_true":
        return fieldValue === true
      case "is_false":
        return fieldValue === false
      case "gte":
        return typeof fieldValue === "number" && typeof cond.value === "number" && fieldValue >= cond.value
      case "lte":
        return typeof fieldValue === "number" && typeof cond.value === "number" && fieldValue <= cond.value
      default:
        return false
    }
  }

  private readField(field: string, scope: ReformScope): unknown {
    return (scope as unknown as Record<string, unknown>)[field]
  }

  private scoreToRisk(score: number): RiskLevel {
    if (score <= 20) return "LOW"
    if (score <= 45) return "MEDIUM"
    if (score <= 70) return "HIGH"
    return "CRITICAL"
  }

  private resolveStatus(risk: RiskLevel, requiresHumanReview: boolean): CaseStatus {
    if (requiresHumanReview) return "HUMAN_REVIEW_REQUIRED"
    if (risk === "HIGH" || risk === "CRITICAL") return "HUMAN_REVIEW_REQUIRED"
    return "SCOPE_CLASSIFIED"
  }
}
