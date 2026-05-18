"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select } from "@/interfaces/components/ui"
import { CondominiumCard } from "./CondominiumCard"
import { UFS, type Condominium, type PartnerOption } from "./constants"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const EMPTY_FORM = { name: "", cnpj: "", address: "", city: "", state: "SP" }

export default function CondominiumsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = ADMIN_ROLES.has(session?.user?.role ?? "")

  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [partners, setPartners] = useState<PartnerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "authenticated" && !isAdmin) router.replace("/dashboard")
  }, [status, isAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    const [condRes, partRes] = await Promise.all([
      fetch("/api/v1/admin/condominiums"),
      fetch("/api/v1/admin/partners"),
    ])
    if (condRes.ok) setCondominiums((await condRes.json()).condominiums ?? [])
    if (partRes.ok) {
      const data = await partRes.json()
      setPartners(
        (data.partners ?? []).map((p: { id: string; name: string }) => ({
          id: p.id,
          name: p.name,
        })),
      )
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
    const res = await fetch("/api/v1/admin/condominiums", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
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
        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-4 text-sm font-semibold text-ink-900">Novo condomínio</h2>
            <div className="grid gap-3 md:grid-cols-2">
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
                partners={partners}
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
