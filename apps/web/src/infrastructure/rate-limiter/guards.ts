/**
 * Guards de rate-limit por usuário para rotas custosas (IA, upload).
 *
 * Diferente do rate-limit por IP usado em auth/register, estes limitam por
 * usuário autenticado, protegendo custo de tokens da IA e abuso de upload.
 * Fail-open: se o Redis estiver indisponível, o tráfego legítimo nunca é bloqueado.
 */
import { checkRateLimit, rateLimitResponse } from "./RateLimiter"

export interface RateLimitBucket {
  /** Prefixo lógico do bucket (ex.: "ai:chat", "upload", "report"). */
  name: string
  /** Máximo de requisições na janela. */
  limit: number
  /** Janela em segundos. */
  windowSeconds: number
}

/** Buckets padrão das operações custosas. */
export const BUCKETS = {
  aiChat: { name: "ai:chat", limit: 30, windowSeconds: 60 },
  aiReport: { name: "ai:report", limit: 12, windowSeconds: 60 },
  aiAnalyze: { name: "ai:analyze", limit: 20, windowSeconds: 60 },
  aiQuote: { name: "ai:quote", limit: 20, windowSeconds: 60 },
  upload: { name: "upload", limit: 40, windowSeconds: 300 },
} as const satisfies Record<string, RateLimitBucket>

/**
 * Aplica o rate-limit para um usuário. Retorna uma Response 429 se estourado,
 * ou `null` se permitido (a rota deve seguir o fluxo normal).
 */
export async function enforceUserRateLimit(
  userId: string,
  bucket: RateLimitBucket,
): Promise<Response | null> {
  const result = await checkRateLimit(
    `${bucket.name}:${userId}`,
    bucket.limit,
    bucket.windowSeconds,
  )
  if (!result.allowed) return rateLimitResponse(result.retryAfter)
  return null
}
