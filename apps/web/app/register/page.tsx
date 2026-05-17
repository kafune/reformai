"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Logo, Input, Select, Button } from "@/interfaces/components/ui"

interface Condominium {
  id: string
  name: string
  city: string
  state: string
}
interface Unit {
  id: string
  identifier: string
  floor: string | null
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    condominiumId: "",
    unitId: "",
  })
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loadingCondos, setLoadingCondos] = useState(true)
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/v1/public/condominiums")
      .then((r) => r.json())
      .then((data) => setCondominiums(Array.isArray(data.condominiums) ? data.condominiums : []))
      .catch(() => {})
      .finally(() => setLoadingCondos(false))
  }, [])

  useEffect(() => {
    if (!form.condominiumId) {
      setUnits([])
      return
    }
    setLoadingUnits(true)
    fetch(`/api/v1/public/condominiums/${form.condominiumId}/units`)
      .then((r) => r.json())
      .then((data) => setUnits(Array.isArray(data.units) ? data.units : []))
      .catch(() => {})
      .finally(() => setLoadingUnits(false))
  }, [form.condominiumId])

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({
      ...f,
      [field]: value,
      ...(field === "condominiumId" ? { unitId: "" } : {}),
    }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.condominiumId) {
      setError("Selecione o condomínio.")
      return
    }
    if (!form.unitId) {
      setError("Selecione a unidade.")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setSubmitting(false)
      setError(data.message ?? data.error ?? "Erro ao criar conta. Tente novamente.")
      return
    }
    router.push("/login?registered=1")
  }

  return (
    <div className="rai flex min-h-screen flex-col items-center bg-paper px-6 py-10">
      <div className="w-full" style={{ maxWidth: 400 }}>
        <Logo size={32} variant="lockup" />

        <div className="mt-8">
          <p className="font-mono text-xs uppercase tracking-caps text-green-700">Cadastro</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
            Crie sua conta de morador.
          </h1>
          <p className="mb-5 mt-1.5 text-base text-ink-500">
            Vincule-se ao seu condomínio e à sua unidade para iniciar uma reforma.
          </p>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              label="Nome completo"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              icon="user"
              required
              minLength={3}
              placeholder="João da Silva"
              data-testid="register-name"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              icon="user"
              required
              autoComplete="email"
              placeholder="seu@email.com"
              data-testid="register-email"
            />
            <Input
              label="Senha"
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              icon="lock"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              data-testid="register-password"
            />

            <Select
              label="Condomínio"
              value={form.condominiumId}
              onChange={(e) => update("condominiumId", e.target.value)}
              required
              disabled={loadingCondos}
              data-testid="register-condominium"
            >
              <option value="">
                {loadingCondos ? "Carregando…" : "Selecione seu condomínio"}
              </option>
              {condominiums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}/{c.state}
                </option>
              ))}
            </Select>

            <Select
              label="Unidade"
              value={form.unitId}
              onChange={(e) => update("unitId", e.target.value)}
              required
              disabled={!form.condominiumId || loadingUnits}
              data-testid="register-unit"
            >
              <option value="">
                {!form.condominiumId
                  ? "Selecione o condomínio primeiro"
                  : loadingUnits
                    ? "Carregando…"
                    : units.length === 0
                      ? "Nenhuma unidade disponível"
                      : "Selecione sua unidade"}
              </option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.floor ? `Andar ${u.floor} — ` : ""}Unidade {u.identifier}
                </option>
              ))}
            </Select>

            {error && (
              <p className="text-sm text-iron-600" data-testid="register-error">
                {error}
              </p>
            )}

            <div className="mt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight="arrow"
                disabled={submitting}
                className="w-full"
                data-testid="register-submit"
              >
                {submitting ? "Criando conta…" : "Criar conta"}
              </Button>
            </div>
          </form>

          <p className="mt-6 text-sm text-ink-500">
            Já tem conta?{" "}
            <Link href="/login" className="font-medium text-green-700 hover:underline">
              Entrar
            </Link>
          </p>

          <div className="mt-6 border-t border-divider pt-4 text-xs leading-relaxed text-ink-500">
            Ao criar a conta você concorda com o tratamento de dados conforme a LGPD.{" "}
            <strong className="text-ink-700">A plataforma não emite ART/RRT.</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
