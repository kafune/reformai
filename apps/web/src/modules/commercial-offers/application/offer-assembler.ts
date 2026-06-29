import type { CaseStatus } from "@reformai/database"

// ---------------------------------------------------------------------------
// Tipos de saída (puros — sem I/O)
// ---------------------------------------------------------------------------

export interface OfferBreakdownItem {
  item: string
  amount: number
}

export interface CaseOfferQuote {
  basePrice: number
  riskSurcharge: number
  inspectionsIncluded: number
  extraInspectionCost: number
  totalPrice: number
  breakdown: OfferBreakdownItem[]
}

export interface CaseOfferView {
  planName: string
  planDescription: string | null
  quote: CaseOfferQuote
  narrativa: string | null
  beneficios: string[]
  prazo: string | null
  status: CaseStatus
  /** true quando a proposta ainda pode ser aceita (status COMMERCIAL_OFFER_SENT). */
  acceptable: boolean
  generatedAt: string
}

/** Status em que faz sentido exibir a proposta comercial ao morador. */
export const OFFER_VISIBLE_STATUSES: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  "COMMERCIAL_OFFER_SENT",
  "AWAITING_PAYMENT",
  "ASSIGNED_TO_PARTNER",
  "ART_RRT_PENDING",
  "INSPECTIONS_SCHEDULED",
  "IN_EXECUTION",
  "CONCLUDED",
])

// ---------------------------------------------------------------------------
// Assembler puro (testável sem I/O)
// ---------------------------------------------------------------------------

type RawQuote = Partial<CaseOfferQuote> & { breakdown?: unknown }
type RawOffer = { narrativa?: unknown; beneficios?: unknown; prazo?: unknown }

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function toBreakdown(raw: unknown): OfferBreakdownItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({ item: String(r.item ?? ""), amount: toNumber(r.amount) }))
    .filter((b) => b.item.length > 0)
}

/**
 * Monta a view da oferta a partir dos `details` do AuditLog
 * "commercial.quote.generated" e dos metadados do plano. Puro: sem I/O.
 */
export function assembleOffer(params: {
  auditDetails: Record<string, unknown> | null
  planName: string | null
  planDescription: string | null
  status: CaseStatus
  generatedAt: Date
}): CaseOfferView | null {
  const { auditDetails, planName, planDescription, status, generatedAt } = params
  if (!auditDetails) return null

  const rawQuote = (auditDetails.quote ?? {}) as RawQuote
  const rawOffer = (auditDetails.offer ?? {}) as RawOffer

  const quote: CaseOfferQuote = {
    basePrice: toNumber(rawQuote.basePrice),
    riskSurcharge: toNumber(rawQuote.riskSurcharge),
    inspectionsIncluded: toNumber(rawQuote.inspectionsIncluded),
    extraInspectionCost: toNumber(rawQuote.extraInspectionCost),
    totalPrice: toNumber(rawQuote.totalPrice),
    breakdown: toBreakdown(rawQuote.breakdown),
  }

  const beneficios = Array.isArray(rawOffer.beneficios)
    ? rawOffer.beneficios.map(String).filter(Boolean)
    : []

  return {
    planName: planName ?? String(auditDetails.planName ?? "Plano"),
    planDescription,
    quote,
    narrativa: typeof rawOffer.narrativa === "string" ? rawOffer.narrativa : null,
    beneficios,
    prazo: typeof rawOffer.prazo === "string" ? rawOffer.prazo : null,
    status,
    acceptable: status === "COMMERCIAL_OFFER_SENT",
    generatedAt: generatedAt.toISOString(),
  }
}
