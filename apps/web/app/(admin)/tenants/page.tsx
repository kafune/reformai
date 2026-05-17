"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select, Badge, Eyebrow } from "@/interfaces/components/ui"

interface Tenant {
  id: string
  name: string
  slug: string
  type: string
  active: boolean
  createdAt: string
  userCount: number
  condominiumCount: number
  caseCount: number
}

const TYPE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  ADMINISTRADORA: "Administradora",
  STANDALONE: "Standalone",
}

const COLS = "grid min-w-[720px] grid-cols-[1fr_130px_70px_70px_70px_150px] items-center gap-4"

export default function TenantsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", type: "ADMINISTRADORA" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isSuperAdmin) router.replace("/dashboard")
  }, [status, isSuperAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch("/api/v1/superadmin/tenants")
    if (res.ok) {
      const data = await res.json()
      setTenants(data.tenants ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch("/api/v1/superadmin/tenants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao criar tenant.")
      return
    }
    setForm({ name: "", slug: "", type: "ADMINISTRADORA" })
    setShowForm(false)
    load()
  }

  async function toggleActive(id: string) {
    const res = await fetch(`/api/v1/superadmin/tenants/${id}`, { method: "PATCH" })
    if (res.ok) {
      const data = await res.json()
      setTenants((prev) =>
        prev.map((t) => (t.id === id ? { ...t, active: data.tenant.active } : t)),
      )
    }
  }

  if (status !== "authenticated" || !isSuperAdmin) return null

  return (
    <>
      <TopBar
        title="Tenants"
        subtitle={`${tenants.length} tenant(s) na plataforma`}
        actions={
          <Button variant="primary" size="sm" icon="plus" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "Novo tenant"}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Novo tenant</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                placeholder="Administradora Exemplo"
              />
              <Input
                label="Slug"
                mono
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                required
                placeholder="administradora-exemplo"
              />
              <Select
                label="Tipo"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="ADMINISTRADORA">Administradora</option>
                <option value="STANDALONE">Standalone</option>
                <option value="ADMIN">Admin</option>
              </Select>
            </div>
            {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Criando…" : "Criar tenant"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : tenants.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhum tenant cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-surface shadow-hair">
            <div className={`${COLS} border-b border-divider bg-bone-50 px-5 py-3`}>
              <Eyebrow>Nome</Eyebrow>
              <Eyebrow>Tipo</Eyebrow>
              <Eyebrow>Usuários</Eyebrow>
              <Eyebrow>Condos</Eyebrow>
              <Eyebrow>Casos</Eyebrow>
              <Eyebrow>Status</Eyebrow>
            </div>
            <div className="divide-y divide-divider">
              {tenants.map((t) => (
                <div key={t.id} className={`${COLS} px-5 py-4 transition-colors hover:bg-bone-50`}>
                  <div>
                    <div className="text-sm font-medium text-ink-900">{t.name}</div>
                    <div className="font-mono text-xs text-ink-500">{t.slug}</div>
                  </div>
                  <span className="text-sm text-ink-600">{TYPE_LABELS[t.type] ?? t.type}</span>
                  <span className="font-mono text-sm text-ink-600">{t.userCount}</span>
                  <span className="font-mono text-sm text-ink-600">{t.condominiumCount}</span>
                  <span className="font-mono text-sm text-ink-600">{t.caseCount}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={t.active ? "green" : "neutral"}>
                      {t.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => toggleActive(t.id)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      {t.active ? "Desativar" : "Ativar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
