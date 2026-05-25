import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReviewPartnerUseCase } from "../ReviewPartnerUseCase"
import { BusinessRuleViolationError, ForbiddenError, NotFoundError, ValidationError } from "@/shared/errors/DomainError"

// ─── Mock prisma ───────────────────────────────────────────────────────────

const mockFindFirst = vi.fn()
const mockFindUnique = vi.fn()
const mockAggregate = vi.fn()
const mockTransaction = vi.fn()

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    reformCase: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    partnerReview: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      aggregate: (...args: unknown[]) => mockAggregate(...args),
    },
    $transaction: (fn: (tx: unknown) => unknown) => mockTransaction(fn),
  },
}))

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    tenantId: "tenant-1",
    status: "CONCLUDED",
    clientId: "client-1",
    partnerId: "partner-1",
    ...overrides,
  }
}

const BASE_INPUT = {
  caseId: "case-1",
  clientId: "client-1",
  tenantId: "tenant-1",
  score: 4,
  comment: "Ótimo profissional",
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ReviewPartnerUseCase", () => {
  let useCase: ReviewPartnerUseCase

  beforeEach(() => {
    useCase = new ReviewPartnerUseCase()
    vi.clearAllMocks()
  })

  it("(a) lança ValidationError se score for 0", async () => {
    await expect(
      useCase.execute({ ...BASE_INPUT, score: 0 }),
    ).rejects.toThrow(ValidationError)
  })

  it("(b) lança ValidationError se score for 6", async () => {
    await expect(
      useCase.execute({ ...BASE_INPUT, score: 6 }),
    ).rejects.toThrow(ValidationError)
  })

  it("(c) lança ValidationError se comentário tiver mais de 500 chars", async () => {
    await expect(
      useCase.execute({ ...BASE_INPUT, comment: "a".repeat(501) }),
    ).rejects.toThrow(ValidationError)
  })

  it("(d) lança NotFoundError se o caso não existir", async () => {
    mockFindFirst.mockResolvedValue(null)
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(NotFoundError)
  })

  it("(e) lança BusinessRuleViolationError se caso não estiver CONCLUDED", async () => {
    mockFindFirst.mockResolvedValue(makeCase({ status: "IN_EXECUTION" }))
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(BusinessRuleViolationError)
  })

  it("(f) lança ForbiddenError se clientId não for dono do caso", async () => {
    mockFindFirst.mockResolvedValue(makeCase({ clientId: "outro-client" }))
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(ForbiddenError)
  })

  it("(g) lança BusinessRuleViolationError se caso não tiver parceiro", async () => {
    mockFindFirst.mockResolvedValue(makeCase({ partnerId: null }))
    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(BusinessRuleViolationError)
  })

  it("(h) lança BusinessRuleViolationError se já existir review para o caseId", async () => {
    mockFindFirst.mockResolvedValue(makeCase())
    mockFindUnique.mockResolvedValue({ id: "review-existing" })

    await expect(useCase.execute(BASE_INPUT)).rejects.toThrow(BusinessRuleViolationError)
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { caseId: "case-1" } })
  })

  it("(i) executa transação com create de review, recalcula rating e grava AuditLog", async () => {
    mockFindFirst.mockResolvedValue(makeCase())
    mockFindUnique.mockResolvedValue(null) // no existing review

    // Simulate transaction calling inner fn
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const txMock = {
        partnerReview: {
          create: vi.fn().mockResolvedValue({}),
          aggregate: vi.fn().mockResolvedValue({ _avg: { score: 4.5 } }),
        },
        partner: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
      // Verify inner calls
      expect(txMock.partnerReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            partnerId: "partner-1",
            caseId: "case-1",
            clientId: "client-1",
            score: 4,
          }),
        }),
      )
      expect(txMock.partner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "partner-1" },
          data: { rating: 4.5 },
        }),
      )
      expect(txMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "partner.reviewed",
            triggeredBy: "user:client-1",
          }),
        }),
      )
    })

    await expect(useCase.execute(BASE_INPUT)).resolves.toBeUndefined()
    expect(mockTransaction).toHaveBeenCalledOnce()
  })

  it("(j) usa o score atual como fallback de rating quando aggregate retorna null", async () => {
    mockFindFirst.mockResolvedValue(makeCase())
    mockFindUnique.mockResolvedValue(null)

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
      const txMock = {
        partnerReview: {
          create: vi.fn().mockResolvedValue({}),
          aggregate: vi.fn().mockResolvedValue({ _avg: { score: null } }),
        },
        partner: { update: vi.fn().mockResolvedValue({}) },
        auditLog: { create: vi.fn().mockResolvedValue({}) },
      }
      await fn(txMock)
      // When aggregate returns null avg, uses the submitted score as fallback
      expect(txMock.partner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { rating: 4 }, // falls back to score
        }),
      )
    })

    await expect(useCase.execute(BASE_INPUT)).resolves.toBeUndefined()
  })

  it("(k) aceita avaliação sem comentário", async () => {
    mockFindFirst.mockResolvedValue(makeCase())
    mockFindUnique.mockResolvedValue(null)
    mockTransaction.mockResolvedValue(undefined)

    const inputWithoutComment = { ...BASE_INPUT, comment: undefined }
    await expect(useCase.execute(inputWithoutComment)).resolves.toBeUndefined()
  })
})
