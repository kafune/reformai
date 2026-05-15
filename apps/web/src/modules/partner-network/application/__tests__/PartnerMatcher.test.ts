import { describe, expect, it } from "vitest"
import type { Partner } from "@reformai/database"
import { matchPartners } from "../../domain/PartnerMatcher"

function makePartner(overrides: Partial<Partner> & { id: string }): Partner {
  return {
    id: overrides.id,
    tenantId: overrides.tenantId ?? "tenant-1",
    userId: overrides.userId ?? `user-${overrides.id}`,
    creaNumber: overrides.creaNumber ?? "CREA-12345",
    type: overrides.type ?? "ENGINEER",
    specialties: overrides.specialties ?? [],
    cities: overrides.cities ?? ["São Paulo"],
    states: overrides.states ?? ["SP"],
    basePrice: overrides.basePrice ?? (10000 as unknown as Partner["basePrice"]),
    rating: overrides.rating ?? null,
    slaHours: overrides.slaHours ?? null,
    active: overrides.active !== undefined ? overrides.active : true,
    createdAt: overrides.createdAt ?? new Date("2025-01-01"),
  } as unknown as Partner
}

const baseCriteria = {
  city: "São Paulo",
  state: "SP",
  servicesNeeded: [] as string[],
  riskLevel: "LOW" as const,
}

describe("PartnerMatcher", () => {
  it("(a) ordena por rating desc — maior rating primeiro", () => {
    const partners = [
      makePartner({ id: "p1", rating: 3.5 as unknown as Partner["rating"] }),
      makePartner({ id: "p2", rating: 4.8 as unknown as Partner["rating"] }),
      makePartner({ id: "p3", rating: 4.0 as unknown as Partner["rating"] }),
    ]

    const result = matchPartners(partners, baseCriteria)

    expect(result.map((p) => p.id)).toEqual(["p2", "p3", "p1"])
  })

  it("(b) filtro descarta parceiro inativo", () => {
    const partners = [
      makePartner({ id: "active", active: true }),
      makePartner({ id: "inactive", active: false }),
    ]

    const result = matchPartners(partners, baseCriteria)

    expect(result.map((p) => p.id)).toEqual(["active"])
  })

  it("(c) filtro descarta cidade não atendida", () => {
    const partners = [
      makePartner({ id: "sp", cities: ["São Paulo"] }),
      makePartner({ id: "rj", cities: ["Rio de Janeiro"] }),
    ]

    const result = matchPartners(partners, { ...baseCriteria, city: "São Paulo" })

    expect(result.map((p) => p.id)).toEqual(["sp"])
  })

  it("(d) '*' em cities atende qualquer cidade", () => {
    const partners = [
      makePartner({ id: "specific", cities: ["Campinas"] }),
      makePartner({ id: "wildcard", cities: ["*"] }),
    ]

    const result = matchPartners(partners, { ...baseCriteria, city: "São Paulo" })

    expect(result.map((p) => p.id)).toEqual(["wildcard"])
  })

  it("(e) HIGH risk prefere ENGINEER sobre ARCHITECT mesmo com rating menor", () => {
    const partners = [
      makePartner({
        id: "architect-high-rating",
        type: "ARCHITECT",
        rating: 5.0 as unknown as Partner["rating"],
      }),
      makePartner({
        id: "engineer-low-rating",
        type: "ENGINEER",
        rating: 3.0 as unknown as Partner["rating"],
      }),
    ]

    const result = matchPartners(partners, { ...baseCriteria, riskLevel: "HIGH" })

    expect(result[0]?.id).toBe("engineer-low-rating")
    expect(result[1]?.id).toBe("architect-high-rating")
  })

  it("(e) CRITICAL risk também prefere ENGINEER", () => {
    const partners = [
      makePartner({
        id: "architect",
        type: "ARCHITECT",
        rating: 4.9 as unknown as Partner["rating"],
      }),
      makePartner({
        id: "engineer",
        type: "ENGINEER",
        rating: 2.0 as unknown as Partner["rating"],
      }),
    ]

    const result = matchPartners(partners, { ...baseCriteria, riskLevel: "CRITICAL" })

    expect(result[0]?.id).toBe("engineer")
  })

  it("(f) servicesNeeded inclui 'gas' filtra somente quem tem specialty 'gas'", () => {
    const partners = [
      makePartner({ id: "with-gas", specialties: ["gas", "hidráulica"] }),
      makePartner({ id: "without-gas", specialties: ["elétrica", "pintura"] }),
    ]

    const result = matchPartners(partners, {
      ...baseCriteria,
      servicesNeeded: ["gas", "elétrica"],
    })

    expect(result.map((p) => p.id)).toEqual(["with-gas"])
  })

  it("desempate por slaHours asc quando rating é igual", () => {
    const rating = 4.0 as unknown as Partner["rating"]
    const partners = [
      makePartner({ id: "slow", rating, slaHours: 72 }),
      makePartner({ id: "fast", rating, slaHours: 24 }),
      makePartner({ id: "medium", rating, slaHours: 48 }),
    ]

    const result = matchPartners(partners, baseCriteria)

    expect(result.map((p) => p.id)).toEqual(["fast", "medium", "slow"])
  })

  it("parceiro sem rating (null) recebe rating 0 para ordenação", () => {
    const partners = [
      makePartner({ id: "no-rating", rating: null }),
      makePartner({ id: "has-rating", rating: 1.0 as unknown as Partner["rating"] }),
    ]

    const result = matchPartners(partners, baseCriteria)

    expect(result[0]?.id).toBe("has-rating")
  })

  it("filtro descarta parceiro com estado não atendido", () => {
    const partners = [
      makePartner({ id: "sp-partner", states: ["SP"] }),
      makePartner({ id: "rj-partner", states: ["RJ"] }),
    ]

    const result = matchPartners(partners, { ...baseCriteria, state: "SP" })

    expect(result.map((p) => p.id)).toEqual(["sp-partner"])
  })

  it("'estrutural' em servicesNeeded filtra somente quem tem specialty estrutural", () => {
    const partners = [
      makePartner({ id: "with-struct", specialties: ["estrutural", "concreto"] }),
      makePartner({ id: "without-struct", specialties: ["pintura"] }),
    ]

    const result = matchPartners(partners, {
      ...baseCriteria,
      servicesNeeded: ["estrutural"],
    })

    expect(result.map((p) => p.id)).toEqual(["with-struct"])
  })
})
