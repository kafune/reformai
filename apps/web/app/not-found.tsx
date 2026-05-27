import Link from 'next/link'

import { Button, Icon, Logo } from '@/interfaces/components/ui'
import { ClientBackButton } from '@/interfaces/components/ui/ClientBackButton'

export const metadata = { title: 'Página não encontrada — ReformAI' }

const SUGGESTIONS = [
  { icon: 'home' as const, label: 'Minhas reformas', href: '/cases' },
  { icon: 'doc' as const, label: 'Documentos', href: '/cases' },
  { icon: 'user' as const, label: 'Meu perfil', href: '/account' },
  { icon: 'info' as const, label: 'Central de ajuda', href: '/help' },
]

export default function NotFound() {
  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Conteúdo ── */}
      <div className="flex flex-1 flex-col px-10 py-12 md:px-14">
        <Logo size={28} variant="lockup" />

        <div className="mt-12 flex flex-1 flex-col justify-center md:mt-0" style={{ maxWidth: 480 }}>
          <h1 className="text-4xl font-semibold tracking-tight text-ink-900 md:text-5xl" style={{ lineHeight: 1.05 }}>
            Esta página<br />não existe.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500">
            O endereço que você acessou não foi encontrado ou foi movido.
            Verifique o link ou navegue para um dos pontos abaixo.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/">
              <Button variant="primary" size="lg" icon="home">
                Ir para o início
              </Button>
            </Link>
            <ClientBackButton variant="secondary" size="lg" icon="arrowL">
              Voltar
            </ClientBackButton>
          </div>

          <div className="mt-10 border-t border-divider pt-8">
            <p className="mb-3 font-mono text-xs uppercase tracking-caps text-ink-400">
              Talvez você queira
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTIONS.map(({ icon, label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 rounded-sm border border-line bg-surface p-3 text-ink-700 no-underline transition-colors hover:bg-bone-100"
                >
                  <Icon name={icon} size={14} className="shrink-0 text-green-600" />
                  <span className="flex-1 truncate text-sm font-medium">{label}</span>
                  <Icon name="arrow" size={13} className="shrink-0 text-ink-300" />
                </Link>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 font-mono text-xs text-ink-400">
          ReformAI · plataforma técnico-operacional
        </p>
      </div>

      {/* ── Visual ── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-1 lg:items-center lg:justify-center"
        style={{ maxWidth: 480, background: 'var(--rai-green-900)' }}
      >
        <svg
          className="absolute inset-0 h-full w-full"
          fill="none"
          preserveAspectRatio="none"
          viewBox="0 0 480 800"
        >
          <defs>
            <pattern id="g404" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0L0 0 0 40" stroke="#1F4A37" strokeWidth=".6" opacity=".5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g404)" />
          <line x1="0" y1="400" x2="480" y2="400" stroke="#2A6249" strokeWidth=".5" opacity=".4" />
          <line x1="240" y1="0" x2="240" y2="800" stroke="#2A6249" strokeWidth=".5" opacity=".4" />
        </svg>

        <p
          className="relative select-none font-mono font-medium leading-none tracking-tight"
          style={{ fontSize: 200, color: 'var(--rai-green-800)' }}
        >
          404
        </p>

        <p
          className="absolute bottom-10 right-10 text-right font-mono text-xs uppercase tracking-caps"
          style={{ color: 'var(--rai-green-700)' }}
        >
          Rota inexistente
        </p>
      </div>
    </div>
  )
}
