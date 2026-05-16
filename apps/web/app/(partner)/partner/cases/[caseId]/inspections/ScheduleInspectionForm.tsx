"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/interfaces/components/ui"

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="insp-type"
            className="text-sm font-medium text-ink-700"
          >
            Tipo de vistoria
          </label>
          <div className="relative">
            <select
              id="insp-type"
              value={type}
              onChange={(e) => setType(e.target.value as InspectionTypeValue)}
              disabled={loading}
              className="h-10 w-full appearance-none rounded-sm border border-line-strong bg-surface pl-3 pr-9 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60"
            >
              {INSPECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="insp-date"
            className="text-sm font-medium text-ink-700"
          >
            Data e hora
          </label>
          <input
            id="insp-date"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            disabled={loading}
            className="h-10 w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="insp-notes" className="text-sm font-medium text-ink-700">
          Notas{" "}
          <span className="text-ink-400 font-normal">(opcional)</span>
        </label>
        <textarea
          id="insp-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          disabled={loading}
          placeholder="Observações sobre a vistoria…"
          className="w-full rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink-900 outline-none focus:ring-2 focus:ring-green-600/40 disabled:opacity-60 placeholder:text-ink-400"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-sm border border-clay-300 bg-clay-50 px-3 py-2 text-sm text-clay-700">
          {error}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        size="md"
        icon="plus"
        disabled={loading || !scheduledAt}
      >
        {loading ? "Agendando…" : "Agendar vistoria"}
      </Button>
    </form>
  )
}
