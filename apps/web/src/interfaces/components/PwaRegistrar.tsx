"use client"
import { useEffect } from "react"
import { flushQueue } from "@/shared/offline-queue"
import { initPwaInstallCapture } from "@/shared/pwa"

/**
 * Registra o service worker (PWA), sincroniza a fila offline e captura
 * globalmente o evento de instalação. A UI de incentivo à instalação fica no
 * `PwaInstallModal` (montado na área logada), que consome o evento capturado
 * aqui — assim o `beforeinstallprompt`, que dispara cedo, nunca é perdido.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  // Captura beforeinstallprompt/appinstalled o quanto antes (idempotente).
  useEffect(() => {
    initPwaInstallCapture()
  }, [])

  // Sincroniza pendências offline ao carregar e sempre que a conexão voltar.
  useEffect(() => {
    const sync = () => {
      flushQueue().catch(() => undefined)
    }
    sync()
    window.addEventListener("online", sync)
    return () => window.removeEventListener("online", sync)
  }, [])

  return null
}
