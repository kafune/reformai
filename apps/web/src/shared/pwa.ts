// Helpers de instalação do PWA (lado do cliente).
//
// O evento `beforeinstallprompt` (Android/desktop Chromium) costuma disparar
// cedo e só uma vez — antes de a UI de instalação estar montada. Por isso ele é
// capturado globalmente (no PwaRegistrar, montado no layout raiz) e guardado
// aqui, num singleton de módulo, para o modal consumir quando precisar.

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

export const PWA_INSTALLABLE_EVENT = "pwa:installable"
export const PWA_OPEN_MODAL_EVENT = "pwa:open-install"
const SNOOZE_KEY = "pwa-install-snooze-until"

let deferredPrompt: BeforeInstallPromptEvent | null = null
let captureInitialized = false

/** Captura global do beforeinstallprompt + appinstalled. Idempotente. */
export function initPwaInstallCapture(): void {
  if (typeof window === "undefined" || captureInitialized) return
  captureInitialized = true

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    window.dispatchEvent(new Event(PWA_INSTALLABLE_EVENT))
  })

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    // Não voltar a incomodar depois de instalado.
    snoozeInstallPrompt(365)
  })
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt
}

/** True quando o app já roda instalado (standalone) — não incentivar. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  const mql = window.matchMedia?.("(display-mode: standalone)")
  // `navigator.standalone` é específico do iOS Safari.
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return Boolean(mql?.matches) || iosStandalone
}

/** True em iPhone/iPad (inclui iPadOS que se reporta como Mac com toque). */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

/** Dispara o prompt nativo. Retorna o desfecho, ou null se indisponível. */
export async function triggerNativeInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferredPrompt) return null
  await deferredPrompt.prompt()
  const choice = await deferredPrompt.userChoice.catch(() => null)
  deferredPrompt = null
  return choice?.outcome ?? null
}

/** Adia o incentivo automático por N dias. */
export function snoozeInstallPrompt(days: number): void {
  if (typeof window === "undefined") return
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000
    window.localStorage.setItem(SNOOZE_KEY, String(until))
  } catch {
    /* localStorage indisponível — ignora */
  }
}

/** True se o incentivo automático ainda está em período de silêncio. */
export function isSnoozed(): boolean {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage.getItem(SNOOZE_KEY)
    if (!raw) return false
    return Date.now() < Number(raw)
  } catch {
    return false
  }
}

/** Abre o modal de instalação manualmente (ex.: a partir de "Minha conta"). */
export function openInstallModal(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(PWA_OPEN_MODAL_EVENT))
}
