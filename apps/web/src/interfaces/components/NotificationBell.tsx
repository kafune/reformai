"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/shared/cn"
import { Icon } from "./ui/Icon"
import { isPushSupported, vapidPublicKey, isSubscribed, enablePush, disablePush } from "@/shared/push-client"

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  caseId: string | null
  createdAt: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "agora"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

/** Sino de notificações — vive no rodapé da sidebar (AppShell). */
export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [pushOn, setPushOn] = useState<boolean | null>(null) // null = indisponível
  const [pushBusy, setPushBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  async function load() {
    try {
      const res = await fetch("/api/v1/notifications")
      if (!res.ok) return
      const data = await res.json()
      setItems(Array.isArray(data.notifications) ? data.notifications : [])
    } catch {
      // silencioso — o sino não deve quebrar a navegação
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!isPushSupported() || !vapidPublicKey()) { setPushOn(null); return }
    isSubscribed().then(setPushOn).catch(() => setPushOn(false))
  }, [])

  // Fechar com clique fora
  useEffect(() => {
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    return () => document.removeEventListener("mousedown", onMouse)
  }, [])

  // Fechar com Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  async function togglePush() {
    setPushBusy(true)
    try {
      if (pushOn) { await disablePush(); setPushOn(false) }
      else { const ok = await enablePush(); setPushOn(ok) }
    } finally { setPushBusy(false) }
  }

  const unread = items.filter((n) => !n.read).length

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try { await fetch(`/api/v1/notifications/${id}`, { method: "PATCH" }) } catch { /* silencioso */ }
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await Promise.all(unreadIds.map((id) => fetch(`/api/v1/notifications/${id}`, { method: "PATCH" })))
    } catch { /* silencioso */ }
  }

  // Abrir notificação: marca como lida e, havendo caso, navega até ele.
  function openNotification(n: Notification) {
    if (!n.read) markRead(n.id)
    if (n.caseId) {
      setOpen(false)
      router.push(`/cases/${n.caseId}`)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
        aria-expanded={open}
        aria-haspopup="true"
        className="relative flex h-9 w-9 items-center justify-center rounded-sm text-bone-300 transition-colors hover:bg-white/5 hover:text-bone-50"
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-green-400 px-1 text-[10px] font-semibold text-ink-900">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            // Mobile: abre acima do botão, alinhado à direita, cabe dentro da sidebar (236px)
            // Desktop: abre à direita da sidebar, alinhado ao fundo do botão
            "absolute bottom-full right-0 mb-2 w-52",
            "lg:bottom-0 lg:mb-0 lg:right-auto lg:left-full lg:ml-2 lg:w-72",
            // z-[60]: acima da sidebar (z-50) e do banner de impersonação (z-[9999] não é necessário aqui)
            "z-[60] overflow-hidden rounded-md bg-surface shadow-3",
          )}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-divider px-3 py-2">
            <span className="text-xs font-semibold text-ink-700">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-[11px] font-medium text-green-700 hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto lg:max-h-80">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-8 text-center">
                <Icon name="bell" size={22} className="text-ink-200" />
                <p className="text-xs text-ink-400">Nenhuma notificação.</p>
              </div>
            ) : (
              items.map((n) => {
                // Interativa quando há ação possível: abrir o caso ou marcar lida.
                const interactive = !n.read || !!n.caseId
                return (
                  <div
                    key={n.id}
                    role={interactive ? "button" : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    onClick={() => interactive && openNotification(n)}
                    onKeyDown={(e) => { if (interactive && (e.key === "Enter" || e.key === " ")) openNotification(n) }}
                    className={cn(
                      "border-b border-divider px-3 py-2.5 last:border-0",
                      interactive && "cursor-pointer hover:bg-bone-100",
                      // Lidas: estáticas, sem feedback visual de interação
                      n.read && "opacity-60",
                      !n.read && "bg-[rgba(58,129,99,0.06)]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink-900">{n.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{n.body}</p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <p className="text-[11px] text-ink-400">{timeAgo(n.createdAt)}</p>
                          {n.caseId && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-700">
                              <Icon name="arrow" size={10} />
                              Abrir caso
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Rodapé: toggle de push notifications */}
          {pushOn !== null && (
            <button
              type="button"
              onClick={togglePush}
              disabled={pushBusy}
              className="flex w-full items-center gap-2 border-t border-divider px-3 py-2.5 text-left text-xs font-medium text-ink-700 transition-colors hover:bg-bone-100 disabled:opacity-60"
            >
              <Icon name={pushOn ? "bell" : "alert"} size={14} />
              {pushBusy
                ? "Aguarde…"
                : pushOn
                  ? "Desativar alertas do navegador"
                  : "Ativar alertas do navegador"}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
