import { describe, expect, it, vi, beforeEach } from "vitest"
import { BusinessRuleViolationError, NotFoundError } from "@/shared/errors/DomainError"
import type { ReformCase, CommercialPlan } from "@reformai/database"
import type { CommercialOfferOutput } from "../CommercialAgent"
import { QuoteCaseUseCase } from "../QuoteCaseUseCase"

// ---------------------------------------------------------------------------
// Fake helpers
// ---------------------------------------------------------------------------

function makeCase(overrides: Partial<ReformCase> = {}): ReformCase {
  return {
    id: "case-1",
    protocol: "CASE-001",
    tenantId: "tenant-1",
    condominiumId: "cond-1",
    unitId: "unit-1",
    clientId: "client-1",
    status: "SCOPE_CLASSIFIED",
    riskLevel: "LOW",
    requiresART: false,
    triageScore: 10,
    reformScope: { services: ["pintura"] },
    evaluationResult: { mandatoryInspection: false },
    partnerId: null,
    commercialPlanId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as ReformCase
}

function makePlan(overrides: Partial<CommercialPlan> = {}): CommercialPlan {
  return {
    id: "plan-1",
    tenantId: "tenant-1",
    name: "Plano Básico",
    description: "Para reformas simples",
    basePrice: 500,
    extraInspectionPrice: 150,
    includes: { inspections: 3 },
    active: true,
    ...overrides,
  } as unknown as CommercialPlan
}

const fakeAgentOutput: CommercialOfferOutput = {
  narrativa: "Proposta gerada pelo agente de teste.",
  beneficiosDestacados: ["Acompanhamento técnico", "Vistorias inclusas"],
  prazo: "Até 2 dias úteis",
}

// ---------------------------------------------------------------------------
// Fake implementations (manual mocks)
// ---------------------------------------------------------------------------

function makeFakeCaseRepo(reformCase: ReformCase | null) {
  return {
    findById: vi.fn().mockResolvedValue(reformCase),
    // other methods are not used in this use case
    create: vi.fn(),
    listByTenant: vi.fn(),
    applyScopeClassification: vi.fn(),
    appendMessage: vi.fn(),
    listMessages: vi.fn(),
  }
}

function makeFakeCommercialRepo(plan: CommercialPlan | null) {
  return {
    findPlanById: vi.fn().mockResolvedValue(plan),
    listPlans: vi.fn().mockResolvedValue([]),
  }
}

function makeFakeAgent(output: CommercialOfferOutput = fakeAgentOutput) {
  return {
    generateOffer: vi.fn().mockResolvedValue(output),
  }
}

// Mock prisma.$transaction to execute the callback with a fake tx
vi.mock("@/infrastructure/database/prisma", () => {
  const fakeTx = {
    reformCase: {
      update: vi.fn().mockResolvedValue({
        id: "case-1",
        status: "COMMERCIAL_OFFER_SENT",
        tenantId: "tenant-1",
        commercialPlanId: "plan-1",
      }),
    },
    caseTransitionLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  }

  return {
    prisma: {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof fakeTx) => unknown) => fn(fakeTx)),
    },
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("QuoteCaseUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("gera cotação com sucesso para caso em SCOPE_CLASSIFIED", async () => {
    const reformCase = makeCase()
    const plan = makePlan()
    const caseRepo = makeFakeCaseRepo(reformCase)
    const commercialRepo = makeFakeCommercialRepo(plan)
    const agent = makeFakeAgent()

    const useCase = new QuoteCaseUseCase(
      caseRepo as never,
      commercialRepo as never,
      agent as never,
    )

    const result = await useCase.execute({
      caseId: "case-1",
      tenantId: "tenant-1",
      planId: "plan-1",
      extraInspections: 0,
      triggeredBy: "user:client-1",
    })

    // Verifica que o repositório foi chamado com tenantId
    expect(caseRepo.findById).toHaveBeenCalledWith("case-1", "tenant-1")
    expect(commercialRepo.findPlanById).toHaveBeenCalledWith("plan-1", "tenant-1")

    // Verifica estrutura de retorno
    expect(result.quote).toBeDefined()
    expect(result.quote.totalPrice).toBe(500) // basePrice = 500, extras = 0
    expect(result.quote.inspectionsIncluded).toBeGreaterThanOrEqual(3)
    expect(result.narrativa).toBe(fakeAgentOutput.narrativa)
    expect(result.beneficios).toEqual(fakeAgentOutput.beneficiosDestacados)
    expect(result.prazo).toBe(fakeAgentOutput.prazo)

    // Agent foi chamado uma vez
    expect(agent.generateOffer).toHaveBeenCalledTimes(1)
  })

  it("lança BusinessRuleViolationError se caso não está em SCOPE_CLASSIFIED", async () => {
    const reformCase = makeCase({ status: "AWAITING_DOCUMENTS" })
    const caseRepo = makeFakeCaseRepo(reformCase)
    const commercialRepo = makeFakeCommercialRepo(makePlan())
    const agent = makeFakeAgent()

    const useCase = new QuoteCaseUseCase(
      caseRepo as never,
      commercialRepo as never,
      agent as never,
    )

    await expect(
      useCase.execute({
        caseId: "case-1",
        tenantId: "tenant-1",
        planId: "plan-1",
        triggeredBy: "user:admin",
      }),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError)

    // Agent não deve ser chamado
    expect(agent.generateOffer).not.toHaveBeenCalled()
  })

  it("lança NotFoundError se caso não existe", async () => {
    const caseRepo = makeFakeCaseRepo(null)
    const commercialRepo = makeFakeCommercialRepo(makePlan())
    const agent = makeFakeAgent()

    const useCase = new QuoteCaseUseCase(
      caseRepo as never,
      commercialRepo as never,
      agent as never,
    )

    await expect(
      useCase.execute({
        caseId: "case-inexistente",
        tenantId: "tenant-1",
        planId: "plan-1",
        triggeredBy: "user:admin",
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("lança NotFoundError se plano não existe", async () => {
    const reformCase = makeCase()
    const caseRepo = makeFakeCaseRepo(reformCase)
    const commercialRepo = makeFakeCommercialRepo(null) // plano não encontrado
    const agent = makeFakeAgent()

    const useCase = new QuoteCaseUseCase(
      caseRepo as never,
      commercialRepo as never,
      agent as never,
    )

    await expect(
      useCase.execute({
        caseId: "case-1",
        tenantId: "tenant-1",
        planId: "plan-inexistente",
        triggeredBy: "user:admin",
      }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it("calcula extraInspectionCost corretamente com vistorias extras", async () => {
    const reformCase = makeCase()
    const plan = makePlan({ extraInspectionPrice: 200 as unknown as import("@reformai/database").CommercialPlan["extraInspectionPrice"] })
    const caseRepo = makeFakeCaseRepo(reformCase)
    const commercialRepo = makeFakeCommercialRepo(plan)
    const agent = makeFakeAgent()

    const useCase = new QuoteCaseUseCase(
      caseRepo as never,
      commercialRepo as never,
      agent as never,
    )

    const result = await useCase.execute({
      caseId: "case-1",
      tenantId: "tenant-1",
      planId: "plan-1",
      extraInspections: 2,
      triggeredBy: "user:admin",
    })

    expect(result.quote.extraInspectionCost).toBe(400) // 2 × 200
    expect(result.quote.totalPrice).toBe(900) // 500 + 400
  })
})
