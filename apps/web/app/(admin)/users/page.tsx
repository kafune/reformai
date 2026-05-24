"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"

const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/dashboard",
  ADMIN: "/dashboard",
  MANAGER: "/dashboard",
  CLIENT: "/cases",
  CONDOMINIUM: "/sindico/dashboard",
  PARTNER: "/partner/dashboard",
}
import { TopBar, Button, Input, Select, Badge, Eyebrow } from "@/interfaces/components/ui"

interface TenantRef {
  id: string
  name: string
  slug: string
}
interface CondominiumRef {
  id: string
  name: string
}
interface ManagedUser {
  id: string
  name: string
  email: string
  role: string
  active: boolean
  createdAt: string
  tenant: TenantRef
  condominium: CondominiumRef | null
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
// Parceiros são criados/geridos em /partners (cria User + Partner juntos).
const EDITABLE_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "CONDOMINIUM", "CLIENT"] as const

const COLS = "grid min-w-[820px] grid-cols-[1fr_120px_160px_220px] items-center gap-4"

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  role: "ADMIN",
  tenantId: "",
  condominiumId: "",
  invite: false,
}

interface EditState {
  name: string
  email: string
  role: string
  tenantId: string
  condominiumId: string
}

export default function UsersPage() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN"

  const [users, setUsers] = useState<ManagedUser[]>([])
  const [tenants, setTenants] = useState<TenantRef[]>([])
  const [condominiums, setCondominiums] = useState<CondominiumRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [flashError, setFlashError] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState>({ name: "", email: "", role: "", tenantId: "", condominiumId: "" })
  const [editCondos, setEditCondos] = useState<CondominiumRef[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [viewingAsId, setViewingAsId] = useState<string | null>(null)

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

  // Condomínios do formulário de criação (quando papel = síndico).
  useEffect(() => {
    if (form.role !== "CONDOMINIUM" || !form.tenantId) {
      setCondominiums([])
      return
    }
    let cancelled = false
    fetch(`/api/v1/superadmin/condominiums?tenantId=${encodeURIComponent(form.tenantId)}`)
      .then((res) => (res.ok ? res.json() : { condominiums: [] }))
      .then((data) => {
        if (!cancelled) setCondominiums(data.condominiums ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [form.role, form.tenantId])

  // Condomínios da edição inline (quando papel editado = síndico).
  useEffect(() => {
    if (!editingId || edit.role !== "CONDOMINIUM" || !edit.tenantId) {
      setEditCondos([])
      return
    }
    let cancelled = false
    fetch(`/api/v1/superadmin/condominiums?tenantId=${encodeURIComponent(edit.tenantId)}`)
      .then((res) => (res.ok ? res.json() : { condominiums: [] }))
      .then((data) => {
        if (!cancelled) setEditCondos(data.condominiums ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [editingId, edit.role, edit.tenantId])

  const availableRoles = form.invite ? EDITABLE_ROLES : ROLES

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.tenantId) {
      setError("Selecione o tenant.")
      return
    }
    if (form.role === "CONDOMINIUM" && !form.condominiumId) {
      setError("Selecione o condomínio do síndico.")
      return
    }
    setSaving(true)
    const { condominiumId, invite, password, ...rest } = form
    const base = condominiumId ? { ...rest, condominiumId } : rest
    const endpoint = invite ? "/api/v1/superadmin/users/invite" : "/api/v1/superadmin/users"
    const payload = invite ? base : { ...base, password }
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar usuário.")
      return
    }
    if (invite) {
      const data = await res.json().catch(() => ({}))
      setFlashError(false)
      setFlash(
        data.emailSent
          ? `Convite enviado para ${form.email}.`
          : `Usuário convidado, mas o e-mail não foi enviado (provedor não configurado).`,
      )
    }
    setForm(EMPTY_FORM)
    setShowForm(false)
    load()
  }

  async function toggleActive(id: string) {
    const res = await fetch(`/api/v1/superadmin/users/${id}`, { method: "PATCH" })
    if (res.ok) {
      const data = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: data.user.active } : u)))
    }
  }

  function openEdit(u: ManagedUser) {
    setEditingId(u.id)
    setEdit({ name: u.name, email: u.email, role: u.role, tenantId: u.tenant.id, condominiumId: u.condominium?.id ?? "" })
  }

  async function saveEdit(id: string) {
    setError(null)
    if (!edit.name.trim()) {
      setError("Nome é obrigatório.")
      return
    }
    if (!edit.email.trim()) {
      setError("E-mail é obrigatório.")
      return
    }
    if (edit.role === "CONDOMINIUM" && !edit.condominiumId) {
      setError("Selecione o condomínio do síndico.")
      return
    }
    setEditSaving(true)
    const res = await fetch(`/api/v1/superadmin/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: edit.name.trim(),
        email: edit.email.trim().toLowerCase(),
        role: edit.role,
        tenantId: edit.tenantId,
        condominiumId: edit.role === "CONDOMINIUM" ? edit.condominiumId : null,
      }),
    })
    setEditSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao salvar edição.")
      return
    }
    setEditingId(null)
    load()
  }

  async function deleteUser(id: string) {
    setDeletingId(id)
    setFlash(null)
    const res = await fetch(`/api/v1/superadmin/users/${id}`, { method: "DELETE" })
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id))
      setFlashError(false)
      setFlash("Usuário excluído com sucesso.")
    } else {
      const data = await res.json().catch(() => ({}))
      setFlashError(true)
      setFlash(data.message ?? data.error ?? "Não foi possível excluir o usuário.")
    }
  }

  async function viewAs(u: ManagedUser) {
    setViewingAsId(u.id)
    setFlash(null)
    const res = await fetch(`/api/v1/superadmin/users/${u.id}/impersonate`, { method: "POST" })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setViewingAsId(null)
      setFlashError(true)
      setFlash(data.message ?? data.error ?? "Não foi possível iniciar a visualização.")
      return
    }
    const { user: target } = await res.json()
    // Sobrescreve o JWT com os dados do usuário-alvo (segurança aplicada no callback jwt de auth.ts).
    await update({ startImpersonation: target })
    // Reload completo para garantir sessão e cache consistentes.
    window.location.href = ROLE_HOME[target.role] ?? "/dashboard"
  }

  async function resetPassword(u: ManagedUser) {
    setResettingId(u.id)
    setFlash(null)
    const res = await fetch(`/api/v1/superadmin/users/${u.id}/reset-password`, { method: "POST" })
    setResettingId(null)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setFlashError(false)
      setFlash(
        data.emailSent
          ? `E-mail de redefinição enviado para ${u.email}.`
          : `Não foi possível enviar o e-mail (provedor não configurado).`,
      )
    } else {
      setFlash("Falha ao solicitar redefinição de senha.")
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
        {flash && (
          <div
            className={`mb-4 flex items-center justify-between rounded-md px-4 py-2.5 text-sm ${
              flashError
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            <span>{flash}</span>
            <button
              type="button"
              onClick={() => { setFlash(null); setFlashError(false) }}
              className="text-xs underline"
            >
              ok
            </button>
          </div>
        )}

        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">
              {form.invite ? "Convidar usuário" : "Novo usuário"}
            </h2>
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
              {!form.invite && (
                <Input
                  label="Senha"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                />
              )}
              <Select
                label="Papel"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, condominiumId: "" }))}
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
              <Select
                label="Tenant"
                value={form.tenantId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tenantId: e.target.value, condominiumId: "" }))
                }
                required
              >
                <option value="">Selecione o tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              {form.role === "CONDOMINIUM" && (
                <Select
                  label="Condomínio"
                  value={form.condominiumId}
                  onChange={(e) => setForm((f) => ({ ...f, condominiumId: e.target.value }))}
                  required
                  disabled={!form.tenantId}
                >
                  <option value="">
                    {!form.tenantId
                      ? "Selecione o tenant primeiro"
                      : condominiums.length === 0
                        ? "Nenhum condomínio neste tenant"
                        : "Selecione o condomínio"}
                  </option>
                  {condominiums.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={form.invite}
                onChange={(e) =>
                  setForm((f) => {
                    const invite = e.target.checked
                    // Convite não cria parceiro; troca papel se estava em PARTNER.
                    const role = invite && f.role === "PARTNER" ? "ADMIN" : f.role
                    return { ...f, invite, role, password: "" }
                  })
                }
              />
              Convidar por e-mail (o usuário define a própria senha)
            </label>

            {error && <p className="mt-3 text-sm text-iron-600">{error}</p>}
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Salvando…" : form.invite ? "Enviar convite" : "Criar usuário"}
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
              <Eyebrow>Status / Ações</Eyebrow>
            </div>
            <div className="divide-y divide-divider">
              {users.map((u) => {
                const editing = editingId === u.id
                return (
                  <div key={u.id} className={`${COLS} px-5 py-4 transition-colors hover:bg-bone-50`}>
                    <div>
                      <div className="text-sm font-medium text-ink-900">{u.name}</div>
                      <div className="text-xs text-ink-500">{u.email}</div>
                      {editing && (
                        <div className="mt-2 grid gap-2">
                          {/* Nome e e-mail — editáveis para todos os papéis */}
                          <Input
                            label="Nome"
                            value={edit.name}
                            onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))}
                            className="min-w-[180px]"
                          />
                          <Input
                            label="E-mail"
                            type="email"
                            value={edit.email}
                            onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
                            className="min-w-[180px]"
                          />
                          {u.role === "PARTNER" ? (
                            <p className="text-xs text-iron-600">
                              Papel de parceiro é gerido em Parceiros.
                            </p>
                          ) : (
                            <Select
                              value={edit.role}
                              onChange={(e) =>
                                setEdit((s) => ({ ...s, role: e.target.value, condominiumId: "" }))
                              }
                              className="min-w-[180px]"
                            >
                              {EDITABLE_ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </option>
                              ))}
                            </Select>
                          )}
                          <Select
                            value={edit.tenantId}
                            onChange={(e) =>
                              setEdit((s) => ({ ...s, tenantId: e.target.value, condominiumId: "" }))
                            }
                            className="min-w-[180px]"
                          >
                            {tenants.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                          {edit.role === "CONDOMINIUM" && (
                            <Select
                              value={edit.condominiumId}
                              onChange={(e) =>
                                setEdit((s) => ({ ...s, condominiumId: e.target.value }))
                              }
                              className="min-w-[180px]"
                            >
                              <option value="">
                                {editCondos.length === 0
                                  ? "Nenhum condomínio neste tenant"
                                  : "Selecione o condomínio"}
                              </option>
                              {editCondos.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </Select>
                          )}
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={editSaving}
                              onClick={() => saveEdit(u.id)}
                            >
                              {editSaving ? "Salvando…" : "Salvar"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      )}
                      {!editing && u.role === "CONDOMINIUM" && (
                        <div className="mt-1 text-xs text-ink-500">
                          {u.condominium ? u.condominium.name : "Sem condomínio"}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-ink-600">{ROLE_LABELS[u.role] ?? u.role}</span>
                    <span className="text-sm text-ink-600">{u.tenant.name}</span>
                    <div className="flex flex-col items-start gap-1.5">
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
                      {!editing && confirmDeleteId !== u.id && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="text-xs font-medium text-green-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => resetPassword(u)}
                            disabled={resettingId === u.id}
                            className="text-xs font-medium text-green-700 hover:underline disabled:opacity-60"
                          >
                            {resettingId === u.id ? "Enviando…" : "Resetar senha"}
                          </button>
                          <button
                            type="button"
                            onClick={() => viewAs(u)}
                            disabled={!u.active || viewingAsId === u.id}
                            title={!u.active ? "Usuário inativo" : "Ver plataforma como este usuário"}
                            className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-40"
                          >
                            {viewingAsId === u.id ? "Entrando…" : "Ver como"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(u.id)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      )}
                      {!editing && confirmDeleteId === u.id && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-ink-600">Confirmar exclusão?</span>
                          <button
                            type="button"
                            onClick={() => deleteUser(u.id)}
                            disabled={deletingId === u.id}
                            className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-60"
                          >
                            {deletingId === u.id ? "Excluindo…" : "Sim, excluir"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium text-ink-500 hover:underline"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
