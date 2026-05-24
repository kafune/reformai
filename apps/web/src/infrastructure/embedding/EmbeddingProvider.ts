import { createHash } from "node:crypto"

// Dimensão do modelo local (paraphrase-multilingual-MiniLM-L12-v2 → 384).
export const EMBEDDING_DIM = 384

const LOCAL_MODEL = process.env.EMBEDDINGS_MODEL ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2"

export interface EmbeddingProvider {
  readonly name: string
  embed(texts: string[]): Promise<number[][]>
}

/**
 * Embeddings nativos, rodando localmente via transformers.js (ONNX) — sem API
 * externa nem custo. Baixa os pesos do modelo no primeiro uso (cache em disco).
 * Modelo multilíngue, adequado a textos em português.
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly name = "local"
  // Pipeline carregado preguiçosamente e reaproveitado entre chamadas.
  private static extractor: Promise<(texts: string[], opts: object) => Promise<{ tolist(): number[][] }>> | null = null

  private static getExtractor() {
    if (!LocalEmbeddingProvider.extractor) {
      LocalEmbeddingProvider.extractor = import("@huggingface/transformers").then(({ pipeline }) =>
        pipeline("feature-extraction", LOCAL_MODEL),
      ) as never
    }
    return LocalEmbeddingProvider.extractor!
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return []
    const extractor = await LocalEmbeddingProvider.getExtractor()
    const output = await extractor(texts, { pooling: "mean", normalize: true })
    return output.tolist()
  }
}

/**
 * Fallback determinístico para testes/CI offline (EMBEDDINGS_PROVIDER=deterministic).
 * Gera um vetor estável por texto, sem valor semântico real.
 */
export class DeterministicEmbeddingProvider implements EmbeddingProvider {
  readonly name = "deterministic"

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => pseudoVector(t))
  }
}

function pseudoVector(text: string): number[] {
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
  if (process.env.EMBEDDINGS_PROVIDER === "deterministic") {
    return new DeterministicEmbeddingProvider()
  }
  return new LocalEmbeddingProvider()
}
