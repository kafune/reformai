import { describe, expect, it } from "vitest"
import { DeterministicEmbeddingProvider, EMBEDDING_DIM } from "../EmbeddingProvider"

describe("DeterministicEmbeddingProvider", () => {
  const p = new DeterministicEmbeddingProvider()

  it("gera vetores com a dimensão esperada", async () => {
    const [v] = await p.embed(["NBR 16280 responsável técnico"])
    expect(v).toHaveLength(EMBEDDING_DIM)
  })

  it("é determinístico para o mesmo texto", async () => {
    const [a] = await p.embed(["mesma frase"])
    const [b] = await p.embed(["mesma frase"])
    expect(a).toEqual(b)
  })

  it("textos diferentes geram vetores diferentes", async () => {
    const [a] = await p.embed(["frase um"])
    const [b] = await p.embed(["frase dois"])
    expect(a).not.toEqual(b)
  })

  it("produz vetor unitário (norma ≈ 1)", async () => {
    const [v] = await p.embed(["normalização"])
    const norm = Math.sqrt(v!.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 5)
  })
})
