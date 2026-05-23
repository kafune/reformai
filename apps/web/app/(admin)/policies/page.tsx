"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select } from "@/interfaces/components/ui"
import { PolicyCard } from "./PolicyCard"
import { SimulatePanel } from "./SimulatePanel"
import type { Policy } from "./types"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const EMPTY_FORM = { name: "", description: "", scope: "tenant" }

export default function PoliciesPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = session?.user?.role ?? ""
  const isAdmin = ADMIN_ROLES.has(role)
  const isSuperAdmin = role === "SUPER_ADMIN"

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) router.replace("/dashboard")
  }, [status, isAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/v1/admin/policies")
    if (res.ok) setPolicies((await res.json()).policies ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch("/api/v1/admin/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || undefined,
        scope: form.scope,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao criar política.")
      return
    }
    const policy: Policy = await res.json()
    setPolicies((prev) => [policy, ...prev])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleUpdated(updated: Policy) {
    setPolicies((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleDeleted(id: string) {
    setPolicies((prev) => prev.filter((p) => p.id !== id))
  }

  if (status !== "authenticated" || !isAdmin) return null

  return (
    <>
      <TopBar
        title="Políticas"
        subtitle={`${policies.length} política(s) — regras determinísticas de triagem`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon="search" onClick={() => setShowSim((s) => !s)}>
              {showSim ? "Fechar simulação" : "Simular"}
            </Button>
            <Button variant="primary" size="sm" icon="plus" onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancelar" : "Nova política"}
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {showSim && <SimulatePanel policies={policies} />}

        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Nova política</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Política do condomínio X"
              />
              <Input
                label="Descrição"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Opcional"
              />
              <Select
                label="Abrangência"
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
              >
                <option value="tenant">Tenant (apenas esta organização)</option>
                {isSuperAdmin && (
                  <option value="global">Global (todos os tenants)</option>
                )}
              </Select>
            </div>
            {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Criando…" : "Criar política"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : policies.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhuma política cadastrada</p>
            <p className="mt-1 text-sm text-ink-400">
              Crie uma política e adicione regras de classificação de risco.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {policies.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                canEdit={p.tenantId === null ? isSuperAdmin : true}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
