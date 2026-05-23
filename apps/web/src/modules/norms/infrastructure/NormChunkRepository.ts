import { randomUUID } from "node:crypto"
import { prisma } from "@/infrastructure/database/prisma"

export interface NormSearchHit {
  id: string
  norm: string
  section: string | null
  content: string
  score: number
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`
}

export class NormChunkRepository {
  /** Insere um trecho de norma com seu embedding (vetor pgvector). */
  async insert(input: {
    norm: string
    section: string | null
    content: string
    embedding: number[]
  }): Promise<string> {
    const id = randomUUID()
    await prisma.$executeRawUnsafe(
      `INSERT INTO "NormChunk" (id, norm, section, content, embedding, "createdAt")
       VALUES ($1, $2, $3, $4, $5::vector, now())`,
      id,
      input.norm,
      input.section,
      input.content,
      toVectorLiteral(input.embedding),
    )
    return id
  }

  /** Remove todos os trechos de uma norma (reingestão idempotente). */
  async deleteByNorm(norm: string): Promise<void> {
    await prisma.$executeRawUnsafe(`DELETE FROM "NormChunk" WHERE norm = $1`, norm)
  }

  /** Busca os k trechos mais similares (distância cosseno do pgvector). */
  async searchSimilar(embedding: number[], k: number): Promise<NormSearchHit[]> {
    const rows = await prisma.$queryRawUnsafe<NormSearchHit[]>(
      `SELECT id, norm, section, content, 1 - (embedding <=> $1::vector) AS score
       FROM "NormChunk"
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      toVectorLiteral(embedding),
      k,
    )
    return rows.map((r) => ({ ...r, score: Number(r.score) }))
  }

  async count(): Promise<number> {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM "NormChunk"`,
    )
    return Number(rows[0]?.count ?? 0)
  }
}
