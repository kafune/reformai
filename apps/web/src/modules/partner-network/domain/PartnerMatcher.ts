import type { Partner, RiskLevel } from "@reformai/database"

export interface MatchCriteria {
  city: string
  state: string
  servicesNeeded: string[]
  riskLevel: RiskLevel
}

const GAS_KEYWORDS = ["gas", "gás"]
const STRUCTURAL_KEYWORDS = ["estrutural", "estrutura", "prumada", "prumadas"]

function needsGas(services: string[]): boolean {
  return services.some((s) =>
    GAS_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)),
  )
}

function needsStructural(services: string[]): boolean {
  return services.some((s) =>
    STRUCTURAL_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)),
  )
}

function toNumber(value: { toString(): string } | null | undefined, fallback: number): number {
  if (value == null) return fallback
  const n = Number(value.toString())
  return isNaN(n) ? fallback : n
}

/**
 * Pure domain function — no DB, no AI.
 * Filters and sorts partners by compatibility with the given criteria.
 */
export function matchPartners(
  partners: Partner[],
  criteria: MatchCriteria,
): Partner[] {
  const { city, state, servicesNeeded, riskLevel } = criteria
  const requiresGas = needsGas(servicesNeeded)
  const requiresStructural = needsStructural(servicesNeeded)

  const filtered = partners.filter((p) => {
    // (a) must be active
    if (!p.active) return false

    // (b) state must match
    if (!p.states.includes(state)) return false

    // (c) city must match or wildcard
    if (!p.cities.includes(city) && !p.cities.includes("*")) return false

    // (d) specialty filters for gas/structural services
    if (requiresGas && !p.specialties.some((s) => GAS_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)))) {
      return false
    }
    if (requiresStructural && !p.specialties.some((s) => STRUCTURAL_KEYWORDS.some((kw) => s.toLowerCase().includes(kw)))) {
      return false
    }

    return true
  })

  const isHighRisk = riskLevel === "HIGH" || riskLevel === "CRITICAL"

  return filtered.sort((a, b) => {
    if (isHighRisk) {
      // Engineers first
      const aIsEngineer = a.type === "ENGINEER" ? 0 : 1
      const bIsEngineer = b.type === "ENGINEER" ? 0 : 1
      if (aIsEngineer !== bIsEngineer) return aIsEngineer - bIsEngineer
    }

    // Rating descending (null → 0)
    const ratingA = toNumber(a.rating, 0)
    const ratingB = toNumber(b.rating, 0)
    if (ratingB !== ratingA) return ratingB - ratingA

    // SLA hours ascending (null → Infinity)
    const slaA = a.slaHours ?? Infinity
    const slaB = b.slaHours ?? Infinity
    return slaA - slaB
  })
}
