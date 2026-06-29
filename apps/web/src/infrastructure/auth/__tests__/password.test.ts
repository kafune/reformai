import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "../password"

describe("password hashing", () => {
  it("gera hash no formato scrypt$salt$hash", async () => {
    const hash = await hashPassword("senha123")
    expect(hash.startsWith("scrypt$")).toBe(true)
    expect(hash.split("$")).toHaveLength(3)
  })

  it("verifica a senha correta", async () => {
    const hash = await hashPassword("minhaSenhaForte")
    expect(await verifyPassword("minhaSenhaForte", hash)).toBe(true)
  })

  it("rejeita senha incorreta", async () => {
    const hash = await hashPassword("minhaSenhaForte")
    expect(await verifyPassword("outraSenha", hash)).toBe(false)
  })

  it("rejeita hash malformado sem lançar", async () => {
    expect(await verifyPassword("x", "formato-invalido")).toBe(false)
    expect(await verifyPassword("x", "sha256$abc$def")).toBe(false)
    expect(await verifyPassword("x", "")).toBe(false)
  })

  it("gera salts diferentes a cada hash", async () => {
    const a = await hashPassword("igual")
    const b = await hashPassword("igual")
    expect(a).not.toBe(b)
  })
})
