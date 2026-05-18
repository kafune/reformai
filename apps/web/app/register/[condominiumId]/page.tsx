"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Logo, Input, Button } from "@/interfaces/components/ui"

interface Condominium {
  id: string
  name: string
  city: string
  state: string
}

export default function RegisterByCondominiumPage({
  params,
}: {
  params: { condominiumId: string }
}) {
  const router = useRouter()
  const [condominium, setCondominium] = useState<Condominium | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "ready" | "notfound">("loading")
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    block: "",
    unitIdentifier: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/public/condominiums/${params.condominiumId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setCondominium(data.condominium)
        setLoadState("ready")
      })
      .catch(() => setLoadState("notfound"))
  }, [params.condominiumId])

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.unitIdentifier.trim()) {
      setError("Informe o número do seu apartamento/unidade.")
      return
    }
    setSubmitting(true)
    const res = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, condominiumId: params.condominiumId }),
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
    <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-10">
      <div className="w-full max-w-[400px]">
        <Logo size={32} variant="lockup" />

        <div className="mt-8">
          {loadState === "loading" && (
            <p className="text-base text-ink-500">Carregando condomínio…</p>
          )}

          {loadState === "notfound" && (
            <>
              <p className="font-mono text-xs uppercase tracking-caps text-iron-600">Cadastro</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                Condomínio não encontrado.
              </h1>
              <p className="mb-5 mt-1.5 text-base text-ink-500">
                Este link de cadastro é inválido ou o condomínio está inativo. Confira o QR code
                com a administração do condomínio.
              </p>
              <Link href="/register" className="font-medium text-green-700 hover:underline">
                Escolher o condomínio manualmente
              </Link>
            </>
          )}

          {loadState === "ready" && condominium && (
            <>
              <p className="font-mono text-xs uppercase tracking-caps text-green-700">
                Cadastro de morador
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
                {condominium.name}
              </h1>
              <p className="mb-5 mt-1.5 text-base text-ink-500">
                {condominium.city}/{condominium.state} — crie sua conta para iniciar uma reforma
                na sua unidade.
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

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Torre / Bloco"
                    hint="Opcional"
                    value={form.block}
                    onChange={(e) => update("block", e.target.value)}
                    icon="layers"
                    maxLength={60}
                    placeholder="Torre A"
                    data-testid="register-block"
                  />
                  <Input
                    label="Apartamento"
                    value={form.unitIdentifier}
                    onChange={(e) => update("unitIdentifier", e.target.value)}
                    icon="home"
                    required
                    maxLength={60}
                    placeholder="101"
                    data-testid="register-unit"
                  />
                </div>

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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
