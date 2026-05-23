import type { CommercialPlan, RiskLevel } from "@reformai/database"

export interface PriceCalculatorInput {
  plan: CommercialPlan
  riskLevel: RiskLevel
  mandatoryInspection: boolean
  extraInspections: number
}

export interface PriceBreakdownItem {
  item: string
  amount: number
}

export interface PriceCalculatorOutput {
  basePrice: number
  riskSurcharge: number
  inspectionsIncluded: number
  extraInspectionCost: number
  totalPrice: number
  breakdown: PriceBreakdownItem[]
}

/**
 * Sobretaxa de risco sobre o preço base — obras mais complexas demandam mais
 * acompanhamento técnico. Decisão de produto: ajuste as taxas aqui.
 * LOW/MEDIUM sem sobretaxa; HIGH/CRITICAL com sobretaxa.
 */
const RISK_SURCHARGE_RATE: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 0,
  HIGH: 0.15,
  CRITICAL: 0.3,
}

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "baixo",
  MEDIUM: "médio",
  HIGH: "alto",
  CRITICAL: "crítico",
}

/**
 * PriceCalculator — domain pure function, no I/O, no AI.
 *
 * CLAUDE.md §13 rule 6: commercial plan includes minimum 3 inspections.
 * Extra inspections are charged at plan.extraInspectionPrice each.
 * mandatoryInspection=true exige ao menos 1 vistoria, já coberta pelas 3
 * inclusas — não adiciona custo, mas garante o mínimo.
 * riskLevel aplica uma sobretaxa percentual sobre o preço base.
 */
export function calculatePrice(input: PriceCalculatorInput): PriceCalculatorOutput {
  const { plan, extraInspections, riskLevel, mandatoryInspection } = input

  const basePrice = Number(plan.basePrice)
  const extraInspectionUnitPrice = Number(plan.extraInspectionPrice)

  // Mínimo de 3 vistorias inclusas (CLAUDE.md §13 regra 6); a vistoria
  // obrigatória é garantida por esse mínimo.
  const planIncludes = (plan.includes as Record<string, unknown>)?.inspections
  const baseIncluded = Math.max(3, typeof planIncludes === "number" ? planIncludes : 3)
  const inspectionsIncluded = mandatoryInspection ? Math.max(1, baseIncluded) : baseIncluded

  const surchargeRate = RISK_SURCHARGE_RATE[riskLevel] ?? 0
  const riskSurcharge = Math.round(basePrice * surchargeRate * 100) / 100

  const safeExtraInspections = Math.max(0, Math.floor(extraInspections))
  const extraInspectionCost = safeExtraInspections * extraInspectionUnitPrice

  const totalPrice = basePrice + riskSurcharge + extraInspectionCost

  const breakdown: PriceBreakdownItem[] = [
    { item: `Plano base — ${plan.name}`, amount: basePrice },
  ]

  if (riskSurcharge > 0) {
    breakdown.push({
      item: `Sobretaxa de risco ${RISK_LABEL[riskLevel]} (+${Math.round(surchargeRate * 100)}%)`,
      amount: riskSurcharge,
    })
  }

  if (safeExtraInspections > 0) {
    breakdown.push({
      item: `Vistorias extras (${safeExtraInspections} × R$ ${extraInspectionUnitPrice.toFixed(2)})`,
      amount: extraInspectionCost,
    })
  }

  breakdown.push({ item: "Total", amount: totalPrice })

  return {
    basePrice,
    riskSurcharge,
    inspectionsIncluded,
    extraInspectionCost,
    totalPrice,
    breakdown,
  }
}
