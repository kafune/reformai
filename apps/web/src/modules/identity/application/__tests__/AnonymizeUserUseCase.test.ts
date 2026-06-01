import { describe, expect, it, vi, beforeEach } from "vitest"
import { AnonymizeUserUseCase } from "../AnonymizeUserUseCase"

const { mocks } = vi.hoisted(() => ({
  mocks: {
    userFindFirst: vi.fn(),
    unitFindMany: vi.fn(),
    txUserUpdate: vi.fn(),
    txPushDeleteMany: vi.fn(),
    txTokenDeleteMany: vi.fn(),
    txUnitUpdateMany: vi.fn(),
    txAuditCreate: vi.fn(),
  },
}))

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    unit: { findMany: mocks.unitFindMany },
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        user: { update: mocks.txUserUpdate },
        pushSubscription: { deleteMany: mocks.txPushDeleteMany },
        passwordResetToken: { deleteMany: mocks.txTokenDeleteMany },
        unit: { updateMany: mocks.txUnitUpdateMany },
        auditLog: { create: mocks.txAuditCreate },
      }),
  },
}))

describe("AnonymizeUserUseCase", () => {
  let useCase: AnonymizeUserUseCase

  beforeEach(() => {
    useCase = new AnonymizeUserUseCase()
    vi.clearAllMocks()
  })

  it("anonimiza PII do usuário, remove tokens/push e anonimiza unidades do titular", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      email: "morador@example.com",
      condominiumId: "cond-1",
    })
    mocks.unitFindMany.mockResolvedValue([{ id: "unit-1" }, { id: "unit-2" }])

    const result = await useCase.execute({
      userId: "user-1",
      tenantId: "tenant-1",
      triggeredBy: "user:user-1",
    })

    expect(result.anonymizedEmail).toBe("anon-user-1@anonimizado.local")
    expect(result.unitsAnonymized).toBe(2)
    expect(result.alreadyAnonymized).toBe(false)

    // PII sobrescrita + conta desativada
    expect(mocks.txUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({
          name: "Usuário Anonimizado",
          email: "anon-user-1@anonimizado.local",
          active: false,
          lgpdConsentAt: null,
        }),
      }),
    )
    expect(mocks.txPushDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } })
    expect(mocks.txTokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } })
    expect(mocks.txUnitUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["unit-1", "unit-2"] } },
      data: { ownerName: null, ownerEmail: null, ownerPhone: null },
    })
    expect(mocks.txAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "user.anonymized", triggeredBy: "user:user-1" }),
      }),
    )
  })

  it("lança USER_NOT_FOUND quando o usuário não existe no tenant", async () => {
    mocks.userFindFirst.mockResolvedValue(null)
    await expect(
      useCase.execute({ userId: "x", tenantId: "tenant-1", triggeredBy: "admin:1" }),
    ).rejects.toThrow("USER_NOT_FOUND")
  })

  it("é idempotente: usuário já anonimizado não busca/atualiza unidades", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: "user-9",
      email: "anon-user-9@anonimizado.local",
      condominiumId: null,
    })

    const result = await useCase.execute({
      userId: "user-9",
      tenantId: "tenant-1",
      triggeredBy: "admin:1",
    })

    expect(result.alreadyAnonymized).toBe(true)
    expect(result.unitsAnonymized).toBe(0)
    expect(mocks.unitFindMany).not.toHaveBeenCalled()
    expect(mocks.txUnitUpdateMany).not.toHaveBeenCalled()
  })
})
