import Link from "next/link"
import { Button, Logo } from "@/interfaces/components/ui"

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="max-w-xl space-y-6 text-center">
        <div className="flex justify-center">
          <Logo size={44} variant="lockup" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
          Triagem técnica de reformas em condomínios
        </h1>
        <p className="text-base text-ink-500">
          Conduzida por IA, governada por regras determinísticas e auditável em
          cada decisão.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/login">
            <Button variant="primary" size="lg" iconRight="arrow">
              Entrar
            </Button>
          </Link>
          <Link href="/cases">
            <Button variant="secondary" size="lg">
              Meus casos
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
