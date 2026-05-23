import { describe, expect, it } from "vitest"
import { calculatePrice } from "../../domain/PriceCalculator"
import type { PriceCalculatorInput } from "../../domain/PriceCalculator"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a CommercialPlan-like object with the necessary fields.
 * We use a plain object to avoid importing Prisma.Decimal —
 * Number(plan.basePrice) handles both numbers and Decimal-like objects.
 */
function makePlan(overrides: {
  basePrice?: number | string
  extraInspectionPrice?: number | string
  inspectionsIncludes?: number | null
  name?: string
}) {
  return {
    id: "plan-1",
    tenantId: "tenant-1",
    name: overrides.name ?? "Plano Básico",
    description: "Plano de teste",
    basePrice: overrides.basePrice ?? 500,
    extraInspectionPrice: overrides.extraInspectionPrice ?? 150,
    includes:
      overrides.inspectionsIncludes !== undefined
        ? { inspections: overrides.inspectionsIncludes }
        : null,
    active: true,
  } as unknown as import("@reformai/database").CommercialPlan
}

function makeInput(
  overrides: Partial<PriceCalculatorInput> & {
    basePrice?: number
    extraInspectionPrice?: number
    inspectionsIncludes?: number | null
  },
): PriceCalculatorInput {
  return {
    plan: makePlan({
      basePrice: overrides.basePrice ?? 500,
      extraInspectionPrice: overrides.extraInspectionPrice ?? 150,
      inspectionsIncludes: overrides.inspectionsIncludes,
    }),
    riskLevel: overrides.riskLevel ?? "LOW",
    mandatoryInspection: overrides.mandatoryInspection ?? false,
    extraInspections: overrides.extraInspections ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PriceCalculator", () => {
  describe("inspectionsIncluded — mínimo de 3 (CLAUDE.md §13 regra 6)", () => {
    it("retorna 3 vistorias quando o plano não especifica inclusions", () => {
      const result = calculatePrice(makeInput({ inspectionsIncludes: null }))
      expect(result.inspectionsIncluded).toBe(3)
    })

    it("retorna 3 vistorias quando o plano especifica 0", () => {
      const result = calculatePrice(makeInput({ inspectionsIncludes: 0 }))
      expect(result.inspectionsIncluded).toBe(3)
    })

    it("retorna 3 vistorias quando o plano especifica 1", () => {
      const result = calculatePrice(makeInput({ inspectionsIncludes: 1 }))
      expect(result.inspectionsIncluded).toBe(3)
    })

    it("retorna 3 vistorias quando o plano especifica 3", () => {
      const result = calculatePrice(makeInput({ inspectionsIncludes: 3 }))
      expect(result.inspectionsIncluded).toBe(3)
    })

    it("retorna 5 vistorias quando o plano especifica 5 (acima do mínimo)", () => {
      const result = calculatePrice(makeInput({ inspectionsIncludes: 5 }))
      expect(result.inspectionsIncluded).toBe(5)
    })
  })

  describe("0 vistorias extras", () => {
    it("totalPrice é igual ao basePrice", () => {
      const result = calculatePrice(makeInput({ extraInspections: 0 }))
      expect(result.extraInspectionCost).toBe(0)
      expect(result.totalPrice).toBe(500)
      expect(result.basePrice).toBe(500)
    })

    it("breakdown contém apenas o plano base e o total", () => {
      const result = calculatePrice(makeInput({ extraInspections: 0 }))
      // Should be: [plano base, total] — no extra line
      expect(result.breakdown).toHaveLength(2)
      expect(result.breakdown.at(0)?.amount).toBe(500)
      expect(result.breakdown.at(-1)?.item).toBe("Total")
    })
  })

  describe("1 vistoria extra", () => {
    it("calcula extraInspectionCost corretamente", () => {
      const result = calculatePrice(
        makeInput({ extraInspections: 1, extraInspectionPrice: 150 }),
      )
      expect(result.extraInspectionCost).toBe(150)
      expect(result.totalPrice).toBe(650)
    })

    it("breakdown lista a linha de vistorias extras", () => {
      const result = calculatePrice(
        makeInput({ extraInspections: 1, extraInspectionPrice: 150 }),
      )
      // [plano base, extras, total]
      expect(result.breakdown).toHaveLength(3)
    })
  })

  describe("3 vistorias extras", () => {
    it("calcula extraInspectionCost = 3 × extraInspectionPrice", () => {
      const result = calculatePrice(
        makeInput({ extraInspections: 3, extraInspectionPrice: 200, basePrice: 1000 }),
      )
      expect(result.extraInspectionCost).toBe(600)
      expect(result.totalPrice).toBe(1600)
    })
  })

  describe("mandatoryInspection=true", () => {
    it("não altera o preço (vistoria obrigatória já coberta pelas 3 inclusas)", () => {
      const sem = calculatePrice(makeInput({ mandatoryInspection: false, extraInspections: 0 }))
      const com = calculatePrice(makeInput({ mandatoryInspection: true, extraInspections: 0 }))
      expect(com.totalPrice).toBe(sem.totalPrice)
      expect(com.inspectionsIncluded).toBe(sem.inspectionsIncluded)
    })
  })

  describe("riskLevel — sobretaxa de risco", () => {
    it("LOW e MEDIUM não têm sobretaxa", () => {
      const low = calculatePrice(makeInput({ riskLevel: "LOW", basePrice: 1000 }))
      const medium = calculatePrice(makeInput({ riskLevel: "MEDIUM", basePrice: 1000 }))
      expect(low.riskSurcharge).toBe(0)
      expect(medium.riskSurcharge).toBe(0)
      expect(low.totalPrice).toBe(1000)
    })

    it("HIGH adiciona +15% sobre o preço base", () => {
      const r = calculatePrice(makeInput({ riskLevel: "HIGH", basePrice: 1000 }))
      expect(r.riskSurcharge).toBe(150)
      expect(r.totalPrice).toBe(1150)
    })

    it("CRITICAL adiciona +30% sobre o preço base", () => {
      const r = calculatePrice(makeInput({ riskLevel: "CRITICAL", basePrice: 1000 }))
      expect(r.riskSurcharge).toBe(300)
      expect(r.totalPrice).toBe(1300)
    })

    it("sobretaxa entra no breakdown e soma com vistorias extras", () => {
      const r = calculatePrice(
        makeInput({ riskLevel: "HIGH", basePrice: 1000, extraInspections: 2, extraInspectionPrice: 100 }),
      )
      // base 1000 + risco 150 + extras 200 = 1350
      expect(r.totalPrice).toBe(1350)
      // [base, sobretaxa, extras, total]
      expect(r.breakdown).toHaveLength(4)
    })
  })

  describe("valores negativos de extraInspections são normalizados para 0", () => {
    it("trata -1 como 0 extras", () => {
      const result = calculatePrice(makeInput({ extraInspections: -1 }))
      expect(result.extraInspectionCost).toBe(0)
      expect(result.totalPrice).toBe(500)
    })
  })
})
