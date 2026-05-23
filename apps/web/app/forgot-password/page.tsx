"use client"
import { useState } from "react"
import Link from "next/link"
import { Logo, Button, Input } from "@/interfaces/components/ui"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch("/api/v1/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    } finally {
      // Mensagem idêntica exista ou não a conta — não vazamos enumeração.
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper px-6 py-10 sm:px-10">
      <Logo size={32} variant="lockup" />
      <div className="mx-auto flex w-full max-w-[360px] flex-1 flex-col justify-center">
        <p className="font-mono text-xs uppercase tracking-caps text-green-700">
          Recuperar acesso
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
          Esqueceu a senha?
        </h1>

        {sent ? (
          <div className="mt-4">
            <p className="rounded-sm bg-green-100 px-3 py-2 text-sm text-green-700">
              Se houver uma conta com esse e-mail, enviamos um link para redefinir
              a senha. Verifique sua caixa de entrada.
            </p>
            <p className="mt-5 text-sm text-ink-500">
              <Link href="/login" className="font-medium text-green-700 hover:underline">
                Voltar para o login
              </Link>
            </p>
          </div>
        ) : (
          <>
            <p className="mb-5 mt-1.5 text-base text-ink-500">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <Input
                label="E-mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon="user"
                required
                autoComplete="email"
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight="arrow"
                disabled={loading}
                className="mt-1 w-full"
              >
                {loading ? "Enviando…" : "Enviar link"}
              </Button>
            </form>
            <p className="mt-5 text-sm text-ink-500">
              <Link href="/login" className="font-medium text-green-700 hover:underline">
                Voltar para o login
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
