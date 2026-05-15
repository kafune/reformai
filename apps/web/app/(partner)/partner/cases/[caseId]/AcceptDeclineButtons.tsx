"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface AcceptDeclineButtonsProps {
  partnerId: string
  caseId: string
}

export function AcceptDeclineButtons({ partnerId, caseId }: AcceptDeclineButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setLoading("accept")
    setError(null)
    try {
      const res = await fetch(`/api/v1/partners/${partnerId}/cases/${caseId}/accept`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? `Erro ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar caso")
    } finally {
      setLoading(null)
    }
  }

  async function handleDecline() {
    if (reason.trim().length < 5) {
      setError("O motivo deve ter pelo menos 5 caracteres.")
      return
    }
    setLoading("decline")
    setError(null)
    try {
      const res = await fetch(`/api/v1/partners/${partnerId}/cases/${caseId}/decline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? `Erro ${res.status}`)
      }
      router.push("/partner/cases")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recusar caso")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={loading !== null}
          className="rounded bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading === "accept" ? "Aceitando…" : "Aceitar caso"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeclineModal(true)}
          disabled={loading !== null}
          className="rounded border border-red-300 bg-white px-5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Recusar caso
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Decline modal */}
      {showDeclineModal && (
        <div className="mt-3 border border-red-200 bg-red-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">Motivo da recusa</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Informe o motivo da recusa (mínimo 5 caracteres)…"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <p className="text-xs text-slate-400">{reason.trim().length} / 5 caracteres mínimos</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDecline}
              disabled={loading !== null || reason.trim().length < 5}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading === "decline" ? "Recusando…" : "Confirmar recusa"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDeclineModal(false)
                setReason("")
                setError(null)
              }}
              disabled={loading !== null}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
