import { describe, expect, it } from "vitest"
import {
  CaseStatus,
  InspectionStatus,
  InspectionType,
  type Inspection,
  type ReformCase,
} from "@reformai/database"
import { InspectionRules } from "../../domain/InspectionRules"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function makeEvaluation(
  overrides: Partial<PolicyEvaluationResult> = {},
): PolicyEvaluationResult {
  return {
    riskLevel: "LOW",
    triageScore: 5,
    requiresART: false,
    requiresHumanReview: false,
    mandatoryInspection: false,
    recommendedStatus: CaseStatus.ELIGIBLE_FOR_RELEASE,
    triggeredRules: [],
    ...overrides,
  }
}

function makeScope(overrides: Partial<ReformScope> = {}): ReformScope {
  return {
    services: ["Pintura simples"],
    areasAffected: ["sala"],
    workforceType: "proprio",
    affectsCommonAreas: false,
    affectsNeighbors: false,
    ...overrides,
  }
}

function makeCase(overrides: Partial<ReformCase> = {}): ReformCase {
  return {
    id: "case-1",
    protocol: "PROTO-001",
    tenantId: "tenant-1",
    condominiumId: "cond-1",
    unitId: "unit-1",
    clientId: "client-1",
    status: CaseStatus.ASSIGNED_TO_PARTNER,
    riskLevel: null,
    requiresART: null,
    triageScore: null,
    reformScope: null,
    evaluationResult: null,
    partnerId: "partner-1",
    commercialPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ReformCase
}

function makeInspection(overrides: Partial<Inspection> = {}): Inspection {
  return {
    id: "insp-1",
    caseId: "case-1",
    partnerId: "partner-1",
    tenantId: "tenant-1",
    type: InspectionType.INITIAL,
    scheduledAt: new Date(),
    completedAt: null,
    status: InspectionStatus.SCHEDULED,
    notes: null,
    photoKeys: [],
    reportId: null,
    extraCharge: null,
    ...overrides,
  } as unknown as Inspection
}

// ─── getRequiredInspectionTypes ────────────────────────────────────────────────

describe("InspectionRules.getRequiredInspectionTypes", () => {
  it("LOW risco sem mandatoryInspection → retorna [INITIAL, FINAL]", () => {
    const scope = makeScope()
    const evaluation = makeEvaluation({ riskLevel: "LOW", mandatoryInspection: false })

    const result = InspectionRules.getRequiredInspectionTypes(scope, evaluation)

    expect(result).toEqual([InspectionType.INITIAL, InspectionType.FINAL])
  })

  it("mandatoryInspection=true → inclui INTERMEDIATE entre INITIAL e FINAL", () => {
    const scope = makeScope({ services: ["Impermeabilização"] })
    const evaluation = makeEvaluation({ riskLevel: "MEDIUM", mandatoryInspection: true })

    const result = InspectionRules.getRequiredInspectionTypes(scope, evaluation)

    expect(result).toEqual([
      InspectionType.INITIAL,
      InspectionType.INTERMEDIATE,
      InspectionType.FINAL,
    ])
  })

  it("riskLevel CRITICAL → inclui CRITICAL_SYSTEM", () => {
    const scope = makeScope({ services: ["Impacto estrutural/prumadas"] })
    const evaluation = makeEvaluation({ riskLevel: "CRITICAL", mandatoryInspection: true })

    const result = InspectionRules.getRequiredInspectionTypes(scope, evaluation)

    expect(result).toEqual([
      InspectionType.INITIAL,
      InspectionType.INTERMEDIATE,
      InspectionType.CRITICAL_SYSTEM,
      InspectionType.FINAL,
    ])
  })

  it("riskLevel CRITICAL sem mandatoryInspection → inclui CRITICAL_SYSTEM mas não INTERMEDIATE", () => {
    const scope = makeScope()
    const evaluation = makeEvaluation({ riskLevel: "CRITICAL", mandatoryInspection: false })

    const result = InspectionRules.getRequiredInspectionTypes(scope, evaluation)

    expect(result).toEqual([
      InspectionType.INITIAL,
      InspectionType.CRITICAL_SYSTEM,
      InspectionType.FINAL,
    ])
  })
})

// ─── canScheduleInspection ─────────────────────────────────────────────────────

describe("InspectionRules.canScheduleInspection", () => {
  // INITIAL
  it("INITIAL: bloqueada quando caso está em DRAFT", () => {
    const reformCase = makeCase({ status: CaseStatus.DRAFT })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INITIAL,
      existingInspections: [],
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("INITIAL: permitida quando caso está em ASSIGNED_TO_PARTNER", () => {
    const reformCase = makeCase({ status: CaseStatus.ASSIGNED_TO_PARTNER })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INITIAL,
      existingInspections: [],
    })

    expect(result.allowed).toBe(true)
  })

  it("INITIAL: permitida quando caso está em ART_RRT_PENDING", () => {
    const reformCase = makeCase({ status: CaseStatus.ART_RRT_PENDING })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INITIAL,
      existingInspections: [],
    })

    expect(result.allowed).toBe(true)
  })

  it("INITIAL: permitida quando caso está em INSPECTIONS_SCHEDULED", () => {
    const reformCase = makeCase({ status: CaseStatus.INSPECTIONS_SCHEDULED })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INITIAL,
      existingInspections: [],
    })

    expect(result.allowed).toBe(true)
  })

  // INTERMEDIATE
  it("INTERMEDIATE: bloqueada sem INITIAL completada", () => {
    const reformCase = makeCase({ status: CaseStatus.INSPECTIONS_SCHEDULED })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INTERMEDIATE,
      existingInspections: [makeInspection({ type: InspectionType.INITIAL, status: InspectionStatus.SCHEDULED })],
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("INTERMEDIATE: permitida quando existe INITIAL com status COMPLETED", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.INTERMEDIATE,
      existingInspections: [
        makeInspection({
          type: InspectionType.INITIAL,
          status: InspectionStatus.COMPLETED,
        }),
      ],
    })

    expect(result.allowed).toBe(true)
  })

  // FINAL — Impermeabilização (REGRA CRÍTICA §13.5)
  it("FINAL: bloqueada quando services inclui 'Impermeabilização' e não há INTERMEDIATE completada", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const scope = makeScope({ services: ["Impermeabilização"] })

    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope,
      type: InspectionType.FINAL,
      existingInspections: [
        makeInspection({ type: InspectionType.INITIAL, status: InspectionStatus.COMPLETED }),
      ],
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBe(
      "Impermeabilização exige vistoria INTERMEDIATE antes da FINAL",
    )
  })

  it("FINAL: liberada quando services inclui 'Impermeabilização' E existe INTERMEDIATE COMPLETED", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const scope = makeScope({ services: ["Impermeabilização"] })

    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope,
      type: InspectionType.FINAL,
      existingInspections: [
        makeInspection({
          id: "insp-initial",
          type: InspectionType.INITIAL,
          status: InspectionStatus.COMPLETED,
        }),
        makeInspection({
          id: "insp-intermediate",
          type: InspectionType.INTERMEDIATE,
          status: InspectionStatus.COMPLETED,
        }),
      ],
    })

    expect(result.allowed).toBe(true)
  })

  it("FINAL: bloqueada quando existe INTERMEDIATE pendente (geral)", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const scope = makeScope({ services: ["Elétrica"] })

    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope,
      type: InspectionType.FINAL,
      existingInspections: [
        makeInspection({ type: InspectionType.INITIAL, status: InspectionStatus.COMPLETED }),
        makeInspection({
          id: "insp-2",
          type: InspectionType.INTERMEDIATE,
          status: InspectionStatus.SCHEDULED,
        }),
      ],
    })

    expect(result.allowed).toBe(false)
  })

  it("FINAL: liberada sem INTERMEDIATE quando scope não tem Impermeabilização", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const scope = makeScope({ services: ["Pintura simples"] })

    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope,
      type: InspectionType.FINAL,
      existingInspections: [
        makeInspection({ type: InspectionType.INITIAL, status: InspectionStatus.COMPLETED }),
      ],
    })

    expect(result.allowed).toBe(true)
  })

  // CRITICAL_SYSTEM
  it("CRITICAL_SYSTEM: bloqueada quando caso não está em IN_EXECUTION", () => {
    const reformCase = makeCase({ status: CaseStatus.INSPECTIONS_SCHEDULED })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.CRITICAL_SYSTEM,
      existingInspections: [],
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it("CRITICAL_SYSTEM: permitida quando caso está em IN_EXECUTION", () => {
    const reformCase = makeCase({ status: CaseStatus.IN_EXECUTION })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.CRITICAL_SYSTEM,
      existingInspections: [],
    })

    expect(result.allowed).toBe(true)
  })

  // EXTRA
  it("EXTRA: bloqueada em estados anteriores a ASSIGNED_TO_PARTNER", () => {
    const reformCase = makeCase({ status: CaseStatus.AWAITING_DOCUMENTS })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.EXTRA,
      existingInspections: [],
    })

    expect(result.allowed).toBe(false)
  })

  it("EXTRA: permitida em ASSIGNED_TO_PARTNER", () => {
    const reformCase = makeCase({ status: CaseStatus.ASSIGNED_TO_PARTNER })
    const result = InspectionRules.canScheduleInspection({
      reformCase,
      scope: makeScope(),
      type: InspectionType.EXTRA,
      existingInspections: [],
    })

    expect(result.allowed).toBe(true)
  })
})
