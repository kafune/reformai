/**
 * Status de configuração dos subsistemas externos.
 *
 * Em produção, e-mail e push falham de forma silenciosa (fire-and-forget) quando
 * não configurados. Este módulo torna esse estado VISÍVEL: loga um resumo no boot
 * e alimenta o endpoint /api/v1/admin/system-status.
 */

import { logger } from "@/shared/logger"

export interface SubsystemStatus {
  /** Banco de dados (DATABASE_URL). */
  database: boolean
  /** Fila/cache Redis (REDIS_URL). */
  redis: boolean
  /** Chave da API Anthropic (IA). */
  anthropic: boolean
  /** Provedor de e-mail transacional (SMTP ou Resend). */
  email: boolean
  /** Web Push (chaves VAPID). */
  push: boolean
  /** Storage de arquivos (MinIO ou S3) conforme STORAGE_ADAPTER. */
  storage: boolean
  /** Monitoramento de erros (SENTRY_DSN). */
  monitoring: boolean
  /** Segredo de sessão forte e não-default. */
  authSecret: boolean
}

const WEAK_SECRETS = new Set(["", "change-me-in-production", "secret", "dev", "changeme"])

function emailConfigured(): boolean {
  const forced = process.env.EMAIL_PROVIDER?.toLowerCase()
  if (forced === "smtp") return Boolean(process.env.SMTP_HOST)
  if (forced === "resend") return Boolean(process.env.RESEND_API_KEY)
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY)
}

function storageConfigured(): boolean {
  const adapter = (process.env.STORAGE_ADAPTER ?? "minio").toLowerCase()
  if (adapter === "s3") {
    return Boolean(
      process.env.AWS_S3_BUCKET &&
        process.env.AWS_REGION &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY,
    )
  }
  return Boolean(process.env.MINIO_ENDPOINT && process.env.MINIO_BUCKET)
}

function authSecretStrong(): boolean {
  const secret = process.env.NEXTAUTH_SECRET ?? ""
  return secret.length >= 16 && !WEAK_SECRETS.has(secret)
}

export function getConfigStatus(): SubsystemStatus {
  return {
    database: Boolean(process.env.DATABASE_URL),
    redis: Boolean(process.env.REDIS_URL),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    email: emailConfigured(),
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    storage: storageConfigured(),
    monitoring: Boolean(process.env.SENTRY_DSN),
    authSecret: authSecretStrong(),
  }
}

/**
 * Loga um resumo do status no boot. Em produção, emite WARN para subsistemas
 * críticos ausentes (não bloqueia o boot — apenas torna visível).
 */
export function logConfigStatus(): void {
  const status = getConfigStatus()
  const isProd = process.env.NODE_ENV === "production"

  logger.info("config.status", { ...status })

  const criticalMissing: string[] = []
  if (!status.database) criticalMissing.push("DATABASE_URL")
  if (!status.anthropic) criticalMissing.push("ANTHROPIC_API_KEY")
  if (isProd && !status.authSecret) criticalMissing.push("NEXTAUTH_SECRET (fraco/default)")
  if (criticalMissing.length > 0) {
    logger.error("config.critical_missing", { missing: criticalMissing })
  }

  const degraded: string[] = []
  if (!status.email) degraded.push("email")
  if (!status.push) degraded.push("push")
  if (!status.redis) degraded.push("redis")
  if (!status.monitoring) degraded.push("monitoring")
  if (degraded.length > 0) {
    logger.warn("config.degraded", {
      subsystems: degraded,
      note: "Funcionalidades opcionais desativadas — notificações/observabilidade podem não operar.",
    })
  }
}
