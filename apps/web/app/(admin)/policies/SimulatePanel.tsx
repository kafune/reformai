"use client"
import { useState } from "react"
import { Button, Select, Input, Badge } from "@/interfaces/components/ui"
import { KNOWN_SERVICES } from "@/shared/schemas/ReformScopeSchema"
import type { Policy } from "./types"

interface SimResult {
  policy: { id: string; name: string; version: number }
  result: {
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    triageScore: number
    requiresART: boolean
    requiresHumanReview: boolean
    mandatoryInspection: boolean
    recommendedStatus: string
    triggeredRules: Array<{ ruleId: string; ruleName: string; reason: string }>
  }
}

const RISK_TONE: Record<string, "green" | "ochre" | "clay" | "iron"> = {
  LOW: "green",
  MEDIUM: "ochre",
  HIGH: "clay",
  CRITICAL: "iron",
}

const FLAGS: Array<{ key: keyof FlagState; label: string }> = [
  { key: "affectsStructure", label: "Impacto estrutural" },
  { key: "affectsExternalFacade", label: "Fachada externa" },
  { key: "affectsCommonAreas", label: "Áreas comuns" },
  { key: "affectsNeighbors", label: "Afeta vizinhos" },
]

interface FlagState {
  affectsStructure: boolean
  affectsExternalFacade: boolean
  affectsCommonAreas: boolean
  affectsNeighbors: boolean
}

export function SimulatePanel({ policies }: { policies: Policy[] }) {
  const [policyId, setPolicyId] = useState("")
  const [services, setServices] = useState<string[]>([])
  const [flags, setFlags] = useState<FlagState>({
    affectsStructure: false,
    affectsExternalFacade: false,
    affectsCommonAreas: false,
    affectsNeighbors: false,
  })
  const [area, setArea] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SimResult | null>(null)

  function toggleService(s: string) {
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  async function run() {
    setError(null)
    if (services.length === 0) {
      setError("Selecione ao menos um serviço.")
      return
    }
    setLoading(true)
    setResult(null)
    const scope: Record<string, unknown> = { services, ...flags }
    const areaNum = Number(area)
    if (area && Number.isFinite(areaNum) && areaNum > 0) scope.estimatedArea = areaNum

    const res = await fetch("/api/v1/admin/policies/simulate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, policyId: policyId || undefined }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro na simulação.")
      return
    }
    setResult(await res.json())
  }

  return (
    <div className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
      <h2 className="mb-1 text-sm font-semibold text-ink-900">Simular triagem (e se…)</h2>
      <p className="mb-4 text-xs text-ink-500">
        Avalia um escopo hipotético contra uma política, sem salvar nada.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Select label="Política" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">Padrão (tenant/global ativa)</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.tenantId === null ? "(global)" : ""} · v{p.version}
              </option>
            ))}
          </Select>

          <Input
            label="Área estimada (m²)"
            type="number"
            min={0}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Opcional"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-700">Impactos</p>
            <div className="grid grid-cols-2 gap-1.5">
              {FLAGS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-xs text-ink-600">
                  <input
                    type="checkbox"
                    checked={flags[f.key]}
                    onChange={(e) => setFlags((s) => ({ ...s, [f.key]: e.target.checked }))}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-ink-700">Serviços</p>
          <div className="grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-sm border border-divider p-2">
            {KNOWN_SERVICES.map((s) => (
              <label key={s} className="flex items-center gap-2 text-xs text-ink-600">
                <input
                  type="checkbox"
                  checked={services.includes(s)}
                  onChange={() => toggleService(s)}
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}

      <div className="mt-4">
        <Button type="button" variant="primary" size="sm" disabled={loading} onClick={run}>
          {loading ? "Simulando…" : "Simular"}
        </Button>
      </div>

      {result && (
        <div className="mt-5 rounded-md border border-divider bg-bone-50 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge tone={RISK_TONE[result.result.riskLevel]}>{result.result.riskLevel}</Badge>
            <span className="text-sm text-ink-700">
              Score <strong>{result.result.triageScore}</strong>/100
            </span>
            <span className="text-xs text-ink-500">
              {result.policy.name} · v{result.policy.version}
            </span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Badge tone={result.result.requiresART ? "ochre" : "neutral"}>
              ART {result.result.requiresART ? "exigida" : "não"}
            </Badge>
            <Badge tone={result.result.requiresHumanReview ? "ochre" : "neutral"}>
              Revisão humana {result.result.requiresHumanReview ? "sim" : "não"}
            </Badge>
            <Badge tone={result.result.mandatoryInspection ? "ochre" : "neutral"}>
              Vistoria {result.result.mandatoryInspection ? "obrigatória" : "não"}
            </Badge>
            <Badge tone="neutral">{result.result.recommendedStatus}</Badge>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-ink-700">
              Regras acionadas ({result.result.triggeredRules.length})
            </p>
            {result.result.triggeredRules.length === 0 ? (
              <p className="text-xs text-ink-400">Nenhuma regra acionada.</p>
            ) : (
              <ul className="space-y-1">
                {result.result.triggeredRules.map((r) => (
                  <li key={r.ruleId} className="text-xs text-ink-600">
                    <strong>{r.ruleName}</strong> — {r.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
