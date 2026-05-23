import { buildEmbeddingProvider, type EmbeddingProvider } from "@/infrastructure/embedding/EmbeddingProvider"
import { NormChunkRepository, type NormSearchHit } from "../infrastructure/NormChunkRepository"

export interface NormChunkInput {
  norm: string
  section?: string | null
  content: string
}

/**
 * Serviço de RAG de normas: ingestão (embed + store) e busca semântica.
 */
export class NormSearchService {
  constructor(
    private readonly embedder: EmbeddingProvider = buildEmbeddingProvider(),
    private readonly repo: NormChunkRepository = new NormChunkRepository(),
  ) {}

  /** Embeda a query e retorna os k trechos de norma mais relevantes. */
  async search(query: string, k = 5): Promise<NormSearchHit[]> {
    const text = query.trim()
    if (!text) return []
    const [embedding] = await this.embedder.embed([text])
    if (!embedding) return []
    return this.repo.searchSimilar(embedding, k)
  }

  /**
   * Reingesta uma norma: remove trechos antigos e insere os novos já embedados.
   * Embeda em lote para eficiência.
   */
  async ingest(norm: string, chunks: NormChunkInput[]): Promise<number> {
    if (chunks.length === 0) return 0
    const embeddings = await this.embedder.embed(chunks.map((c) => c.content))
    await this.repo.deleteByNorm(norm)
    for (let i = 0; i < chunks.length; i++) {
      await this.repo.insert({
        norm,
        section: chunks[i]!.section ?? null,
        content: chunks[i]!.content,
        embedding: embeddings[i]!,
      })
    }
    return chunks.length
  }
}
