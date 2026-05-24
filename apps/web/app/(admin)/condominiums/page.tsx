"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select } from "@/interfaces/components/ui"
import { CondominiumCard } from "./CondominiumCard"
import { UFS, type Condominium, type Tenant } from "./constants"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const EMPTY_FORM = { name: "", cnpj: "", address: "", city: "", state: "SP", tenantId: "" }

export default function CondominiumsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = session?.user?.role ?? ""
  const isAdmin = ADMIN_ROLES.has(role)
  const isSuperAdmin = role === "SUPER_ADMIN"

  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filterTenantId, setFilterTenantId] = useState("")
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) router.replace("/dashboard")
  }, [status, isAdmin, router])

  /** Carrega a lista de tenants (só SUPER_ADMIN precisa). */
  useEffect(() => {
    if (!isSuperAdmin) return
    fetch("/api/v1/superadmin/tenants")
      .then((r) => r.json())
      .then((d) => setTenants(d.tenants ?? []))
      .catch(() => {})
  }, [isSuperAdmin])

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filterTenantId ? `?tenantId=${filterTenantId}` : ""
    const res = await fetch(`/api/v1/admin/condominiums${qs}`)
    if (res.ok) setCondominiums((await res.json()).condominiums ?? [])
    setLoading(false)
  }, [filterTenantId])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSuperAdmin && !form.tenantId) {
      setError("Selecione o tenant para o qual o condomínio será criado.")
      return
    }

    setSaving(true)
    const payload = {
      name: form.name,
      cnpj: form.cnpj || undefined,
      address: form.address,
      city: form.city,
      state: form.state,
      ...(isSuperAdmin && form.tenantId ? { tenantId: form.tenantId } : {}),
    }
    const res = await fetch("/api/v1/admin/condominiums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao criar condomínio.")
      return
    }
    const { condominium } = await res.json()
    setCondominiums((prev) =>
      [...prev, condominium].sort((a, b) => a.name.localeCompare(b.name)),
    )
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleUpdated(updated: Condominium) {
    setCondominiums((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  function handleDeleted(id: string) {
    setCondominiums((prev) => prev.filter((c) => c.id !== id))
  }

  if (status !== "authenticated" || !isAdmin) return null

  return (
    <>
      <TopBar
        title="Condomínios"
        subtitle={`${condominiums.length} condomínio(s) cadastrado(s)`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancelar" : "Novo condomínio"}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {/* Filtro por tenant (só SUPER_ADMIN) */}
        {isSuperAdmin && (
          <div className="mb-4 flex items-center gap-3">
            <Select
              label="Filtrar por tenant"
              value={filterTenantId}
              onChange={(e) => setFilterTenantId(e.target.value)}
            >
              <option value="">Todos os tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Formulário de criação */}
        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Novo condomínio</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {/* Seletor de tenant (só SUPER_ADMIN) */}
              {isSuperAdmin && (
                <div className="md:col-span-2">
                  <Select
                    label="Tenant *"
                    value={form.tenantId}
                    onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                    required
                  >
                    <option value="">Selecione o tenant</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.slug})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Condomínio Exemplo"
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
                placeholder="Rua, número, bairro"
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
            </div>
            {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Criando…" : "Criar condomínio"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : condominiums.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhum condomínio cadastrado</p>
            <p className="mt-1 text-sm text-ink-400">
              Crie o primeiro condomínio para começar.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {condominiums.map((c) => (
              <CondominiumCard
                key={c.id}
                condominium={c}
                isSuperAdmin={isSuperAdmin}
                tenants={tenants}
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
