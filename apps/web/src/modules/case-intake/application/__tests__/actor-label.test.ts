import { describe, expect, it } from "vitest"
import { sanitizeActor } from "../actor-label"

describe("sanitizeActor", () => {
  it("mapeia 'system' para Sistema", () => {
    expect(sanitizeActor("system", "u1")).toBe("Sistema")
  })

  it("mapeia 'ai' e prefixo 'ai:' para Assistente IA", () => {
    expect(sanitizeActor("ai", "u1")).toBe("Assistente IA")
    expect(sanitizeActor("ai:triage", "u1")).toBe("Assistente IA")
  })

  it("mapeia 'reviewer:' para Equipe técnica sem vazar id", () => {
    expect(sanitizeActor("reviewer:abc123", "u1")).toBe("Equipe técnica")
  })

  it("mostra 'Você' quando o usuário é o próprio ator", () => {
    expect(sanitizeActor("user:u1", "u1")).toBe("Você")
  })

  it("generaliza para 'Equipe' quando o ator é outro usuário", () => {
    expect(sanitizeActor("user:u2", "u1")).toBe("Equipe")
  })

  it("nunca vaza o id de outro usuário", () => {
    expect(sanitizeActor("user:super-secret-id", "u1")).not.toContain("super-secret-id")
  })

  it("usa fallback seguro para formatos desconhecidos", () => {
    expect(sanitizeActor("qualquer-coisa", "u1")).toBe("Sistema")
  })
})
