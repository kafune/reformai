import Link from "next/link"

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-4xl font-semibold tracking-tight">ReformAI</h1>
        <p className="text-slate-600">
          Plataforma de triagem técnica para reformas em condomínios.
        </p>
        <div className="flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-brand-accent px-4 py-2 text-white text-sm font-medium"
          >
            Entrar
          </Link>
          <Link
            href="/cases"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Meus casos
          </Link>
        </div>
      </div>
    </main>
  )
}
