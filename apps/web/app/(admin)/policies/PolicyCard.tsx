"use client"
import { useState } from "react"
import { KNOWN_SERVICES } from "@/shared/schemas/ReformScopeSchema"
import { Button, Input, Select, Badge, Switch, Icon, Eyebrow } from "@/interfaces/components/ui"
import {
  type Policy,
  type RuleDraft,
  ruleToDraft,
  draftToPayload,
} from "./types"

const BLANK_RULE: RuleDraft = {
  name: "",
  description: "",
  service: KNOWN_SERVICES[0],
  riskDelta: "10",
  priority: "100",
  requiresART: false,
  requiresHumanReview: false,
  mandatoryInspection: false,
  active: true,
}

/** Cartão de uma política: cabeçalho editável + editor de regras. */
export function PolicyCard({
  policy,
  canEdit,
  onUpdated,
  onDeleted,
}: {
  policy: Policy
  canEdit: boolean
  onUpdated: (p: Policy) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editingHeader, setEditingHeader] = useState(false)
  const [header, setHeader] = useState({
    name: policy.name,
    description: policy.description ?? "",
  })
  const [editingRules, setEditingRules] = useState(false)
  const [drafts, setDrafts] = useState<RuleDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/api/v1/admin/policies/${policy.id}`
  const isGlobal = policy.tenantId === null

  async function saveHeader(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: header.name, description: header.description || null }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar política.")
      return
    }
    onUpdated(await res.json())
    setEditingHeader(false)
  }

  async function toggleActive() {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !policy.active }),
    })
    if (res.ok) onUpdated(await res.json())
  }

  async function remove() {
    if (!confirm(`Excluir a política "${policy.name}" e todas as suas regras?`)) return
    setError(null)
    const res = await fetch(base, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao excluir política.")
      return
    }
    onDeleted(policy.id)
  }

  function startEditingRules() {
    setDrafts(policy.rules.map(ruleToDraft))
    setEditingRules(true)
    setExpanded(true)
    setError(null)
  }

  function updateDraft(index: number, patch: Partial<RuleDraft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  async function saveRules() {
    if (drafts.some((d) => !d.name.trim() || !d.description.trim())) {
      setError("Toda regra precisa de nome e descrição.")
      return
    }
    setError(null)
    setSaving(true)
    const res = await fetch(`${base}/rules`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rules: drafts.map(draftToPayload) }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar regras.")
      return
    }
    onUpdated(await res.json())
    setEditingRules(false)
  }

  return (
    <div className="rounded-lg bg-surface shadow-hair">
      {/* ─── Cabeçalho ─────────────────────────────────────────── */}
      {editingHeader ? (
        <form onSubmit={saveHeader} className="grid gap-3 p-5">
          <Input
            label="Nome da política"
            value={header.name}
            onChange={(e) => setHeader((h) => ({ ...h, name: e.target.value }))}
            required
          />
          <Input
            label="Descrição"
            value={header.description}
            onChange={(e) => setHeader((h) => ({ ...h, description: e.target.value }))}
            placeholder="Opcional"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setHeader({ name: policy.name, description: policy.description ?? "" })
                setEditingHeader(false)
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="flex flex-1 items-center gap-3 text-left"
          >
            <Icon name={expanded ? "chev" : "chevR"} size={14} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink-900">{policy.name}</span>
                {isGlobal && <Badge tone="azulejo">Global</Badge>}
                <Badge tone={policy.active ? "green" : "neutral"}>
                  {policy.active ? "Ativa" : "Inativa"}
                </Badge>
              </div>
              {policy.description && (
                <div className="mt-0.5 text-xs text-ink-500">{policy.description}</div>
              )}
            </div>
          </button>

          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span className="font-mono">v{policy.version}</span>
            <span>{policy.rules.length} regra(s)</span>
          </div>

          {canEdit ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditingHeader(true)}
                className="text-xs font-medium text-azulejo-700 hover:underline"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={toggleActive}
                className="text-xs font-medium text-green-700 hover:underline"
              >
                {policy.active ? "Desativar" : "Ativar"}
              </button>
              <button
                type="button"
                onClick={remove}
                className="text-xs font-medium text-iron-600 hover:underline"
              >
                Excluir
              </button>
            </div>
          ) : (
            <span className="text-xs text-ink-400">Somente leitura</span>
          )}
        </div>
      )}

      {error && <p className="px-5 pb-3 text-sm text-iron-600">{error}</p>}

      {/* ─── Regras ────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-divider bg-bone-50 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>Regras</Eyebrow>
            {canEdit &&
              (editingRules ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="plus"
                    onClick={() => setDrafts((prev) => [...prev, { ...BLANK_RULE }])}
                  >
                    Adicionar regra
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={saveRules}
                    disabled={saving}
                  >
                    {saving ? "Salvando…" : "Salvar regras"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingRules(false)
                      setError(null)
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" icon="settings" onClick={startEditingRules}>
                  Editar regras
                </Button>
              ))}
          </div>

          {editingRules ? (
            <div className="space-y-3">
              {drafts.length === 0 && (
                <p className="text-sm text-ink-400">
                  Nenhuma regra. Use “Adicionar regra” para começar.
                </p>
              )}
              {drafts.map((d, i) => (
                <div key={i} className="rounded-lg bg-surface p-4 shadow-hair">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      label="Nome"
                      value={d.name}
                      onChange={(e) => updateDraft(i, { name: e.target.value })}
                    />
                    <Select
                      label="Serviço (condição)"
                      value={d.service}
                      onChange={(e) => updateDraft(i, { service: e.target.value })}
                    >
                      {KNOWN_SERVICES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Descrição (motivo exibido)"
                      value={d.description}
                      onChange={(e) => updateDraft(i, { description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="+ Score"
                        type="number"
                        value={d.riskDelta}
                        onChange={(e) => updateDraft(i, { riskDelta: e.target.value })}
                      />
                      <Input
                        label="Prioridade"
                        type="number"
                        value={d.priority}
                        onChange={(e) => updateDraft(i, { priority: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                    <label className="flex items-center gap-2 text-xs text-ink-700">
                      <Switch
                        checked={d.requiresART}
                        onCheckedChange={(v) => updateDraft(i, { requiresART: v })}
                      />
                      Exige ART
                    </label>
                    <label className="flex items-center gap-2 text-xs text-ink-700">
                      <Switch
                        checked={d.requiresHumanReview}
                        onCheckedChange={(v) => updateDraft(i, { requiresHumanReview: v })}
                      />
                      Revisão humana
                    </label>
                    <label className="flex items-center gap-2 text-xs text-ink-700">
                      <Switch
                        checked={d.mandatoryInspection}
                        onCheckedChange={(v) => updateDraft(i, { mandatoryInspection: v })}
                      />
                      Vistoria obrigatória
                    </label>
                    <label className="flex items-center gap-2 text-xs text-ink-700">
                      <Switch
                        checked={d.active}
                        onCheckedChange={(v) => updateDraft(i, { active: v })}
                      />
                      Regra ativa
                    </label>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-auto text-xs font-medium text-iron-600 hover:underline"
                    >
                      Remover regra
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : policy.rules.length === 0 ? (
            <p className="text-sm text-ink-400">Nenhuma regra cadastrada.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg bg-surface shadow-hair">
              <div className="grid min-w-[680px] grid-cols-[1fr_70px_70px_70px_70px_70px] items-center gap-3 border-b border-divider bg-bone-50 px-4 py-2">
                <Eyebrow>Regra</Eyebrow>
                <Eyebrow>Score</Eyebrow>
                <Eyebrow>ART</Eyebrow>
                <Eyebrow>Revisão</Eyebrow>
                <Eyebrow>Vistoria</Eyebrow>
                <Eyebrow>Ativa</Eyebrow>
              </div>
              <div className="divide-y divide-divider">
                {policy.rules.map((r) => (
                  <div
                    key={r.id}
                    className="grid min-w-[680px] grid-cols-[1fr_70px_70px_70px_70px_70px] items-center gap-3 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-ink-900">{r.name}</div>
                      <div className="text-xs text-ink-500">{r.description}</div>
                    </div>
                    <span className="font-mono text-sm text-ink-700">
                      +{r.action?.riskDelta ?? 0}
                    </span>
                    <span className="text-xs">{r.action?.requiresART ? "Sim" : "—"}</span>
                    <span className="text-xs">
                      {r.action?.requiresHumanReview ? "Sim" : "—"}
                    </span>
                    <span className="text-xs">
                      {r.action?.mandatoryInspection ? "Sim" : "—"}
                    </span>
                    <span className="text-xs">{r.active ? "Sim" : "Não"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
