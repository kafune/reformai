"use client"
import { useState } from "react"
import { Button, Input, Select, Badge, Icon } from "@/interfaces/components/ui"
import { UnitsPanel } from "./UnitsPanel"
import { UFS, type Condominium, type TenantRef } from "./constants"

const toForm = (c: Condominium) => ({
  name: c.name,
  cnpj: c.cnpj ?? "",
  address: c.address,
  city: c.city,
  state: c.state,
})

/** Cartão de um condomínio: exibe dados, edição inline e painel de unidades. */
export function CondominiumCard({
  condominium,
  tenants,
  isSuperAdmin,
  onUpdated,
  onDeleted,
}: {
  condominium: Condominium
  tenants: TenantRef[]
  isSuperAdmin: boolean
  onUpdated: (c: Condominium) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(toForm(condominium))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [moveTenantId, setMoveTenantId] = useState("")

  const base = `/api/v1/admin/condominiums/${condominium.id}`

  async function confirmMove() {
    if (!moveTenantId) return
    setError(null)
    setSaving(true)
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: moveTenantId }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao mover condomínio.")
      return
    }
    onUpdated((await res.json()).condominium)
    setMoving(false)
    setMoveTenantId("")
  }

  const canMove = condominium.caseCount === 0

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar condomínio.")
      return
    }
    onUpdated((await res.json()).condominium)
    setEditing(false)
  }

  async function toggleActive() {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !condominium.active }),
    })
    if (res.ok) onUpdated((await res.json()).condominium)
  }

  async function remove() {
    if (condominium.unitCount > 0 || condominium.caseCount > 0) return
    if (!confirm(`Excluir o condomínio "${condominium.name}"?`)) return
    setError(null)
    const res = await fetch(base, { method: "DELETE" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao excluir condomínio.")
      return
    }
    onDeleted(condominium.id)
  }

  const canDelete = condominium.unitCount === 0 && condominium.caseCount === 0

  return (
    <div className="rounded-lg bg-surface shadow-hair">
      {editing ? (
        <form onSubmit={saveEdit} className="grid gap-3 p-5 md:grid-cols-2">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="CNPJ"
            value={form.cnpj}
            onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
            placeholder="Opcional"
          />
          <Input
            label="Endereço"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            required
          />
          <Input
            label="Cidade"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            required
          />
          <Select
            label="Estado"
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
          >
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Select>
          {error && <p className="text-sm text-iron-600 md:col-span-2">{error}</p>}
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setForm(toForm(condominium))
                setEditing(false)
                setError(null)
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
                <span className="text-sm font-medium text-ink-900">{condominium.name}</span>
                <Badge tone={condominium.active ? "green" : "neutral"}>
                  {condominium.active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                {condominium.address} — {condominium.city}/{condominium.state}
                {condominium.cnpj && ` · CNPJ ${condominium.cnpj}`}
                {isSuperAdmin && condominium.tenant && ` · Tenant: ${condominium.tenant.name}`}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span>
              <span className="font-mono text-sm text-ink-700">{condominium.unitCount}</span>{" "}
              unidade(s)
            </span>
            <span>
              <span className="font-mono text-sm text-ink-700">{condominium.caseCount}</span>{" "}
              caso(s)
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs font-medium text-azulejo-700 hover:underline"
            >
              Editar
            </button>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  setMoveTenantId("")
                  setMoving((s) => !s)
                }}
                disabled={!canMove}
                title={
                  canMove
                    ? "Mover para outro tenant"
                    : "Condomínio com casos não pode ser movido"
                }
                className="text-xs font-medium text-azulejo-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
              >
                Mover
              </button>
            )}
            <button
              type="button"
              onClick={toggleActive}
              className="text-xs font-medium text-green-700 hover:underline"
            >
              {condominium.active ? "Desativar" : "Ativar"}
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={!canDelete}
              title={
                canDelete
                  ? "Excluir condomínio"
                  : "Condomínio com unidades ou casos não pode ser excluído"
              }
              className="text-xs font-medium text-iron-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
            >
              Excluir
            </button>
          </div>
        </div>
      )}

      {moving && !editing && (
        <div className="flex flex-wrap items-end gap-2 border-t border-divider px-5 py-3">
          <div className="min-w-[220px] flex-1">
            <Select
              label="Mover para o tenant"
              value={moveTenantId}
              onChange={(e) => setMoveTenantId(e.target.value)}
            >
              <option value="">Selecione o tenant de destino</option>
              {tenants
                .filter((t) => t.id !== condominium.tenantId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </Select>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving || !moveTenantId}
            onClick={confirmMove}
          >
            {saving ? "Movendo…" : "Confirmar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMoving(false)}>
            Cancelar
          </Button>
        </div>
      )}

      {error && !editing && <p className="px-5 pb-3 text-sm text-iron-600">{error}</p>}

      {expanded && !editing && (
        <UnitsPanel
          condominiumId={condominium.id}
          onCountChange={(delta) =>
            onUpdated({ ...condominium, unitCount: condominium.unitCount + delta })
          }
        />
      )}
    </div>
  )
}
