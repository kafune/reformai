import { Icon, Logo } from '@/interfaces/components/ui'

export const metadata = { title: 'Sem conexão — ReformAI' }

// Dados de exemplo — em produção, lidos da fila de sync do service worker
const PENDING_ITEMS = [
  { label: 'Vistoria inicial · fotos', time: 'há 14 min', synced: true },
  { label: 'Nota técnica · prumada', time: 'há 8 min', synced: true },
  { label: 'Vistoria final · fotos', time: 'há 2 min', synced: false },
]

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-10 text-center">
      <Logo size={36} variant="lockup" />

      <div className="mt-10 max-w-sm">
        <span className="inline-flex items-center gap-1.5 rounded-xs bg-clay-100 px-2.5 py-1 font-mono text-xs uppercase tracking-caps text-clay-600">
          <Icon name="alert" size={12} />
          Sem conexão
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
          Continue sua vistoria.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Fotos e anotações ficam salvas no dispositivo e sincronizam automaticamente
          quando a internet voltar. Você não precisa fazer nada.
        </p>
      </div>

      {/* Fila de itens pendentes */}
      <div className="mt-8 w-full max-w-sm rounded-md border border-line bg-surface p-4">
        <div className="mb-3 flex justify-between">
          <span className="font-mono text-xs uppercase tracking-caps text-ink-400">
            Aguardando envio
          </span>
          <span className="font-mono text-xs text-ink-400">
            {PENDING_ITEMS.length} itens
          </span>
        </div>
        <div className="space-y-0">
          {PENDING_ITEMS.map(({ label, time, synced }, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 border-t border-divider py-2.5 first:border-0"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${synced ? 'bg-green-500' : 'bg-ochre-500'}`}
              />
              <span className="flex-1 text-sm text-ink-700">{label}</span>
              <span className="font-mono text-xs text-ink-400">{time}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 font-mono text-xs uppercase tracking-caps text-ink-400">
        Backup automático ativo
      </p>
    </div>
  )
}
