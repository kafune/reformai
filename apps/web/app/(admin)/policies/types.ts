export interface RuleCondition {
  field: string
  operator: string
  value?: unknown
}

export interface RuleAction {
  riskDelta?: number
  requiresART?: boolean
  requiresHumanReview?: boolean
  mandatoryInspection?: boolean
}

export interface Rule {
  id: string
  name: string
  description: string
  condition: RuleCondition
  action: RuleAction
  priority: number
  active: boolean
}

export interface Policy {
  id: string
  tenantId: string | null
  name: string
  description: string | null
  version: number
  active: boolean
  rules: Rule[]
}

/** Rascunho editável de uma regra (campos como string para os inputs). */
export interface RuleDraft {
  name: string
  description: string
  service: string
  riskDelta: string
  priority: string
  requiresART: boolean
  requiresHumanReview: boolean
  mandatoryInspection: boolean
  active: boolean
}

export function ruleToDraft(r: Rule): RuleDraft {
  return {
    name: r.name,
    description: r.description,
    service: typeof r.condition?.value === "string" ? r.condition.value : "",
    riskDelta: String(r.action?.riskDelta ?? 0),
    priority: String(r.priority ?? 0),
    requiresART: !!r.action?.requiresART,
    requiresHumanReview: !!r.action?.requiresHumanReview,
    mandatoryInspection: !!r.action?.mandatoryInspection,
    active: r.active ?? true,
  }
}

/** Converte um rascunho no payload aceito pela API de regras. */
export function draftToPayload(d: RuleDraft) {
  return {
    name: d.name.trim(),
    description: d.description.trim(),
    condition: { field: "services", operator: "contains" as const, value: d.service },
    action: {
      riskDelta: Number(d.riskDelta) || 0,
      requiresART: d.requiresART,
      requiresHumanReview: d.requiresHumanReview,
      mandatoryInspection: d.mandatoryInspection,
    },
    priority: Number(d.priority) || 0,
    active: d.active,
  }
}
