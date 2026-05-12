import { CaseStatus, RiskLevel } from "@reformai/database"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"

export interface RuleCondition {
  field: string
  operator: "contains" | "equals" | "is_true" | "is_false" | "gte" | "lte"
  value?: unknown
}

export interface RuleAction {
  riskDelta?: number
  requiresART?: boolean
  requiresHumanReview?: boolean
  mandatoryInspection?: boolean
}

export interface RuleData {
  id: string
  name: string
  description: string
  condition: RuleCondition
  action: RuleAction
  priority: number
  active: boolean
}

export interface PolicyData {
  id: string
  tenantId: string | null
  name: string
  version: number
  active: boolean
  rules: RuleData[]
}

export interface TriggeredRule {
  ruleId: string
  ruleName: string
  reason: string
}

export interface PolicyEvaluationResult {
  riskLevel: RiskLevel
  triageScore: number
  requiresART: boolean
  requiresHumanReview: boolean
  mandatoryInspection: boolean
  recommendedStatus: CaseStatus
  triggeredRules: TriggeredRule[]
}

export type { ReformScope }
