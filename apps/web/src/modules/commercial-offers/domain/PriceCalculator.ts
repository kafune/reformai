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
  inspectionsIncluded: number
  extraInspectionCost: number
  totalPrice: number
  breakdown: PriceBreakdownItem[]
}

/**
 * PriceCalculator — domain pure function, no I/O, no AI.
 *
 * CLAUDE.md §13 rule 6: commercial plan includes minimum 3 inspections.
 * Extra inspections are charged at plan.extraInspectionPrice each.
 * mandatoryInspection=true means at least 1 inspection is required;
 * it is already covered by the 3 included inspections.
 */
export function calculatePrice(input: PriceCalculatorInput): PriceCalculatorOutput {
  const { plan, extraInspections } = input

  const basePrice = Number(plan.basePrice)
  const extraInspectionUnitPrice = Number(plan.extraInspectionPrice)

  // Minimum 3 inspections included (CLAUDE.md §13 rule 6)
  const planIncludes = (plan.includes as Record<string, unknown>)?.inspections
  const inspectionsIncluded = Math.max(3, typeof planIncludes === "number" ? planIncludes : 3)

  const safeExtraInspections = Math.max(0, Math.floor(extraInspections))
  const extraInspectionCost = safeExtraInspections * extraInspectionUnitPrice

  const totalPrice = basePrice + extraInspectionCost

  const breakdown: PriceBreakdownItem[] = [
    { item: `Plano base — ${plan.name}`, amount: basePrice },
  ]

  if (safeExtraInspections > 0) {
    breakdown.push({
      item: `Vistorias extras (${safeExtraInspections} × R$ ${extraInspectionUnitPrice.toFixed(2)})`,
      amount: extraInspectionCost,
    })
  }

  breakdown.push({ item: "Total", amount: totalPrice })

  return {
    basePrice,
    inspectionsIncluded,
    extraInspectionCost,
    totalPrice,
    breakdown,
  }
}
