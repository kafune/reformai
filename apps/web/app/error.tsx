'use client'

import { useEffect } from 'react'

import { cn } from '@/shared/cn'
import { reportClientError } from '@/shared/reportClientError'
import { Button, Icon, Logo } from '@/interfaces/components/ui'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Error Boundary]', error)
    reportClientError(error)
  }, [error])

  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Conteúdo ── */}
      <div className="flex flex-1 flex-col px-10 py-12 md:px-14">
        <Logo size={28} variant="lockup" />

        <div className="mt-12 flex flex-1 flex-col justify-center md:mt-0" style={{ maxWidth: 480 }}>
          <h1
            className="text-4xl font-semibold tracking-tight text-ink-900 md:text-5xl"
            style={{ lineHeight: 1.05 }}
          >
            Algo deu errado<br />do nosso lado.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-ink-500">
            Aconteceu um problema inesperado. Já registramos o ocorrido e estamos
            resolvendo. Seu progresso está salvo — nenhuma ação foi executada pela metade.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" size="lg" iconRight="arrow" onClick={reset}>
              Tentar novamente
            </Button>
            <Button
              variant="ghost"
              size="lg"
              icon="home"
              onClick={() => { window.location.href = '/' }}
            >
              Ir para o início
            </Button>
          </div>

          <p className="mt-10 text-sm leading-relaxed text-ink-400">
            Persistindo o problema, entre em contato:{' '}
            <a
              href="mailto:suporte@kafune.xyz"
              className="text-ink-700 underline transition-colors hover:text-green-700"
            >
              suporte@kafune.xyz
            </a>
          </p>
        </div>

        <p className="mt-10 font-mono text-xs text-ink-400">
          ReformAI · plataforma técnico-operacional
        </p>
      </div>

      {/* ── Painel de status ── */}
      <div
        className="hidden flex-col justify-between px-14 py-12 lg:flex"
        style={{ maxWidth: 480, flex: 1, background: 'var(--rai-ink-800)' }}
      >
        <p className="font-mono text-xs uppercase tracking-caps" style={{ color: 'var(--rai-ink-500)' }}>
          O que ficou intacto
        </p>

        <div>
          {[
            { label: 'Seus dados', status: 'Preservados', ok: true },
            { label: 'Formulários em aberto', status: 'Salvos', ok: true },
            { label: 'Sua sessão', status: 'Ativa', ok: true },
            { label: 'Este recurso', status: 'Com instabilidade', ok: false },
          ].map(({ label, status, ok }, i) => (
            <div
              key={label}
              className={cn(
                'flex items-center gap-3 py-4',
                i < 3 && 'border-b'
              )}
              style={{ borderColor: 'var(--rai-ink-700)' }}
            >
              <span
                className={cn('size-2 shrink-0 rounded-full', ok ? 'bg-green-500' : 'bg-iron-500')}
              />
              <span className="flex-1 text-sm" style={{ color: 'var(--rai-ink-300)' }}>
                {label}
              </span>
              <span
                className="font-mono text-xs"
                style={{ color: ok ? 'var(--rai-green-400)' : 'var(--rai-iron-300)' }}
              >
                {status}
              </span>
            </div>
          ))}
        </div>

        <div
          className="flex items-center gap-3 rounded-md p-4"
          style={{ background: 'rgba(245,240,228,.06)' }}
        >
          <Icon name="shield" size={16} className="shrink-0 text-green-400" />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--rai-ink-300)' }}>
            Nenhuma transição foi aplicada. Seu caso permanece no último estado válido.
          </p>
        </div>
      </div>
    </div>
  )
}
