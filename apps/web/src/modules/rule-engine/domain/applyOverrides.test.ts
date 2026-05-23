import { describe, expect, it } from "vitest"
import { applyOverrides } from "./applyOverrides"
import type { RuleData } from "./types"

function rule(id: string, riskDelta: number, extra: Partial<RuleData["action"]> = {}): RuleData {
  return {
    id,
    name: `Regra ${id}`,
    description: "desc",
    condition: { field: "services", operator: "contains", value: id },
    action: { riskDelta, ...extra },
    priority: 1,
    active: true,
  }
}

const RULES: RuleData[] = [rule("a", 10), rule("b", 30, { requiresART: true }), rule("c", 5)]

describe("applyOverrides", () => {
  it("retorna as regras intactas quando não há overrides", () => {
    expect(applyOverrides(RULES, null)).toEqual(RULES)
    expect(applyOverrides(RULES, undefined)).toEqual(RULES)
    expect(applyOverrides(RULES, {})).toEqual(RULES)
  })

  it("remove regras desabilitadas", () => {
    const out = applyOverrides(RULES, { disabledRuleIds: ["b"] })
    expect(out.map((r) => r.id)).toEqual(["a", "c"])
  })

  it("faz merge raso dos campos de ação por ruleId", () => {
    const out = applyOverrides(RULES, { ruleActions: { a: { riskDelta: 50, requiresHumanReview: true } } })
    const a = out.find((r) => r.id === "a")!
    expect(a.action.riskDelta).toBe(50)
    expect(a.action.requiresHumanReview).toBe(true)
    // demais regras inalteradas
    expect(out.find((r) => r.id === "b")!.action.requiresART).toBe(true)
  })

  it("não muta a entrada", () => {
    const snapshot = JSON.parse(JSON.stringify(RULES))
    applyOverrides(RULES, { disabledRuleIds: ["a"], ruleActions: { b: { riskDelta: 99 } } })
    expect(RULES).toEqual(snapshot)
  })
})
