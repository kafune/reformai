import type { CaseStatus } from "@reformai/database"

export interface FunnelStage {
  key: string
  label: string
  count: number
  statuses: CaseStatus[]
}

/**
 * Estágios do funil — agrupam os 17 status em etapas macro do ciclo de vida.
 * A ordem reflete o avanço do caso.
 */
const FUNNEL_DEF: Array<{ key: string; label: string; statuses: CaseStatus[] }> = [
  { key: "intake", label: "Triagem", statuses: ["DRAFT", "AWAITING_SCOPE_DETAILS"] },
  { key: "classified", label: "Classificado", statuses: ["SCOPE_CLASSIFIED"] },
  {
    key: "documents",
    label: "Documentação",
    statuses: ["AWAITING_DOCUMENTS", "DOCUMENTS_UNDER_REVIEW", "PENDING_CORRECTIONS"],
  },
  { key: "review", label: "Revisão humana", statuses: ["HUMAN_REVIEW_REQUIRED"] },
  {
    key: "released",
    label: "Liberado",
    statuses: ["ELIGIBLE_FOR_RELEASE", "RELEASED_WITH_CONDITIONS"],
  },
  {
    key: "commercial",
    label: "Comercial",
    statuses: ["COMMERCIAL_OFFER_SENT", "AWAITING_PAYMENT"],
  },
  {
    key: "execution",
    label: "Execução",
    statuses: ["ASSIGNED_TO_PARTNER", "ART_RRT_PENDING", "INSPECTIONS_SCHEDULED", "IN_EXECUTION"],
  },
  { key: "concluded", label: "Concluído", statuses: ["CONCLUDED"] },
  { key: "archived", label: "Arquivado", statuses: ["ARCHIVED"] },
]

export function computeFunnel(statusCounts: Record<string, number>): FunnelStage[] {
  return FUNNEL_DEF.map((stage) => ({
    key: stage.key,
    label: stage.label,
    statuses: stage.statuses,
    count: stage.statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0),
  }))
}

// Status que indicam que o caso passou pela liberação (aprovado).
const APPROVED: CaseStatus[] = [
  "ELIGIBLE_FOR_RELEASE",
  "RELEASED_WITH_CONDITIONS",
  "COMMERCIAL_OFFER_SENT",
  "AWAITING_PAYMENT",
  "ASSIGNED_TO_PARTNER",
  "ART_RRT_PENDING",
  "INSPECTIONS_SCHEDULED",
  "IN_EXECUTION",
  "CONCLUDED",
]

export interface ApprovalRate {
  approved: number
  decided: number
  /** 0..1 — fração de casos decididos que foram aprovados (vs arquivados). */
  rate: number
}

/**
 * Taxa de aprovação entre casos já decididos. "Decidido" = aprovado (passou
 * pela liberação) ou arquivado. Casos ainda em triagem/revisão não contam.
 */
export function computeApprovalRate(statusCounts: Record<string, number>): ApprovalRate {
  const approved = APPROVED.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0)
  const archived = statusCounts["ARCHIVED"] ?? 0
  const decided = approved + archived
  return { approved, decided, rate: decided === 0 ? 0 : approved / decided }
}
