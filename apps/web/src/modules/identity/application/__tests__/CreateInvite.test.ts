import { describe, expect, it, vi, beforeEach } from "vitest"
import { ValidationError, NotFoundError } from "@/shared/errors/DomainError"

const tenantFindUnique = vi.fn()
const condoFindUnique = vi.fn()
const userFindUnique = vi.fn()
const userCreate = vi.fn()
const tokenCreate = vi.fn()
const txn = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb({
    user: { create: (...a: unknown[]) => userCreate(...a) },
    passwordResetToken: { create: (...a: unknown[]) => tokenCreate(...a) },
  }),
)

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    tenant: { findUnique: (...a: unknown[]) => tenantFindUnique(...a) },
    condominium: { findUnique: (...a: unknown[]) => condoFindUnique(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    $transaction: (cb: (tx: unknown) => unknown) => txn(cb),
  },
}))

import { CreateInviteUseCase } from "../CreateInviteUseCase"

beforeEach(() => {
  vi.clearAllMocks()
  tenantFindUnique.mockResolvedValue({ id: "t1" })
  userFindUnique.mockResolvedValue(null)
  userCreate.mockResolvedValue({ id: "u1", name: "Novo", email: "novo@x.com" })
  tokenCreate.mockResolvedValue({})
})

const base = {
  name: "Novo",
  email: "Novo@x.com",
  role: "ADMIN" as const,
  tenantId: "t1",
}

describe("CreateInviteUseCase", () => {
  it("cria usuário + token de convite e retorna rawToken", async () => {
    const r = await new CreateInviteUseCase().execute(base)
    expect(r).toMatchObject({ userId: "u1", email: "novo@x.com" })
    expect(r.rawToken).toMatch(/^[0-9a-f]{64}$/)
    expect(userCreate).toHaveBeenCalled()
    expect(tokenCreate).toHaveBeenCalled()
  })

  it("rejeita e-mail já cadastrado", async () => {
    userFindUnique.mockResolvedValue({ id: "exists" })
    await expect(new CreateInviteUseCase().execute(base)).rejects.toBeInstanceOf(ValidationError)
    expect(userCreate).not.toHaveBeenCalled()
  })

  it("rejeita tenant inexistente", async () => {
    tenantFindUnique.mockResolvedValue(null)
    await expect(new CreateInviteUseCase().execute(base)).rejects.toBeInstanceOf(NotFoundError)
  })

  it("exige condomínio para síndico", async () => {
    await expect(
      new CreateInviteUseCase().execute({ ...base, role: "CONDOMINIUM" }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("valida condomínio do tenant para síndico", async () => {
    condoFindUnique.mockResolvedValue({ id: "c1", tenantId: "outro" })
    await expect(
      new CreateInviteUseCase().execute({ ...base, role: "CONDOMINIUM", condominiumId: "c1" }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})
