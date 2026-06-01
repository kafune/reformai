/**
 * Envia um erro capturado por uma error boundary ao beacon de monitoramento.
 * Best-effort: usa sendBeacon quando disponível, com fallback para fetch.
 * Nunca lança.
 */
export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === "undefined") return
  try {
    const payload = JSON.stringify({
      message: error.message || "Erro desconhecido no cliente",
      stack: error.stack?.slice(0, 8000),
      digest: error.digest,
      url: window.location.href,
    })
    const url = "/api/v1/monitoring/client-error"

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }))
      return
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // monitoramento de cliente nunca quebra a UI
  }
}
