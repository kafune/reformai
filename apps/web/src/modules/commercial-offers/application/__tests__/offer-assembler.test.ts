import { describe, expect, it } from "vitest"
import { assembleOffer, OFFER_VISIBLE_STATUSES } from "../offer-assembler"

const baseDetails = {
  planId: "plan-1",
  planName: "Plano Essencial",
  quote: {
    basePrice: 500,
    riskSurcharge: 75,
    inspectionsIncluded: 3,
    extraInspectionCost: 0,
    totalPrice: 575,
    breakdown: [
      { item: "Plano base — Essencial", amount: 500 },
      { item: "Sobretaxa de risco alto (+15%)", amount: 75 },
      { item: "Total", amount: 575 },
    ],
  },
  offer: {
    narrativa: "Proposta sob medida para sua reforma.",
    beneficios: ["Acompanhamento técnico", "3 vistorias inclusas"],
    prazo: "Até 2 dias úteis",
  },
}

describe("assembleOffer", () => {
  it("retorna null sem auditDetails", () => {
    const result = assembleOffer({
      auditDetails: null,
      planName: "X",
      planDescription: null,
      status: "COMMERCIAL_OFFER_SENT",
      generatedAt: new Date("2026-06-29T12:00:00Z"),
    })
    expect(result).toBeNull()
  })

  it("monta a oferta completa a partir do AuditLog", () => {
    const result = assembleOffer({
      auditDetails: baseDetails,
      planName: "Plano Essencial",
      planDescription: "Cobertura básica",
      status: "COMMERCIAL_OFFER_SENT",
      generatedAt: new Date("2026-06-29T12:00:00Z"),
    })
    expect(result).not.toBeNull()
    expect(result!.planName).toBe("Plano Essencial")
    expect(result!.planDescription).toBe("Cobertura básica")
    expect(result!.quote.totalPrice).toBe(575)
    expect(result!.quote.breakdown).toHaveLength(3)
    expect(result!.narrativa).toBe("Proposta sob medida para sua reforma.")
    expect(result!.beneficios).toEqual(["Acompanhamento técnico", "3 vistorias inclusas"])
    expect(result!.prazo).toBe("Até 2 dias úteis")
  })

  it("marca acceptable=true apenas em COMMERCIAL_OFFER_SENT", () => {
    const sent = assembleOffer({
      auditDetails: baseDetails,
      planName: "P",
      planDescription: null,
      status: "COMMERCIAL_OFFER_SENT",
      generatedAt: new Date(),
    })
    const paying = assembleOffer({
      auditDetails: baseDetails,
      planName: "P",
      planDescription: null,
      status: "AWAITING_PAYMENT",
      generatedAt: new Date(),
    })
    expect(sent!.acceptable).toBe(true)
    expect(paying!.acceptable).toBe(false)
  })

  it("é resiliente a quote/offer ausentes ou malformados", () => {
    const result = assembleOffer({
      auditDetails: { planName: "Só nome" },
      planName: null,
      planDescription: null,
      status: "AWAITING_PAYMENT",
      generatedAt: new Date(),
    })
    expect(result).not.toBeNull()
    expect(result!.planName).toBe("Só nome")
    expect(result!.quote.totalPrice).toBe(0)
    expect(result!.quote.breakdown).toEqual([])
    expect(result!.beneficios).toEqual([])
    expect(result!.narrativa).toBeNull()
  })

  it("coage valores numéricos vindos como string", () => {
    const result = assembleOffer({
      auditDetails: {
        quote: { totalPrice: "999.5", breakdown: [{ item: "Total", amount: "999.5" }] },
      },
      planName: "P",
      planDescription: null,
      status: "CONCLUDED",
      generatedAt: new Date(),
    })
    expect(result!.quote.totalPrice).toBe(999.5)
    expect(result!.quote.breakdown[0]).toEqual({ item: "Total", amount: 999.5 })
  })

  it("considera os status corretos como visíveis", () => {
    expect(OFFER_VISIBLE_STATUSES.has("COMMERCIAL_OFFER_SENT")).toBe(true)
    expect(OFFER_VISIBLE_STATUSES.has("SCOPE_CLASSIFIED")).toBe(false)
    expect(OFFER_VISIBLE_STATUSES.has("DRAFT")).toBe(false)
  })
})
