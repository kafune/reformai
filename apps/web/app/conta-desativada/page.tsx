'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

import { cn } from '@/shared/cn'
import { Badge, Button, Icon, Logo } from '@/interfaces/components/ui'

export default function ContaDesativadaPage() {
  const { data: session } = useSession()
  const user = session?.user
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((s) => s[0])
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <div className="flex min-h-screen bg-paper">
      {/* ── Conteúdo ── */}
      <div className="flex flex-1 flex-col px-10 py-12 md:px-14">
        <Logo size={28} variant="lockup" />

        <div className="mt-12 flex flex-1 flex-col justify-center md:mt-0" style={{ maxWidth: 480 }}>
          <h1
            className="text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl"
            style={{ lineHeight: 1.1 }}
          >
            Sua conta foi<br />desativada.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-ink-500">
            Você ainda pode visualizar seus casos e documentos anteriores, mas não
            pode criar novos casos, enviar documentos ou aceitar atribuições.
          </p>

          {/* Cartão do usuário */}
          {user && (
            <div className="mt-6 flex items-center gap-3 rounded-md border border-line bg-surface p-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-clay-100 font-semibold text-sm text-clay-600">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
                {user.email && (
                  <p className="truncate font-mono text-xs text-ink-500">{user.email}</p>
                )}
              </div>
              <Badge tone="clay" dot>
                Inativa
              </Badge>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/cases">
              <Button variant="ghost" size="lg" icon="list">
                Ver meus casos
              </Button>
            </Link>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              Sair da conta
            </Button>
          </div>

          <p className="mt-8 text-sm leading-relaxed text-ink-400">
            Para reativar seu acesso, entre em contato com o administrador ou envie um
            e-mail para{' '}
            <a
              href="mailto:suporte@kafune.xyz"
              className="text-ink-700 underline transition-colors hover:text-green-700"
            >
              suporte@kafune.xyz
            </a>
            .
          </p>
        </div>

        <p className="mt-10 font-mono text-xs text-ink-400">
          ReformAI · plataforma técnico-operacional
        </p>
      </div>

      {/* ── Painel de permissões ── */}
      <div
        className="hidden flex-col justify-between px-14 py-12 lg:flex"
        style={{ maxWidth: 480, flex: 1, background: 'var(--rai-green-900)' }}
      >
        <p
          className="font-mono text-xs uppercase tracking-caps"
          style={{ color: 'var(--rai-green-700)' }}
        >
          Permissões · estado atual
        </p>

        <div className="space-y-2">
          {[
            { label: 'Ver casos anteriores', ok: true, hint: 'somente leitura' },
            { label: 'Ver vistorias agendadas', ok: true, hint: 'somente leitura' },
            { label: 'Baixar relatórios', ok: true, hint: 'disponível' },
            { label: 'Criar novos casos', ok: false, hint: 'bloqueado' },
            { label: 'Enviar documentos', ok: false, hint: 'bloqueado' },
            { label: 'Agendar vistorias', ok: false, hint: 'bloqueado' },
          ].map(({ label, ok, hint }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-sm px-4 py-3"
              style={{ background: 'rgba(245,240,228,.06)' }}
            >
              <span
                className={cn(
                  'inline-flex size-4 shrink-0 items-center justify-center rounded-xs',
                  ok ? 'bg-green-500' : 'bg-iron-500',
                )}
              >
                <Icon name={ok ? 'check' : 'close'} size={10} className="text-white" />
              </span>
              <span className="flex-1 text-sm" style={{ color: 'var(--rai-bone-50)' }}>
                {label}
              </span>
              <span
                className="font-mono text-xs"
                style={{ color: ok ? 'var(--rai-green-300)' : 'var(--rai-iron-300)' }}
              >
                {hint}
              </span>
            </div>
          ))}
        </div>

        <p
          className="font-mono text-xs uppercase tracking-caps"
          style={{ color: 'var(--rai-green-800)' }}
        >
          Entre em contato para reativar
        </p>
      </div>
    </div>
  )
}
