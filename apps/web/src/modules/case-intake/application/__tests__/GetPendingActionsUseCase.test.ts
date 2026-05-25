import { describe, expect, it, vi, beforeEach } from "vitest"
import { GetPendingActionsUseCase } from "../GetPendingActionsUseCase"

// Mock prisma
vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    reformCase: {
      findMany: vi.fn(),
    },
    partner: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from "@/infrastructure/database/prisma"

const mockCase = (overrides: Record<string, unknown> = {}) => ({
  id: "case-1",
  protocol: "RF-2026-001",
  status: "AWAITING_DOCUMENTS",
  unit: { identifier: "203" },
  condominium: { name: "Edifício Concreto" },
  updatedAt: new Date(),
  ...overrides,
})

describe("GetPendingActionsUseCase", () => {
  let useCase: GetPendingActionsUseCase

  beforeEach(() => {
    useCase = new GetPendingActionsUseCase()
    vi.clearAllMocks()
  })

  it("CLIENT com casos em AWAITING_DOCUMENTS e PENDING_CORRECTIONS retorna 2 pendências", async () => {
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([
      mockCase({ status: "AWAITING_DOCUMENTS" }),
      mockCase({ id: "case-2", protocol: "RF-2026-002", status: "PENDING_CORRECTIONS" }),
    ] as any)

    const actions = await useCase.execute({
      userId: "user-1",
      role: "CLIENT",
      tenantId: "tenant-1",
    })

    expect(actions).toHaveLength(2)
    expect(actions[0]?.type).toBe("upload_documents")
    expect(actions[0]?.urgency).toBe("high")
    expect(actions[1]?.type).toBe("correct_documents")
    expect(actions[1]?.urgency).toBe("critical")
    expect(actions[0]?.href).toBe("/cases/case-1")
  })

  it("CONDOMINIUM com caso AWAITING_SYNDIC_APPROVAL retorna 1 pendência", async () => {
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([
      mockCase({ id: "case-3", status: "AWAITING_SYNDIC_APPROVAL" }),
    ] as any)

    const actions = await useCase.execute({
      userId: "user-2",
      role: "CONDOMINIUM",
      tenantId: "tenant-1",
      condominiumId: "cond-1",
    })

    expect(actions).toHaveLength(1)
    expect(actions[0]?.type).toBe("approve_reform")
    expect(actions[0]?.urgency).toBe("high")
    expect(actions[0]?.href).toBe("/sindico/cases/case-3")
  })

  it("CONDOMINIUM sem condominiumId retorna lista vazia", async () => {
    const actions = await useCase.execute({
      userId: "user-2",
      role: "CONDOMINIUM",
      tenantId: "tenant-1",
      condominiumId: null,
    })

    expect(actions).toHaveLength(0)
    expect(prisma.reformCase.findMany).not.toHaveBeenCalled()
  })

  it("PARTNER sem parceiro cadastrado retorna lista vazia", async () => {
    vi.mocked(prisma.partner.findUnique).mockResolvedValueOnce(null)

    const actions = await useCase.execute({
      userId: "user-3",
      role: "PARTNER",
      tenantId: "tenant-1",
    })

    expect(actions).toHaveLength(0)
    expect(prisma.reformCase.findMany).not.toHaveBeenCalled()
  })

  it("ADMIN com caso HUMAN_REVIEW_REQUIRED retorna 1 pendência", async () => {
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([
      mockCase({ id: "case-4", status: "HUMAN_REVIEW_REQUIRED" }),
    ] as any)

    const actions = await useCase.execute({
      userId: "user-4",
      role: "ADMIN",
      tenantId: "tenant-1",
    })

    expect(actions).toHaveLength(1)
    expect(actions[0]?.type).toBe("human_review")
    expect(actions[0]?.urgency).toBe("critical")
    expect(actions[0]?.href).toBe("/review-queue")
  })

  it("CLIENT sem casos pendentes retorna lista vazia", async () => {
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([])

    const actions = await useCase.execute({
      userId: "user-5",
      role: "CLIENT",
      tenantId: "tenant-1",
    })

    expect(actions).toHaveLength(0)
  })

  it("PARTNER com caso ASSIGNED_TO_PARTNER retorna pendência de aceite", async () => {
    vi.mocked(prisma.partner.findUnique).mockResolvedValueOnce({
      id: "partner-1",
    } as any)
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([
      mockCase({ id: "case-5", status: "ASSIGNED_TO_PARTNER" }),
    ] as any)

    const actions = await useCase.execute({
      userId: "user-6",
      role: "PARTNER",
      tenantId: "tenant-1",
    })

    expect(actions).toHaveLength(1)
    expect(actions[0]?.type).toBe("accept_assignment")
    expect(actions[0]?.href).toBe("/partner/cases/case-5")
  })

  it("SUPER_ADMIN usa o mesmo caminho de admin", async () => {
    vi.mocked(prisma.reformCase.findMany).mockResolvedValueOnce([])

    await useCase.execute({
      userId: "user-7",
      role: "SUPER_ADMIN",
      tenantId: "tenant-1",
    })

    expect(prisma.reformCase.findMany).toHaveBeenCalledOnce()
  })
})
