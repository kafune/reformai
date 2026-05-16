"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/interfaces/components/ui"

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
          className="inline-flex items-center justify-center rounded-sm border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:bg-bone-100"
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
            className="h-8 rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={loading || !newDate}
          >
            {loading ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              setError(null)
            }}
            disabled={loading}
          >
            Cancelar
          </Button>
          {error && <p className="text-xs text-clay-600 w-full">{error}</p>}
        </div>
      )}
    </div>
  )
}
