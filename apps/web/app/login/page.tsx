"use client"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState("morador@demo.com")
  const [password, setPassword] = useState("senha123")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)
    if (res?.error) {
      setError("Credenciais inválidas")
      return
    }
    router.push(params.get("callbackUrl") ?? "/cases")
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 bg-white p-8 rounded-lg border border-slate-200 shadow-sm"
    >
      <div>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="text-sm text-slate-500">ReformAI</p>
      </div>
      <label className="block">
        <span className="text-sm text-slate-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          required
          data-testid="login-email"
        />
      </label>
      <label className="block">
        <span className="text-sm text-slate-700">Senha</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
          required
          data-testid="login-password"
        />
      </label>
      {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-brand-accent text-white py-2 text-sm font-medium disabled:opacity-50"
        data-testid="login-submit"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        Use morador@demo.com / senha123 (após rodar seed)
      </p>
    </form>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <Suspense fallback={<div className="text-sm text-slate-500">Carregando…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
