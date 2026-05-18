"use client"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { TopBar, Button, Input, Select } from "@/interfaces/components/ui"
import { PartnerCard } from "./PartnerCard"
import { fromCsv, type Partner } from "./types"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  creaNumber: "",
  type: "ENGINEER",
  specialties: "",
  cities: "",
  states: "",
  basePrice: "",
  slaHours: "",
}

export default function PartnersPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isAdmin = ADMIN_ROLES.has(session?.user?.role ?? "")

  const [partners, setPartners] = useState<Partner[]>([])
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
    const res = await fetch("/api/v1/admin/partners")
    if (res.ok) setPartners((await res.json()).partners ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch("/api/v1/admin/partners", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        creaNumber: form.creaNumber,
        type: form.type,
        specialties: fromCsv(form.specialties),
        cities: fromCsv(form.cities),
        states: fromCsv(form.states),
        basePrice: Number(form.basePrice),
        slaHours: form.slaHours ? Number(form.slaHours) : undefined,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.message ?? data.error ?? "Erro ao criar parceiro.")
      return
    }
    const { partner } = await res.json()
    setPartners((prev) => [partner, ...prev])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  function handleUpdated(updated: Partner) {
    setPartners((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleDeleted(id: string) {
    setPartners((prev) => prev.filter((p) => p.id !== id))
  }

  if (status !== "authenticated" || !isAdmin) return null

  return (
    <>
      <TopBar
        title="Parceiros"
        subtitle={`${partners.length} parceiro(s) cadastrado(s)`}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            onClick={() => setShowForm((s) => !s)}
          >
            {showForm ? "Cancelar" : "Novo parceiro"}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8">
        {showForm && (
          <form onSubmit={create} className="mb-6 rounded-lg bg-surface p-5 shadow-hair">
            <h2 className="mb-1 text-sm font-semibold text-ink-900">Novo parceiro</h2>
            <p className="mb-4 text-xs text-ink-500">
              Cria uma conta de acesso (papel Parceiro) e o registro profissional.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
              <Input
                label="E-mail (login)"
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
            <div className="mt-4">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? "Criando…" : "Criar parceiro"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-ink-400">Carregando…</p>
        ) : partners.length === 0 ? (
          <div className="rounded-lg bg-surface p-12 text-center shadow-hair">
            <p className="text-sm font-medium text-ink-700">Nenhum parceiro cadastrado</p>
            <p className="mt-1 text-sm text-ink-400">
              Cadastre engenheiros e arquitetos para atribuí-los aos casos.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map((p) => (
              <PartnerCard
                key={p.id}
                partner={p}
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
