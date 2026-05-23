import { NormSearchService } from "@/modules/norms/application/NormSearchService"
import { NBR_16280_CHUNKS } from "@/modules/norms/data/nbr16280"
import { buildEmbeddingProvider } from "@/infrastructure/embedding/EmbeddingProvider"

/**
 * Ingesta a base de normas (embeddings + pgvector).
 * Uso: DATABASE_URL=... [VOYAGE_API_KEY=...] bun run scripts/seed-norms.ts
 */
async function main() {
  const provider = buildEmbeddingProvider()
  console.log(`Embedding provider: ${provider.name}`)
  if (provider.name === "deterministic") {
    console.warn("⚠️  Sem VOYAGE_API_KEY — usando embeddings determinísticos (sem valor semântico real).")
  }

  const service = new NormSearchService(provider)
  const n = await service.ingest("NBR 16280", NBR_16280_CHUNKS)
  console.log(`✅ ${n} trechos de NBR 16280 ingeridos.`)
  process.exit(0)
}

main().catch((err) => {
  console.error("Falha na ingestão de normas:", err)
  process.exit(1)
})
