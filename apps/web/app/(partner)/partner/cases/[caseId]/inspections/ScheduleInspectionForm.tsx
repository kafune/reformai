"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

const INSPECTION_TYPES = [
  { value: "INITIAL", label: "Inicial" },
  { value: "INTERMEDIATE", label: "Intermediária" },
  { value: "FINAL", label: "Final" },
  { value: "EXTRA", label: "Extra" },
  { value: "CRITICAL_SYSTEM", label: "Sistema crítico" },
] as const

type InspectionTypeValue = (typeof INSPECTION_TYPES)[number]["value"]

interface ScheduleInspectionFormProps {
  caseId: string
}

export function ScheduleInspectionForm({ caseId }: ScheduleInspectionFormProps) {
  const router = useRouter()
  const [type, setType] = useState<InspectionTypeValue>("INITIAL")
  const [scheduledAt, setScheduledAt] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!scheduledAt) {
      setError("Selecione uma data e hora.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/inspections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          scheduledAt: new Date(scheduledAt).toISOString(),
          notes: notes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { message?: string }).message ?? `Erro ${res.status}`)
      }

      setScheduledAt("")
      setNotes("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao agendar vistoria")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="insp-type" className="block text-xs font-medium text-slate-700 mb-1">
            Tipo de vistoria
          </label>
          <select
            id="insp-type"
            value={type}
            onChange={(e) => setType(e.target.value as InspectionTypeValue)}
            disabled={loading}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {INSPECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="insp-date" className="block text-xs font-medium text-slate-700 mb-1">
            Data e hora
          </label>
          <input
            id="insp-date"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={loading}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="insp-notes" className="block text-xs font-medium text-slate-700 mb-1">
          Notas (opcional)
        </label>
        <textarea
          id="insp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={loading}
          placeholder="Observações sobre a vistoria…"
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !scheduledAt}
        className="rounded bg-emerald-700 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Agendando…" : "Agendar vistoria"}
      </button>
    </form>
  )
}
