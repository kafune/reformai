"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Logo, Select, Button } from "@/interfaces/components/ui"

interface Condominium {
  id: string
  name: string
  city: string
  state: string
}

export default function RegisterPickCondominiumPage() {
  const router = useRouter()
  const [condominiums, setCondominiums] = useState<Condominium[]>([])
  const [condominiumId, setCondominiumId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/v1/public/condominiums")
      .then((r) => r.json())
      .then((data) => setCondominiums(Array.isArray(data.condominiums) ? data.condominiums : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function onContinue(e: React.FormEvent) {
    e.preventDefault()
    if (!condominiumId) {
      setError("Selecione o condomínio.")
      return
    }
    router.push(`/register/${condominiumId}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-6 py-10">
      <div className="w-full max-w-[400px]">
        <Logo size={32} variant="lockup" />

        <div className="mt-8">
          <p className="font-mono text-xs uppercase tracking-caps text-green-700">Cadastro</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
            Crie sua conta de morador.
          </h1>
          <p className="mb-5 mt-1.5 text-base text-ink-500">
            Selecione seu condomínio para continuar. Dica: use o QR code de cadastro afixado no
            seu condomínio para ir direto ao formulário.
          </p>

          <form onSubmit={onContinue} className="flex flex-col gap-3">
            <Select
              label="Condomínio"
              value={condominiumId}
              onChange={(e) => {
                setCondominiumId(e.target.value)
                setError(null)
              }}
              required
              disabled={loading}
              data-testid="register-condominium"
            >
              <option value="">
                {loading ? "Carregando…" : "Selecione seu condomínio"}
              </option>
              {condominiums.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.city}/{c.state}
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
                className="w-full"
                data-testid="register-continue"
              >
                Continuar
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
