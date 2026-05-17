"use client"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/shared/cn"
import { Icon } from "./ui/Icon"

interface Notification {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

/** Sino de notificações — vive na sidebar (AppShell). Auto-busca ao montar. */
export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const unread = items.filter((n) => !n.read).length

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    try {
      await fetch(`/api/v1/notifications/${id}`, { method: "PATCH" })
    } catch {
      // silencioso
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificações"
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
        <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-md bg-surface shadow-3">
          <div className="border-b border-divider px-3 py-2 text-xs font-semibold text-ink-700">
            Notificações
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-ink-400">
                Nenhuma notificação.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => !n.read && markRead(n.id)}
                  className={cn(
                    "block w-full border-b border-divider px-3 py-2.5 text-left last:border-0 hover:bg-bone-100",
                    !n.read && "bg-[rgba(58,129,99,0.06)]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-ink-900">{n.title}</p>
                      <p className="mt-0.5 text-xs text-ink-500">{n.body}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
