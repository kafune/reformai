"use client"
import { useEffect, useState } from "react"
import { flushQueue } from "@/shared/offline-queue"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Registra o service worker (PWA) e oferece o prompt de instalação quando o
 * navegador o disponibiliza. Renderiza um banner discreto e dispensável.
 */
export function PwaRegistrar() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {})
    if (document.readyState === "complete") onLoad()
    else window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
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

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall)
  }, [])

  if (!deferred || dismissed) return null

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-lg bg-ink-900 px-4 py-3 text-bone-50 shadow-3 sm:left-auto sm:right-4">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Instalar o ReformAI</p>
        <p className="text-xs text-ink-200">Acesso rápido e uso offline em campo.</p>
      </div>
      <button
        type="button"
        onClick={async () => {
          await deferred.prompt()
          await deferred.userChoice.catch(() => undefined)
          setDeferred(null)
        }}
        className="shrink-0 rounded-sm bg-green-500 px-3 py-1.5 text-xs font-semibold text-ink-900 hover:bg-green-400"
      >
        Instalar
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dispensar"
        className="shrink-0 text-ink-300 hover:text-bone-50"
      >
        ✕
      </button>
    </div>
  )
}
