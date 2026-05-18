"use client"
import { useState } from "react"
import { Button, Badge, Eyebrow, RiskBadge, type RiskLevel } from "@/interfaces/components/ui"
import type { ReviewCase } from "./types"

type Decision = "approve" | "request_corrections"

/** Cartão de um caso na fila de revisão do parceiro, com formulário de decisão. */
export function ReviewCaseCard({
  reviewCase,
  onResolved,
}: {
  reviewCase: ReviewCase
  onResolved: (caseId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [decision, setDecision] = useState<Decision | "">("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evaluation = reviewCase.evaluationResult
  const scope = reviewCase.reformScope
  const services = scope?.services ?? []

  async function submit(e: React.FormEvent) {
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
    setSaving(true)
    const res = await fetch(`/api/v1/partner/review/${reviewCase.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision, notes: notes.trim() }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao registrar a decisão.")
      return
    }
    onResolved(reviewCase.id)
  }

  return (
    <div className="rounded-lg bg-surface shadow-hair">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-ink-500">{reviewCase.protocol}</span>
            {reviewCase.requiresART && <Badge tone="azulejo">Exige ART</Badge>}
          </div>
          <div className="mt-0.5 text-sm font-medium text-ink-900">
            {reviewCase.condominium.name}
          </div>
          <div className="text-xs text-ink-500">
            Unidade {reviewCase.unit.identifier} ·{" "}
            {new Date(reviewCase.createdAt).toLocaleDateString("pt-BR")}
          </div>
        </div>
        {reviewCase.riskLevel && (
          <RiskBadge
            level={reviewCase.riskLevel as RiskLevel}
            score={reviewCase.triageScore ?? undefined}
            size="sm"
          />
        )}
        <Button
          variant={open ? "ghost" : "primary"}
          size="sm"
          onClick={() => setOpen((s) => !s)}
        >
          {open ? "Fechar" : "Revisar"}
        </Button>
      </div>

      {open && (
        <div className="border-t border-divider bg-bone-50 px-5 py-4">
          {/* Escopo */}
          <Eyebrow>Escopo da obra</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {services.length > 0 ? (
              services.map((s) => (
                <span
                  key={s}
                  className="rounded-sm bg-surface px-2 py-1 text-xs text-ink-700 shadow-hair"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-400">Sem serviços declarados.</span>
            )}
          </div>
          {scope?.description && (
            <p className="mt-2 text-sm text-ink-600">{scope.description}</p>
          )}

          {/* Triagem automática */}
          {evaluation && (
            <div className="mt-4">
              <Eyebrow>Triagem automática</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-600">
                <span>Score: <span className="font-mono text-ink-900">{evaluation.triageScore}</span></span>
                <span>Exige ART: {evaluation.requiresART ? "Sim" : "Não"}</span>
                <span>Vistoria obrigatória: {evaluation.mandatoryInspection ? "Sim" : "Não"}</span>
              </div>
              {evaluation.triggeredRules.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {evaluation.triggeredRules.map((r) => (
                    <li key={r.ruleId} className="text-xs text-ink-500">
                      <span className="font-medium text-ink-700">{r.ruleName}</span> — {r.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Decisão */}
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Eyebrow>Decisão do responsável técnico</Eyebrow>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "approve", label: "Aprovar — segue para a proposta ao morador" },
                  {
                    value: "request_corrections",
                    label: "Solicitar correções — devolve ao morador",
                  },
                ] as const
              ).map((opt) => {
                const selected = decision === opt.value
                return (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-sm border px-4 py-3 transition-colors ${
                      selected
                        ? "border-green-700 bg-green-50"
                        : "border-line-strong bg-surface hover:bg-bone-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`decision-${reviewCase.id}`}
                      value={opt.value}
                      checked={selected}
                      onChange={() => setDecision(opt.value)}
                      className="sr-only"
                    />
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? "border-green-700 bg-green-700" : "border-ink-300 bg-surface"
                      }`}
                    >
                      {selected && <span className="h-1.5 w-1.5 rounded-full bg-bone-50" />}
                    </span>
                    <span
                      className={`text-sm ${selected ? "font-medium text-green-800" : "text-ink-700"}`}
                    >
                      {opt.label}
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-700">
                Justificativa <span className="font-normal text-ink-400">(mín. 10 caracteres)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Parecer técnico sobre a triagem…"
                className="w-full rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>

            {error && <p className="text-sm text-iron-600">{error}</p>}

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || !decision || notes.trim().length < 10}
            >
              {saving ? "Registrando…" : "Registrar decisão"}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
