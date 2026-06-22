/**
 * Next.js instrumentation hook — roda uma vez no boot do servidor.
 *
 * Inicializa o monitoramento de erros e loga o status de configuração dos
 * subsistemas (e-mail/push/IA/storage), tornando visível qualquer ausência.
 */
export async function register(): Promise<void> {
  // Só no runtime Node (não no Edge), onde process.env completo está disponível.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initMonitoring } = await import("@/infrastructure/monitoring/sentry")
    const { logConfigStatus } = await import("@/infrastructure/config/configStatus")
    initMonitoring()
    logConfigStatus()

    try {
      const { LocalEmbeddingProvider } = await import(
        "@/infrastructure/embedding/EmbeddingProvider"
      )
      LocalEmbeddingProvider.warmup().catch(() => {
        // non-fatal: model will load on first embed call
      })
    } catch {
      // non-fatal: ONNX unavailable in this environment
    }
  }
}
