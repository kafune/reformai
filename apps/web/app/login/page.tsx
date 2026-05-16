"use client"
import { signIn, getSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { Logo, Button, Input, Icon, Badge } from "@/interfaces/components/ui"

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
    if (res?.error) {
      setLoading(false)
      setError("Credenciais inválidas")
      return
    }

    // Role-based redirect
    const callbackUrl = params.get("callbackUrl")
    if (callbackUrl) {
      router.push(callbackUrl)
      return
    }

    const session = await getSession()
    const role = (session?.user as any)?.role as string | undefined
    if (role === "CONDOMINIUM") {
      router.push("/sindico/dashboard")
    } else if (role === "PARTNER") {
      router.push("/partner/dashboard")
    } else if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.push("/dashboard")
    } else {
      router.push("/cases")
    }
    setLoading(false)
  }

  return (
    <div
      className="rai h-screen overflow-hidden"
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
    >
      {/* Left — form */}
      <div className="flex flex-col overflow-y-auto bg-paper px-16 py-10">
        <Logo size={32} variant="lockup" />

        <div className="flex flex-1 flex-col justify-center" style={{ maxWidth: 360 }}>
          <p className="font-mono text-xs uppercase tracking-caps text-green-700">
            Entrar
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">
            Bem-vindo de volta.
          </h1>
          <p className="mb-5 mt-1.5 text-base text-ink-500">
            Sua reforma começa aqui. A IA conduz, mas você decide.
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
              data-testid="login-email"
            />
            <div className="relative">
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon="lock"
                required
                autoComplete="current-password"
                data-testid="login-password"
              />
              <a
                href="#"
                className="absolute right-0 top-0 text-xs text-green-700 hover:underline"
              >
                Esqueci a senha
              </a>
            </div>

            {error && (
              <p className="text-sm text-iron-600" data-testid="login-error">
                {error}
              </p>
            )}

            <div className="mt-1">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight="arrow"
                disabled={loading}
                className="w-full"
                data-testid="login-submit"
              >
                {loading ? "Entrando…" : "Entrar"}
              </Button>
            </div>

            {/* divider */}
            <div className="relative my-2 flex items-center gap-3">
              <div className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
                ou
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <Button variant="secondary" size="lg" className="w-full">
              Continuar com o condomínio
            </Button>
          </form>

          <div className="mt-6 border-t border-divider pt-4 text-xs leading-relaxed text-ink-500">
            Ao continuar, você concorda com os{" "}
            <a href="#" className="text-ink-700 underline">
              Termos
            </a>{" "}
            e o tratamento de dados conforme a{" "}
            <a href="#" className="text-ink-700 underline">
              LGPD
            </a>
            .{" "}
            <strong className="text-ink-700">
              A plataforma não emite ART/RRT.
            </strong>
          </div>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
          ReformAI · multi-tenant SaaS
        </div>
      </div>

      {/* Right — concreto verde */}
      <div
        className="relative flex flex-col justify-between overflow-hidden px-14 py-10"
        style={{ background: "var(--rai-green-900)", color: "var(--rai-bone-50)" }}
      >
        {/* decorative circles */}
        <svg
          style={{
            position: "absolute",
            right: -100,
            top: -80,
            opacity: 0.18,
            pointerEvents: "none",
          }}
          width={640}
          height={640}
          viewBox="0 0 640 640"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="320" cy="320" r="300" stroke="var(--rai-green-300)" strokeWidth="1" />
          <circle cx="320" cy="320" r="220" stroke="var(--rai-green-300)" strokeWidth="1" />
          <circle cx="320" cy="320" r="140" stroke="var(--rai-green-300)" strokeWidth="1" />
          <path
            d="M120 320 Q320 120 520 320 Q320 520 120 320"
            stroke="var(--rai-green-400)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>

        <div className="relative">
          <Badge tone="greenSolid">3 etapas · ~7 min</Badge>
        </div>

        <div className="relative">
          <h2
            className="text-3xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            Triagem técnica
            <br />
            <span style={{ color: "var(--rai-green-300)" }}>conduzida por IA.</span>
            <br />
            Liberação por regra.
          </h2>

          <div className="mt-6 grid gap-3" style={{ maxWidth: 420 }}>
            {[
              [
                "01",
                "Descreva sua obra no chat",
                "A IA classifica o escopo e calcula o risco.",
              ],
              [
                "02",
                "Envie os documentos pedidos",
                "Memorial, projeto, autorização. A IA valida.",
              ],
              [
                "03",
                "Receba a liberação",
                "Ou indicação de profissional para emitir a ART.",
              ],
            ].map(([n, t, d]) => (
              <div
                key={n}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  className="font-mono pt-0.5"
                  style={{
                    fontSize: 13,
                    color: "var(--rai-green-300)",
                    letterSpacing: ".05em",
                  }}
                >
                  {n}
                </div>
                <div>
                  <div
                    className="font-medium"
                    style={{ fontSize: 15, color: "var(--rai-bone-50)" }}
                  >
                    {t}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--rai-ink-200)",
                      marginTop: 2,
                      lineHeight: 1.5,
                    }}
                  >
                    {d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* disclaimer */}
        <div
          className="relative flex items-center gap-3.5 rounded-sm px-4 py-3.5"
          style={{
            background: "rgba(245,240,228,.06)",
            maxWidth: 460,
          }}
        >
          <span className="shrink-0 text-green-300">
            <Icon name="shield" size={18} />
          </span>
          <div
            style={{
              fontSize: 12,
              color: "var(--rai-ink-200)",
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: "var(--rai-bone-50)" }}>
              A plataforma não emite ART/RRT.
            </strong>
            <br />
            A emissão formal é do profissional habilitado parceiro. Cada
            decisão fica auditada.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-ink-500">Carregando…</div>}>
      <LoginForm />
    </Suspense>
  )
}
