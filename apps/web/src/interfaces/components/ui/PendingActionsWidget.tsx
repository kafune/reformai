"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import type { PendingAction, ActionUrgency } from "@/modules/case-intake/application/GetPendingActionsUseCase"

const APP_TITLE = "ReformAI"

const URGENCY_STYLES: Record<
  ActionUrgency,
  { border: string; badge: string; dot: string }
> = {
  critical: {
    border: "border-l-[3px] border-l-iron-600",
    badge: "bg-iron-100 text-iron-700",
    dot: "bg-iron-600",
  },
  high: {
    border: "border-l-[3px] border-l-ochre-500",
    badge: "bg-ochre-100 text-ochre-700",
    dot: "bg-ochre-500",
  },
  normal: {
    border: "",
    badge: "bg-bone-200 text-ink-600",
    dot: "bg-bone-400",
  },
}

const URGENCY_LABELS: Record<ActionUrgency, string> = {
  critical: "Urgente",
  high: "Alta prioridade",
  normal: "Normal",
}

export function PendingActionsWidget() {
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me/pending-actions")
      if (!res.ok) throw new Error("fetch failed")
      const data = await res.json()
      setActions(data.actions ?? [])
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActions()
    const interval = setInterval(fetchActions, 60_000)
    return () => clearInterval(interval)
  }, [fetchActions])

  // Update document title with pending count
  useEffect(() => {
    if (actions.length > 0) {
      document.title = `(${actions.length}) ${APP_TITLE}`
    } else {
      document.title = APP_TITLE
    }
    return () => {
      document.title = APP_TITLE
    }
  }, [actions.length])

  if (loading) {
    return (
      <div className="mb-6 rounded-md bg-surface shadow-hair">
        <div className="flex items-center gap-2 border-b border-divider px-5 py-4">
          <span className="h-4 w-32 animate-pulse rounded bg-bone-200" />
        </div>
        <div className="px-5 py-4 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded bg-bone-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return null
  }

  if (actions.length === 0) {
    return (
      <div className="mb-6 rounded-md bg-surface shadow-hair">
        <div className="flex items-center justify-between border-b border-divider px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">Pendencias</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-5 py-8 text-center">
          <span className="mb-2 text-2xl" role="img" aria-label="Tudo em dia">
            ✅
          </span>
          <p className="text-sm font-medium text-ink-700">Tudo em dia!</p>
          <p className="mt-1 text-xs text-ink-400">
            Nenhuma ação pendente no momento.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-md bg-surface shadow-hair">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-divider px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">Pendencias</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-iron-600 px-1.5 font-mono text-[11px] font-semibold text-bone-50">
            {actions.length}
          </span>
        </div>
      </div>

      {/* Action list */}
      <ul className="divide-y divide-divider">
        {actions.map((action) => {
          const styles = URGENCY_STYLES[action.urgency]
          return (
            <li
              key={`${action.caseId}-${action.type}`}
              className={`flex items-start justify-between gap-4 px-5 py-4 ${styles.border}`}
            >
              <div className="min-w-0 flex-1">
                {/* Protocol + unit */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] tracking-wide text-ink-500">
                    {action.protocol}
                  </span>
                  <span className="text-xs text-ink-400">·</span>
                  <span className="text-xs font-medium text-ink-700">
                    Un. {action.unitIdentifier}
                  </span>
                  <span className="text-xs text-ink-400">·</span>
                  <span className="text-xs text-ink-500">{action.condominiumName}</span>
                </div>

                {/* Description */}
                <p className="mt-1 text-sm text-ink-900">{action.description}</p>

                {/* Urgency badge */}
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
                  {URGENCY_LABELS[action.urgency]}
                </span>
              </div>

              {/* CTA */}
              <Link
                href={action.href}
                className="mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-sm border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:bg-bone-100"
              >
                Ir para o caso
                <span aria-hidden>→</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
