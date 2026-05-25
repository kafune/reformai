"use client"
import { useState } from "react"
import { Button, Input, Select, Badge, RatingDisplay } from "@/interfaces/components/ui"
import { PARTNER_TYPE_LABELS, toCsv, fromCsv, type Partner } from "./types"

const toForm = (p: Partner) => ({
  name: p.name,
  creaNumber: p.creaNumber,
  type: p.type,
  specialties: toCsv(p.specialties),
  cities: toCsv(p.cities),
  states: toCsv(p.states),
  basePrice: String(p.basePrice),
  slaHours: p.slaHours == null ? "" : String(p.slaHours),
})

/** Linha de um parceiro: exibição e edição inline. */
export function PartnerCard({
  partner,
  onUpdated,
  onDeleted,
}: {
  partner: Partner
  onUpdated: (p: Partner) => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(toForm(partner))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const base = `/api/v1/admin/partners/${partner.id}`

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        creaNumber: form.creaNumber,
        type: form.type,
        specialties: fromCsv(form.specialties),
        cities: fromCsv(form.cities),
        states: fromCsv(form.states),
        basePrice: Number(form.basePrice),
        slaHours: form.slaHours ? Number(form.slaHours) : null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar parceiro.")
      return
    }
    onUpdated((await res.json()).partner)
    setEditing(false)
  }

  async function toggleActive() {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !partner.active }),
    })
    if (res.ok) onUpdated((await res.json()).partner)
  }

  async function remove() {
    if (partner.caseCount > 0 || partner.inspectionCount > 0) return
    if (!confirm(`Excluir o parceiro "${partner.name}"?`)) return
    setError(null)
    const res = await fetch(base, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao excluir parceiro.")
      return
    }
    onDeleted(partner.id)
  }

  const canDelete = partner.caseCount === 0 && partner.inspectionCount === 0
  const money = partner.basePrice.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  })

  if (editing) {
    return (
      <form onSubmit={saveEdit} className="rounded-lg bg-surface p-5 shadow-hair">
        <h3 className="mb-4 text-sm font-semibold text-ink-900">Editar parceiro</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Registro CREA/CAU"
            value={form.creaNumber}
            onChange={(e) => setForm((f) => ({ ...f, creaNumber: e.target.value }))}
            required
          />
          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="ENGINEER">Engenheiro</option>
            <option value="ARCHITECT">Arquiteto</option>
          </Select>
          <Input
            label="Preço base (R$)"
            type="number"
            min={0}
            step="0.01"
            value={form.basePrice}
            onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
            required
          />
          <Input
            label="SLA (horas)"
            type="number"
            min={1}
            value={form.slaHours}
            onChange={(e) => setForm((f) => ({ ...f, slaHours: e.target.value }))}
            placeholder="Opcional"
          />
          <Input
            label="Especialidades (separadas por vírgula)"
            value={form.specialties}
            onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))}
            placeholder="Elétrica, Hidráulica"
          />
          <Input
            label="Cidades (separadas por vírgula)"
            value={form.cities}
            onChange={(e) => setForm((f) => ({ ...f, cities: e.target.value }))}
            placeholder="São Paulo, Campinas"
          />
          <Input
            label="Estados (UF, separados por vírgula)"
            value={form.states}
            onChange={(e) => setForm((f) => ({ ...f, states: e.target.value }))}
            placeholder="SP, RJ"
          />
        </div>
        {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setForm(toForm(partner))
              setEditing(false)
              setError(null)
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="rounded-lg bg-surface p-5 shadow-hair">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ink-900">{partner.name}</span>
            <Badge tone="azulejo">{PARTNER_TYPE_LABELS[partner.type] ?? partner.type}</Badge>
            <Badge tone={partner.active ? "green" : "neutral"}>
              {partner.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            {partner.email} · {partner.creaNumber}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ink-500">
            <span>Preço base: <span className="text-ink-700">{money}</span></span>
            {partner.slaHours != null && <span>SLA: {partner.slaHours}h</span>}
            <span>{partner.caseCount} caso(s)</span>
            <span>{partner.inspectionCount} vistoria(s)</span>
            <RatingDisplay rating={partner.rating} count={partner.reviewCount} />
          </div>
          {partner.specialties.length > 0 && (
            <div className="mt-2 text-xs text-ink-500">
              Especialidades: {partner.specialties.join(", ")}
            </div>
          )}
          {(partner.cities.length > 0 || partner.states.length > 0) && (
            <div className="mt-1 text-xs text-ink-500">
              Atuação: {[...partner.cities, ...partner.states].join(", ")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs font-medium text-azulejo-700 hover:underline"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={toggleActive}
            className="text-xs font-medium text-green-700 hover:underline"
          >
            {partner.active ? "Desativar" : "Ativar"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={!canDelete}
            title={
              canDelete
                ? "Excluir parceiro"
                : "Parceiro com casos ou vistorias não pode ser excluído"
            }
            className="text-xs font-medium text-iron-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
          >
            Excluir
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
    </div>
  )
}
