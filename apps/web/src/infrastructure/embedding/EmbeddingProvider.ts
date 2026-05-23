import { createHash } from "node:crypto"

export const EMBEDDING_DIM = 1024

export interface EmbeddingProvider {
  readonly name: string
  embed(texts: string[]): Promise<number[][]>
}

/** Embeddings via Voyage AI (parceiro de embeddings da Anthropic). */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly name = "voyage"
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.VOYAGE_MODEL ?? "voyage-3.5",
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const res = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: texts, model: this.model, output_dimension: EMBEDDING_DIM }),
    })
    if (!res.ok) {
      throw new Error(`Voyage embeddings falhou: ${res.status} ${await res.text()}`)
    }
    const json = (await res.json()) as { data: Array<{ embedding: number[] }> }
    return json.data.map((d) => d.embedding)
  }
}

/**
 * Fallback determinístico para dev/testes sem VOYAGE_API_KEY. Gera um vetor
 * estável por texto (não tem valor semântico real — apenas mantém o pipeline
 * funcional offline).
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deterministic"

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => pseudoVector(t))
  }
}

function pseudoVector(text: string): number[] {
  // PRNG (mulberry32) semeado por hash do texto → vetor estável e normalizado.
  const seed = parseInt(createHash("sha256").update(text).digest("hex").slice(0, 8), 16)
  let a = seed >>> 0
  const v = new Array<number>(EMBEDDING_DIM)
  let norm = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    const r = ((x ^ (x >>> 14)) >>> 0) / 4294967296 - 0.5
    v[i] = r
    norm += r * r
  }
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < EMBEDDING_DIM; i++) v[i]! /= norm
  return v
}

export function buildEmbeddingProvider(): EmbeddingProvider {
  const key = process.env.VOYAGE_API_KEY
  return key ? new VoyageEmbeddingProvider(key) : new DeterministicEmbeddingProvider()
}
