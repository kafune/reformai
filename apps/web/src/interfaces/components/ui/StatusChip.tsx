export type CaseStatus =
  | "DRAFT"
  | "AWAITING_SCOPE_DETAILS"
  | "SCOPE_CLASSIFIED"
  | "AWAITING_SYNDIC_APPROVAL"
  | "AWAITING_DOCUMENTS"
  | "DOCUMENTS_UNDER_REVIEW"
  | "PENDING_CORRECTIONS"
  | "ELIGIBLE_FOR_RELEASE"
  | "RELEASED_WITH_CONDITIONS"
  | "HUMAN_REVIEW_REQUIRED"
  | "COMMERCIAL_OFFER_SENT"
  | "AWAITING_PAYMENT"
  | "ASSIGNED_TO_PARTNER"
  | "ART_RRT_PENDING"
  | "INSPECTIONS_SCHEDULED"
  | "IN_EXECUTION"
  | "CONCLUDED"
  | "ARCHIVED"

type Family =
  | "draft"
  | "progress"
  | "review"
  | "attention"
  | "blocked"
  | "ok"
  | "done"
  | "archived"

/** Mapa dos 18 estados do caso → 8 famílias visuais + rótulo PT-BR. */
const MAP: Record<CaseStatus, { fam: Family; label: string }> = {
  DRAFT: { fam: "draft", label: "Rascunho" },
  AWAITING_SCOPE_DETAILS: { fam: "progress", label: "Aguardando escopo" },
  SCOPE_CLASSIFIED: { fam: "progress", label: "Escopo classificado" },
  AWAITING_SYNDIC_APPROVAL: { fam: "review", label: "Aguardando síndico" },
  AWAITING_DOCUMENTS: { fam: "progress", label: "Aguardando documentos" },
  DOCUMENTS_UNDER_REVIEW: { fam: "progress", label: "Documentos em análise" },
  PENDING_CORRECTIONS: { fam: "attention", label: "Pendências de correção" },
  ELIGIBLE_FOR_RELEASE: { fam: "ok", label: "Apto para liberação" },
  RELEASED_WITH_CONDITIONS: { fam: "ok", label: "Liberado com ressalvas" },
  HUMAN_REVIEW_REQUIRED: { fam: "review", label: "Revisão humana" },
  COMMERCIAL_OFFER_SENT: { fam: "progress", label: "Proposta enviada" },
  AWAITING_PAYMENT: { fam: "attention", label: "Aguardando pagamento" },
  ASSIGNED_TO_PARTNER: { fam: "progress", label: "Atribuído a parceiro" },
  ART_RRT_PENDING: { fam: "attention", label: "Aguardando ART/RRT" },
  INSPECTIONS_SCHEDULED: { fam: "progress", label: "Vistorias agendadas" },
  IN_EXECUTION: { fam: "progress", label: "Em execução" },
  CONCLUDED: { fam: "done", label: "Concluído" },
  ARCHIVED: { fam: "archived", label: "Arquivado" },
}

export function statusFamily(status: string): Family {
  return MAP[status as CaseStatus]?.fam ?? "draft"
}

/** Rótulo PT-BR de um status de caso (fallback: o próprio código). */
export function statusLabel(status: string): string {
  return MAP[status as CaseStatus]?.label ?? status
}

export function StatusChip({ status }: { status: string }) {
  const it = MAP[status as CaseStatus] ?? { fam: "draft" as Family, label: status }
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-2.5 pr-3 text-xs font-medium"
      style={{
        background: `var(--rai-status-${it.fam}-bg)`,
        color: `var(--rai-status-${it.fam}-fg)`,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {it.label}
    </span>
  )
}
