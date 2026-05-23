import type { PolicyOverrides, RuleData } from "./types"

/**
 * Aplica os overrides de um condomínio sobre as regras da política resolvida.
 * Função pura: não consulta banco nem muta a entrada.
 *  - disabledRuleIds: remove (desativa) as regras indicadas
 *  - ruleActions: faz merge raso dos campos de ação por ruleId
 */
export function applyOverrides(rules: RuleData[], overrides?: PolicyOverrides | null): RuleData[] {
  if (!overrides) return rules

  const disabled = new Set(overrides.disabledRuleIds ?? [])
  const actionPatches = overrides.ruleActions ?? {}

  return rules
    .filter((rule) => !disabled.has(rule.id))
    .map((rule) => {
      const patch = actionPatches[rule.id]
      if (!patch) return rule
      return { ...rule, action: { ...rule.action, ...patch } }
    })
}
