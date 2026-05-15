"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface RescheduleButtonProps {
  caseId: string
  inspectionId: string
  currentScheduledAt: string
}

export function RescheduleButton({ caseId, inspectionId, currentScheduledAt }: RescheduleButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [newDate, setNewDate] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill with existing date formatted for datetime-local
  function handleOpen() {
    if (currentScheduledAt) {
      // Format ISO string to datetime-local value (YYYY-MM-DDTHH:mm)
      try {
        const d = new Date(currentScheduledAt)
        const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16)
        setNewDate(local)
      } catch {
        setNewDate("")
      }
    }
    setOpen(true)
  }

  async function handleSave() {
    if (!newDate) {
      setError("Selecione uma data.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/inspections/${inspectionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(newDate).toISOString() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? `Erro ${res.status}`)
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao reagendar")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-block">
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Reagendar
        </button>
      )}

      {open && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            disabled={loading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || !newDate}
            className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setError(null)
            }}
            disabled={loading}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        </div>
      )}
    </div>
  )
}
