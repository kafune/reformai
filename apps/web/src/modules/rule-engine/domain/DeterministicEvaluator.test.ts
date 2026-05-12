import { describe, expect, it } from "vitest"
import { DeterministicEvaluator } from "./DeterministicEvaluator"
import type { PolicyData } from "./types"

const policy: PolicyData = {
  id: "p1",
  tenantId: null,
  name: "Padrão",
  version: 1,
  active: true,
  rules: [
    {
      id: "r-pintura",
      name: "Pintura",
      description: "Pintura simples adiciona 5",
      condition: { field: "services", operator: "contains", value: "Pintura simples" },
      action: { riskDelta: 5 },
      priority: 10,
      active: true,
    },
    {
      id: "r-eletrica",
      name: "Elétrica",
      description: "Elétrica adiciona 30 e exige ART",
      condition: { field: "services", operator: "contains", value: "Elétrica" },
      action: { riskDelta: 30, requiresART: true },
      priority: 20,
      active: true,
    },
    {
      id: "r-estrutura",
      name: "Impacto estrutural",
      description: "Impacto estrutural exige revisão humana",
      condition: { field: "services", operator: "contains", value: "Impacto estrutural/prumadas" },
      action: { riskDelta: 60, requiresART: true, requiresHumanReview: true, mandatoryInspection: true },
      priority: 1,
      active: true,
    },
  ],
}

const baseScope = {
  areasAffected: [] as string[],
  workforceType: "indefinido" as const,
  affectsCommonAreas: false,
  affectsNeighbors: false,
}

describe("DeterministicEvaluator", () => {
  const evaluator = new DeterministicEvaluator()

  it("classifica caso simples como LOW", () => {
    const r = evaluator.evaluate({ ...baseScope, services: ["Pintura simples"] }, policy)
    expect(r.riskLevel).toBe("LOW")
    expect(r.requiresART).toBe(false)
    expect(r.recommendedStatus).toBe("SCOPE_CLASSIFIED")
  })

  it("acumula score com múltiplos serviços", () => {
    const r = evaluator.evaluate(
      { ...baseScope, services: ["Pintura simples", "Elétrica"] },
      policy,
    )
    expect(r.triageScore).toBe(35)
    expect(r.riskLevel).toBe("MEDIUM")
    expect(r.requiresART).toBe(true)
  })

  it("recomenda HUMAN_REVIEW_REQUIRED para impacto estrutural", () => {
    const r = evaluator.evaluate(
      { ...baseScope, services: ["Impacto estrutural/prumadas"] },
      policy,
    )
    expect(r.requiresHumanReview).toBe(true)
    expect(r.recommendedStatus).toBe("HUMAN_REVIEW_REQUIRED")
    expect(r.riskLevel).toBe("HIGH")
  })
})
