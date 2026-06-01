/**
 * Monitoramento de erros (Sentry-compatível via DSN).
 *
 * Funciona com Sentry SaaS ou instância self-hosted compatível (ex.: GlitchTip).
 * Totalmente desativado quando `SENTRY_DSN` não está definido — `captureException`
 * vira no-op e nenhuma dependência de rede é acionada.
 *
 * Nunca lança: falha de monitoramento jamais interrompe o fluxo de negócio.
 */
import * as Sentry from "@sentry/node"
import { logger } from "@/shared/logger"

let initialized = false

export function isMonitoringEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN)
}

/**
 * Inicializa o SDK uma única vez. Idempotente e seguro para chamar em qualquer
 * ponto de entrada (instrumentation, worker, primeiro captureException).
 */
export function initMonitoring(): void {
  if (initialized) return
  initialized = true

  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "development",
      release: process.env.APP_RELEASE,
      // Tracing desligado por padrão (custo); habilitável por env.
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    })
    logger.info("monitoring.initialized", { provider: "sentry" })
  } catch (err) {
    logger.warn("monitoring.init_failed", { error: (err as Error).message })
  }
}

interface CaptureContext {
  tenantId?: string
  userId?: string
  caseId?: string
  route?: string
  [key: string]: unknown
}

/** Reporta uma exceção ao backend de monitoramento. No-op se desabilitado. */
export function captureException(err: unknown, context?: CaptureContext): void {
  if (!isMonitoringEnabled()) return
  if (!initialized) initMonitoring()
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined)
  } catch {
    // Monitoramento nunca propaga erro.
  }
}

/** Reporta uma mensagem (ex.: aviso operacional). No-op se desabilitado. */
export function captureMessage(message: string, context?: CaptureContext): void {
  if (!isMonitoringEnabled()) return
  if (!initialized) initMonitoring()
  try {
    Sentry.captureMessage(message, context ? { level: "warning", extra: context } : undefined)
  } catch {
    // silêncio
  }
}

// Inicializa ao importar o módulo (no-op sem DSN). Garante captura mesmo em
// route handlers que não passam pela instrumentation do worker.
initMonitoring()
