"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

interface ReviewDecisionFormProps {
  caseId: string
}

const DECISION_OPTIONS = [
  { value: "approve", label: "Aprovar — liberar para encaminhamento" },
  { value: "approve_with_conditions", label: "Aprovar com condições" },
  { value: "reject", label: "Rejeitar — arquivar caso" },
  { value: "request_corrections", label: "Solicitar correções" },
] as const

type DecisionValue = (typeof DECISION_OPTIONS)[number]["value"]

export function ReviewDecisionForm({ caseId }: ReviewDecisionFormProps) {
  const router = useRouter()
  const [decision, setDecision] = useState<DecisionValue | "">("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!decision) {
      setError("Selecione uma decisão.")
      return
    }
    if (notes.trim().length < 10) {
      setError("A justificativa deve ter pelo menos 10 caracteres.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/review/${caseId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, notes: notes.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { message?: string }).message ?? `Erro ${res.status}`)
        return
      }

      router.push("/review-queue")
    } catch {
      setError("Erro de rede. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium text-zinc-700 mb-2">Decisão</legend>
        <div className="space-y-2">
          {DECISION_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="decision"
                value={opt.value}
                checked={decision === opt.value}
                onChange={() => setDecision(opt.value)}
                className="mt-0.5"
                data-testid={`review-decision-${opt.value}`}
              />
              <span className="text-sm text-zinc-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 mb-1">
          Justificativa <span className="text-slate-400">(mínimo 10 caracteres)</span>
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Descreva a justificativa para a decisão..."
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="review-notes"
        />
        <p className="text-xs text-slate-400 mt-1">{notes.trim().length} / 10 caracteres mínimos</p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !decision || notes.trim().length < 10}
        className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="review-submit"
      >
        {loading ? "Registrando…" : "Registrar decisão"}
      </button>
    </form>
  )
}
