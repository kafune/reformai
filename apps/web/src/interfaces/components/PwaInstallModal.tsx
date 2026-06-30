"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { Icon } from "./ui/Icon"
import {
  PWA_INSTALLABLE_EVENT,
  PWA_OPEN_MODAL_EVENT,
  getDeferredPrompt,
  isIOS,
  isSnoozed,
  isStandalone,
  snoozeInstallPrompt,
  triggerNativeInstall,
} from "@/shared/pwa"

const AUTO_OPEN_DELAY_MS = 6000
const SNOOZE_DAYS = 7

const BENEFITS: Array<{ icon: "home" | "shield" | "bell" | "sparkle"; text: string }> = [
  { icon: "home", text: "Acesso rápido pela tela inicial do celular" },
  { icon: "shield", text: "Funciona offline em campo — vistorias e uploads" },
  { icon: "bell", text: "Notificações do andamento da sua reforma" },
  { icon: "sparkle", text: "Mais leve e rápido que abrir pelo navegador" },
]

/** Ícone de Compartilhar do iOS (caixa com seta para cima). */
function IosShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v12M12 3l-4 4M12 3l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type Mode = "native" | "ios" | "generic"

/**
 * Modal de incentivo à instalação do PWA. Abre automaticamente uma vez (após
 * um pequeno atraso) quando o app é instalável e não está em standalone, e
 * também pode ser aberto manualmente via `openInstallModal()`. Respeita um
 * cooldown de dispensa no localStorage e cobre iOS (instruções manuais).
 */
export function PwaInstallModal() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("generic")
  const autoOpenedRef = useRef(false)

  const resolveMode = useCallback((): Mode => {
    if (getDeferredPrompt()) return "native"
    if (isIOS()) return "ios"
    return "generic"
  }, [])

  const maybeAutoOpen = useCallback(() => {
    if (autoOpenedRef.current) return
    if (isStandalone() || isSnoozed()) return
    const m = resolveMode()
    // Auto-abre só quando há caminho de instalação real (nativo ou iOS).
    if (m === "generic") return
    autoOpenedRef.current = true
    setMode(m)
    setOpen(true)
  }, [resolveMode])

  // Auto-open com atraso + reage ao beforeinstallprompt tardio.
  useEffect(() => {
    if (isStandalone()) return
    const timer = setTimeout(maybeAutoOpen, AUTO_OPEN_DELAY_MS)
    const onInstallable = () => maybeAutoOpen()
    window.addEventListener(PWA_INSTALLABLE_EVENT, onInstallable)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(PWA_INSTALLABLE_EVENT, onInstallable)
    }
  }, [maybeAutoOpen])

  // Abertura manual (ex.: a partir de "Minha conta").
  useEffect(() => {
    const onOpen = () => {
      setMode(resolveMode())
      setOpen(true)
    }
    window.addEventListener(PWA_OPEN_MODAL_EVENT, onOpen)
    return () => window.removeEventListener(PWA_OPEN_MODAL_EVENT, onOpen)
  }, [resolveMode])

  // Fecha com Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function dismiss() {
    snoozeInstallPrompt(SNOOZE_DAYS)
    setOpen(false)
  }

  async function install() {
    const outcome = await triggerNativeInstall()
    if (outcome === "accepted") {
      setOpen(false)
    } else if (outcome === "dismissed") {
      dismiss()
    } else {
      // Sem prompt nativo disponível: cai para instruções.
      setMode(isIOS() ? "ios" : "generic")
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/40 p-3 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="pwa-install-modal"
      >
        {/* Cabeçalho */}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-900">
            <Icon name="sparkle" size={20} className="text-green-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="pwa-install-title" className="text-base font-semibold text-ink-900">
              Instale o app ReformAI
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Uma experiência mais rápida e prática, direto na tela inicial.
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="shrink-0 text-ink-400 transition-colors hover:text-ink-700"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Benefícios */}
        <ul className="mt-4 flex flex-col gap-2.5">
          {BENEFITS.map((b, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-green-100">
                <Icon name={b.icon} size={14} className="text-green-700" />
              </span>
              <span className="text-sm text-ink-700">{b.text}</span>
            </li>
          ))}
        </ul>

        {/* Ação por plataforma */}
        {mode === "native" ? (
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-sm px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-700"
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={install}
              data-testid="pwa-install-button"
              className="inline-flex items-center gap-1.5 rounded-sm bg-green-700 px-4 py-2 text-sm font-semibold text-bone-50 transition-colors hover:bg-green-800"
            >
              <Icon name="upload" size={14} />
              Instalar agora
            </button>
          </div>
        ) : (
          <div className="mt-5">
            <div className="rounded-md bg-bone-50 px-4 py-3.5">
              <p className="mb-2 text-xs font-semibold text-ink-700">
                {mode === "ios" ? "Como instalar no iPhone/iPad:" : "Como instalar:"}
              </p>
              {mode === "ios" ? (
                <ol className="flex flex-col gap-2 text-xs text-ink-600">
                  <li className="flex items-center gap-2">
                    <Step n={1} />
                    <span className="flex items-center gap-1">
                      Toque em Compartilhar
                      <span className="inline-flex items-center rounded bg-bone-200 px-1 py-0.5 text-ink-700">
                        <IosShareGlyph />
                      </span>
                      no Safari
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Step n={2} />
                    <span>Escolha &ldquo;Adicionar à Tela de Início&rdquo;</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Step n={3} />
                    <span>Confirme em &ldquo;Adicionar&rdquo;</span>
                  </li>
                </ol>
              ) : (
                <p className="text-xs leading-relaxed text-ink-600">
                  Abra o menu do navegador e escolha{" "}
                  <strong>&ldquo;Instalar app&rdquo;</strong> ou{" "}
                  <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>.
                </p>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-sm px-3 py-2 text-sm font-medium text-ink-500 transition-colors hover:text-ink-700"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-200 font-mono text-[11px] font-semibold text-green-800">
      {n}
    </span>
  )
}
