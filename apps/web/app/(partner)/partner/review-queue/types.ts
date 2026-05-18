export interface TriggeredRule {
  ruleId: string
  ruleName: string
  reason: string
}

export interface EvaluationResult {
  riskLevel: string
  triageScore: number
  requiresART: boolean | string
  requiresHumanReview: boolean
  mandatoryInspection: boolean
  triggeredRules: TriggeredRule[]
}

export interface ReformScopeLite {
  services: string[]
  description?: string
  areasAffected?: string[]
}

export interface ReviewCase {
  id: string
  protocol: string
  riskLevel: string | null
  triageScore: number | null
  requiresART: boolean | null
  reformScope: ReformScopeLite | null
  evaluationResult: EvaluationResult | null
  createdAt: string
  condominium: { name: string }
  unit: { identifier: string }
}
