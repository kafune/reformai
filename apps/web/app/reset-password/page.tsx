"use client"
import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Logo, Button, Input } from "@/interfaces/components/ui"

function ResetForm() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get("token") ?? ""

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.")
      return
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/v1/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        setError("Link inválido ou expirado. Solicite um novo.")
        setLoading(false)
        return
      }
      router.push("/login?reset=1")
    } catch {
      setError("Não foi possível redefinir a senha. Tente novamente.")
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="mt-4">
        <p className="rounded-sm bg-iron-100 px-3 py-2 text-sm text-iron-600">
          Link inválido. Solicite uma nova redefinição de senha.
        </p>
        <p className="mt-5 text-sm text-ink-500">
          <Link href="/forgot-password" className="font-medium text-green-700 hover:underline">
            Solicitar novo link
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="mb-5 mt-1.5 text-base text-ink-500">
        Crie uma nova senha para sua conta.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon="lock"
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirmar senha"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          icon="lock"
          required
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-iron-600">{error}</p>}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          iconRight="arrow"
          disabled={loading}
          className="mt-1 w-full"
        >
          {loading ? "Salvando…" : "Redefinir senha"}
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 py-10 sm:px-10">
      <Logo size={32} variant="lockup" />
      <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center">
        <p className="font-mono text-xs uppercase tracking-caps text-green-700">
          Recuperar acesso
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
          Nova senha
        </h1>
        <Suspense fallback={<p className="mt-4 text-sm text-ink-500">Carregando…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
