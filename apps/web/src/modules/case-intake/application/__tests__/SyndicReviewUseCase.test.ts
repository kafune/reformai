/**
 * Testes para SyndicReviewUseCase
 *
 * Usa vi.mock para isolar o Prisma e o CaseNotificationService.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { SyndicReviewUseCase } from "../SyndicReviewUseCase"
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/DomainError"

// ---------------------------------------------------------------------------
// Mock: prisma
// ---------------------------------------------------------------------------

const mockTransaction = vi.fn()
const mockReformCaseFindFirst = vi.fn()
const mockUserFindUnique = vi.fn()

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    reformCase: {
      findFirst: (...args: unknown[]) => mockReformCaseFindFirst(...args),
      update: vi.fn(),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    caseTransitionLog: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

// ---------------------------------------------------------------------------
// Mock: CaseNotificationService
// ---------------------------------------------------------------------------

vi.mock("../CaseNotificationService", () => ({
  getCaseNotificationService: () => ({
    onTransition: vi.fn().mockResolvedValue(undefined),
  }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    protocol: "RF-TEST-001",
    tenantId: "tenant-1",
    condominiumId: "condo-1",
    clientId: "client-1",
    status: "AWAITING_SYNDIC_APPROVAL",
    riskLevel: "LOW",
    ...overrides,
  }
}

function makeSyndic(overrides: Record<string, unknown> = {}) {
  return {
    id: "syndic-1",
    role: "CONDOMINIUM",
    condominiumId: "condo-1",
    name: "Síndico Teste",
    tenantId: "tenant-1",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SyndicReviewUseCase", () => {
  let useCase: SyndicReviewUseCase

  beforeEach(() => {
    useCase = new SyndicReviewUseCase()
    vi.clearAllMocks()

    // Por padrão, $transaction executa os itens do array (operações Prisma)
    mockTransaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
  })

  // ── approve ──────────────────────────────────────────────────────────────

  describe("approve", () => {
    it("transiciona para AWAITING_DOCUMENTS quando aprovado com sucesso", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.approve({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
        }),
      ).resolves.toBeUndefined()

      expect(mockTransaction).toHaveBeenCalledOnce()
    })

    it("inclui o comentário opcional no log de transição", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await useCase.approve({
        caseId: "case-1",
        syndicId: "syndic-1",
        tenantId: "tenant-1",
        comment: "Aprovado — obra simples sem impacto estrutural",
      })

      expect(mockTransaction).toHaveBeenCalledOnce()
    })

    it("lança NotFoundError quando caso não existe", async () => {
      mockReformCaseFindFirst.mockResolvedValue(null)
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.approve({ caseId: "nao-existe", syndicId: "syndic-1", tenantId: "tenant-1" }),
      ).rejects.toThrow(NotFoundError)
    })

    it("lança NotFoundError quando usuário não existe", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(null)

      await expect(
        useCase.approve({ caseId: "case-1", syndicId: "nao-existe", tenantId: "tenant-1" }),
      ).rejects.toThrow(NotFoundError)
    })

    it("lança ForbiddenError quando usuário não é CONDOMINIUM", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic({ role: "CLIENT" }))

      await expect(
        useCase.approve({ caseId: "case-1", syndicId: "syndic-1", tenantId: "tenant-1" }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("lança ForbiddenError quando síndico pertence a outro condomínio", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase({ condominiumId: "condo-A" }))
      mockUserFindUnique.mockResolvedValue(makeSyndic({ condominiumId: "condo-B" }))

      await expect(
        useCase.approve({ caseId: "case-1", syndicId: "syndic-1", tenantId: "tenant-1" }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("lança InvalidTransitionError quando caso não está em AWAITING_SYNDIC_APPROVAL", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase({ status: "AWAITING_DOCUMENTS" }))
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.approve({ caseId: "case-1", syndicId: "syndic-1", tenantId: "tenant-1" }),
      ).rejects.toThrow(InvalidTransitionError)
    })
  })

  // ── reject ───────────────────────────────────────────────────────────────

  describe("reject", () => {
    it("transiciona para ARCHIVED quando recusado com sucesso", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.reject({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
          reason: "Reforma afeta estrutura do edifício sem laudo técnico adequado",
        }),
      ).resolves.toBeUndefined()

      expect(mockTransaction).toHaveBeenCalledOnce()
    })

    it("lança ValidationError quando reason é vazia", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.reject({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
          reason: "",
        }),
      ).rejects.toThrow(ValidationError)
    })

    it("lança ValidationError quando reason tem menos de 10 chars", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase())
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.reject({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
          reason: "Curto",
        }),
      ).rejects.toThrow(ValidationError)
    })

    it("lança ForbiddenError quando síndico de outro condomínio tenta recusar", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase({ condominiumId: "condo-A" }))
      mockUserFindUnique.mockResolvedValue(makeSyndic({ condominiumId: "condo-B" }))

      await expect(
        useCase.reject({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
          reason: "Motivo de recusa longo o suficiente",
        }),
      ).rejects.toThrow(ForbiddenError)
    })

    it("lança InvalidTransitionError quando caso não está em AWAITING_SYNDIC_APPROVAL", async () => {
      mockReformCaseFindFirst.mockResolvedValue(makeCase({ status: "SCOPE_CLASSIFIED" }))
      mockUserFindUnique.mockResolvedValue(makeSyndic())

      await expect(
        useCase.reject({
          caseId: "case-1",
          syndicId: "syndic-1",
          tenantId: "tenant-1",
          reason: "Motivo de recusa longo o suficiente",
        }),
      ).rejects.toThrow(InvalidTransitionError)
    })
  })
})
