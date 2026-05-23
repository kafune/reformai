import { describe, expect, it, vi, beforeEach } from "vitest"
import { createHash } from "node:crypto"
import { ValidationError } from "@/shared/errors/DomainError"

const userFindUnique = vi.fn()
const userUpdate = vi.fn()
const tokenFindUnique = vi.fn()
const tokenCreate = vi.fn()
const tokenUpdate = vi.fn()
const tokenDeleteMany = vi.fn()
const txn = vi.fn(async (ops: unknown) => (Array.isArray(ops) ? ops : []))

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), update: (...a: unknown[]) => userUpdate(...a) },
    passwordResetToken: {
      findUnique: (...a: unknown[]) => tokenFindUnique(...a),
      create: (...a: unknown[]) => tokenCreate(...a),
      update: (...a: unknown[]) => tokenUpdate(...a),
      deleteMany: (...a: unknown[]) => tokenDeleteMany(...a),
    },
    $transaction: (ops: unknown) => txn(ops),
  },
}))

import {
  RequestPasswordResetUseCase,
  hashResetToken,
} from "../RequestPasswordResetUseCase"
import { ConfirmPasswordResetUseCase } from "../ConfirmPasswordResetUseCase"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("RequestPasswordResetUseCase", () => {
  it("retorna null para usuário inexistente (sem enumeração)", async () => {
    userFindUnique.mockResolvedValue(null)
    const r = await new RequestPasswordResetUseCase().execute("x@y.com")
    expect(r).toBeNull()
    expect(tokenCreate).not.toHaveBeenCalled()
  })

  it("retorna null para usuário inativo", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "U", email: "u@y.com", active: false })
    const r = await new RequestPasswordResetUseCase().execute("u@y.com")
    expect(r).toBeNull()
  })

  it("gera token e invalida anteriores para usuário ativo", async () => {
    userFindUnique.mockResolvedValue({ id: "u1", name: "Ana", email: "ana@y.com", active: true })
    const r = await new RequestPasswordResetUseCase().execute("ANA@y.com")
    expect(r).toMatchObject({ name: "Ana", email: "ana@y.com" })
    expect(r!.rawToken).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenDeleteMany).toHaveBeenCalled()
    expect(tokenCreate).toHaveBeenCalled()
    // o hash persistido corresponde ao sha256 do token bruto
    const createArg = tokenCreate.mock.calls[0]![0] as { data: { tokenHash: string } }
    expect(createArg.data.tokenHash).toBe(hashResetToken(r!.rawToken))
  })
})

describe("ConfirmPasswordResetUseCase", () => {
  const RAW = "a".repeat(64)
  const HASH = createHash("sha256").update(RAW).digest("hex")

  it("rejeita token inexistente", async () => {
    tokenFindUnique.mockResolvedValue(null)
    await expect(
      new ConfirmPasswordResetUseCase().execute({ token: RAW, newPassword: "novasenha1" }),
    ).rejects.toBeInstanceOf(ValidationError)
    expect(userUpdate).not.toHaveBeenCalled()
  })

  it("rejeita token já usado", async () => {
    tokenFindUnique.mockResolvedValue({ id: "t1", userId: "u1", usedAt: new Date(), expiresAt: new Date(Date.now() + 1e6) })
    await expect(
      new ConfirmPasswordResetUseCase().execute({ token: RAW, newPassword: "novasenha1" }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("rejeita token expirado", async () => {
    tokenFindUnique.mockResolvedValue({ id: "t1", userId: "u1", usedAt: null, expiresAt: new Date(Date.now() - 1000) })
    await expect(
      new ConfirmPasswordResetUseCase().execute({ token: RAW, newPassword: "novasenha1" }),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it("troca a senha e consome o token quando válido", async () => {
    tokenFindUnique.mockResolvedValue({ id: "t1", userId: "u1", usedAt: null, expiresAt: new Date(Date.now() + 1e6) })
    await new ConfirmPasswordResetUseCase().execute({ token: RAW, newPassword: "novasenha1" })
    expect(tokenFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: HASH } }))
    expect(txn).toHaveBeenCalled()
  })
})
