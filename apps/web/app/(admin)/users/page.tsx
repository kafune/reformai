"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select, Badge, Eyebrow } from "@/interfaces/components/ui"

interface TenantRef {
  id: string
  name: string
  slug: string
}
interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
  tenant: TenantRef
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Gerente",
  CONDOMINIUM: "Síndico",
  CLIENT: "Morador",
  PARTNER: "Parceiro",
}
const ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CONDOMINIUM", "CLIENT", "PARTNER"] as const

const COLS = "grid min-w-[760px] grid-cols-[1fr_120px_180px_150px] items-center gap-4"

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "ADMIN",
  tenantId: "",
}

export default function UsersPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [tenants, setTenants] = useState<TenantRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isSuperAdmin) router.replace("/dashboard")
  }, [status, isSuperAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, tenantsRes] = await Promise.all([
      fetch("/api/v1/superadmin/users"),
      fetch("/api/v1/superadmin/tenants"),
    ])
    if (usersRes.ok) setUsers((await usersRes.json()).users ?? [])
    if (tenantsRes.ok) setTenants((await tenantsRes.json()).tenants ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.tenantId) {
      setError("Selecione o tenant.")
      return
    }
    setSaving(true)
    const res = await fetch("/api/v1/superadmin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao criar usuário.")
      return
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  async function toggleActive(id: string) {
    const res = await fetch(`/api/v1/superadmin/users/${id}`, { method: "PATCH" })
    if (res.ok) {
      const data = await res.json()
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, active: data.user.active } : u)),
      )
    }
  }

  if (status !== "authenticated" || !isSuperAdmin) return null

  return (
    <>
      <TopBar
        title="Usuários"
        subtitle={`${users.length} usuário(s) na plataforma`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setShowForm((s) => !s)}
            disabled={tenants.length === 0}
          >
            {showForm ? "Cancelar" : "Novo usuário"}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Novo usuário</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
              <Input
                label="Senha"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
              />
              <Select
                label="Papel"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <Select
                label="Tenant"
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                required
              >
                <option value="">Selecione o tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Criando…" : "Criar usuário"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : users.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-surface shadow-hair">
            <div className={`${COLS} border-b border-divider bg-bone-50 px-5 py-3`}>
              <Eyebrow>Usuário</Eyebrow>
              <Eyebrow>Papel</Eyebrow>
              <Eyebrow>Tenant</Eyebrow>
              <Eyebrow>Status</Eyebrow>
            </div>
            <div className="divide-y divide-divider">
              {users.map((u) => (
                <div key={u.id} className={`${COLS} px-5 py-4 transition-colors hover:bg-bone-50`}>
                  <div>
                    <div className="text-sm font-medium text-ink-900">{u.name}</div>
                    <div className="text-xs text-ink-500">{u.email}</div>
                  </div>
                  <span className="text-sm text-ink-600">{ROLE_LABELS[u.role] ?? u.role}</span>
                  <span className="text-sm text-ink-600">{u.tenant.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={u.active ? "green" : "neutral"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => toggleActive(u.id)}
                      className="text-xs font-medium text-green-700 hover:underline"
                    >
                      {u.active ? "Desativar" : "Ativar"}
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
