import { Logo } from "@/interfaces/components/ui"

export const metadata = { title: "Offline — ReformAI" }

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper px-6 text-center">
      <Logo size={36} variant="lockup" />
      <h1 className="mt-2 text-xl font-semibold text-ink-900">Você está offline</h1>
      <p className="max-w-sm text-sm text-ink-500">
        Sem conexão no momento. As vistorias e fotos registradas em campo ficam salvas no
        dispositivo e são sincronizadas automaticamente quando a internet voltar.
      </p>
    </div>
  )
}
