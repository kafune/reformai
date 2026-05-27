'use client'

import { useState } from 'react'
import Link from 'next/link'

import { cn } from '@/shared/cn'
import {
  Badge,
  Button,
  ForbiddenBlock,
  Icon,
  LinkExpiredOverlay,
  LLMUnavailableBanner,
  SessionExpiredModal,
  TopBar,
  UploadErrorModal,
} from '@/interfaces/components/ui'
import type { UploadFile } from '@/interfaces/components/ui'

// ── Tipos ──────────────────────────────────────────────────────

type ModalKey = 'session' | 'upload' | 'link'
type InlineKey = 'forbidden' | 'llm'
type ActiveKey = ModalKey | InlineKey | null

// ── Dados das cards ────────────────────────────────────────────

interface PageCard {
  id: string
  tone: 'ink' | 'iron' | 'ochre' | 'clay' | 'green'
  label: string
  title: string
  desc: string
  href: string
  external?: boolean
}

const FULL_PAGE_CARDS: PageCard[] = [
  {
    id: '404',
    tone: 'ink',
    label: '404',
    title: 'Página não encontrada',
    desc: 'Rota inexistente ou movida. Exibe sugestões de navegação.',
    href: '/rota-que-nao-existe-preview-erro',
  },
  {
    id: '500',
    tone: 'iron',
    label: '500',
    title: 'Erro inesperado',
    desc: 'Erro de runtime capturado pelo error boundary. Botão "Tentar novamente".',
    href: '/error-preview/lancar-500',
  },
  {
    id: 'offline',
    tone: 'clay',
    label: 'Offline',
    title: 'Sem conexão',
    desc: 'Tela PWA quando não há internet. Mostra fila de itens pendentes.',
    href: '/offline',
  },
  {
    id: 'maint',
    tone: 'ochre',
    label: '503',
    title: 'Manutenção programada',
    desc: 'Fundo escuro com contagem regressiva e grade de serviços pausados.',
    href: '/manutencao',
  },
  {
    id: 'inactive',
    tone: 'clay',
    label: 'Conta',
    title: 'Conta desativada',
    desc: 'Permissões restritas com lista do que ainda é possível acessar.',
    href: '/conta-desativada',
  },
]

interface ComponentCard {
  id: ActiveKey
  tone: 'iron' | 'ochre' | 'ink' | 'green' | 'clay'
  label: string
  title: string
  desc: string
  kind: 'modal' | 'inline'
}

const COMPONENT_CARDS: ComponentCard[] = [
  {
    id: 'session',
    tone: 'ochre',
    label: 'Modal',
    title: 'Sessão expirada',
    desc: 'Sobrepõe a interface atual. Oferece re-autenticação sem perder contexto.',
    kind: 'modal',
  },
  {
    id: 'upload',
    tone: 'iron',
    label: 'Modal',
    title: 'Upload rejeitado',
    desc: 'Lista arquivos enviados e rejeitados com os motivos de forma simples.',
    kind: 'modal',
  },
  {
    id: 'link',
    tone: 'ochre',
    label: 'Overlay',
    title: 'Link de documento expirado',
    desc: 'Sobreposição no preview de PDF quando a URL assinada expirou.',
    kind: 'modal',
  },
  {
    id: 'forbidden',
    tone: 'iron',
    label: 'Inline',
    title: 'Acesso negado',
    desc: 'Bloco dentro do AppShell quando o perfil não tem acesso à rota.',
    kind: 'inline',
  },
  {
    id: 'llm',
    tone: 'ochre',
    label: 'Banner',
    title: 'Assistente indisponível',
    desc: 'Banner no topo do chat quando o assistente de IA está fora do ar.',
    kind: 'inline',
  },
]

// ── Mock de upload ─────────────────────────────────────────────

const MOCK_FILES: UploadFile[] = [
  { name: 'Memorial.pdf', size: '2.1 MB', status: 'ok' },
  { name: 'Projeto-cozinha.dwg', size: '34.2 MB', status: 'rejected', reason: 'Formato não suportado — envie como PDF' },
  { name: 'Vistoria-1.jpg', size: '0.8 MB', status: 'ok' },
  { name: 'Planta-baixa.pdf', size: '67.4 MB', status: 'rejected', reason: 'Arquivo maior que 50 MB — comprima ou divida' },
]

// ── Cores de tom ────────────────────────────────────────────────

const TONE_STRIP: Record<string, string> = {
  ink:   'bg-ink-800',
  iron:  'bg-iron-500',
  ochre: 'bg-ochre-500',
  clay:  'bg-clay-500',
  green: 'bg-green-700',
}

const TONE_BADGE: Record<string, string> = {
  ink:   'bg-ink-100 text-ink-700',
  iron:  'bg-iron-100 text-iron-700',
  ochre: 'bg-ochre-100 text-ochre-700',
  clay:  'bg-clay-100 text-clay-600',
  green: 'bg-green-100 text-green-800',
}

// ── Componente principal ────────────────────────────────────────

export default function ErrorPreviewPage() {
  const [active, setActive] = useState<ActiveKey>(null)

  const toggle = (key: ActiveKey) =>
    setActive((prev) => (prev === key ? null : key))
  const close = () => setActive(null)

  return (
    <>
      <TopBar
        title="Prévia de erros"
        subtitle="Página temporária · somente SUPER_ADMIN"
        actions={
          <Badge tone="ochre" dot>
            Rascunho — remover antes do deploy
          </Badge>
        }
      />

      <div className="overflow-auto p-8">
        {/* ── Aviso ── */}
        <div className="mb-10 flex items-start gap-3 rounded-md border border-ochre-400 bg-ochre-100 px-4 py-3 text-sm text-ochre-700">
          <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
          <span>
            Página temporária criada para homologação visual dos estados de erro.{' '}
            <strong>Remova esta rota antes de ir para produção.</strong>
          </span>
        </div>

        {/* ── Seção 1: Páginas completas ── */}
        <section className="mb-12">
          <h2 className="mb-1 text-xl font-semibold tracking-snug text-ink-900">
            Páginas completas
          </h2>
          <p className="mb-6 text-sm text-ink-500">
            Substituem a página inteira. Abrem em nova aba.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {FULL_PAGE_CARDS.map((card) => (
              <div
                key={card.id}
                className="flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-1"
              >
                <div className={cn('h-1.5', TONE_STRIP[card.tone])} />
                <div className="flex flex-1 flex-col p-5">
                  <span
                    className={cn(
                      'inline-block self-start rounded-xs px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-caps',
                      TONE_BADGE[card.tone],
                    )}
                  >
                    {card.label}
                  </span>
                  <h3 className="mt-2.5 text-sm font-semibold text-ink-900">{card.title}</h3>
                  <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-500">{card.desc}</p>
                  <Link
                    href={card.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4"
                  >
                    <Button variant="secondary" size="sm" iconRight="arrow" className="w-full justify-between">
                      Abrir
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Seção 2: Componentes ── */}
        <section className="mb-12">
          <h2 className="mb-1 text-xl font-semibold tracking-snug text-ink-900">
            Componentes in-app
          </h2>
          <p className="mb-6 text-sm text-ink-500">
            Aparecem dentro da interface — modais, overlays e banners.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {COMPONENT_CARDS.map((card) => {
              const isActive = active === card.id
              return (
                <div
                  key={card.id}
                  className={cn(
                    'flex flex-col overflow-hidden rounded-md border shadow-1 transition-colors',
                    isActive
                      ? 'border-green-400 bg-green-50'
                      : 'border-line bg-surface',
                  )}
                >
                  <div className={cn('h-1.5', isActive ? 'bg-green-500' : TONE_STRIP[card.tone])} />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-block rounded-xs px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-caps',
                          TONE_BADGE[card.tone],
                        )}
                      >
                        {card.label}
                      </span>
                      <span className="font-mono text-xs text-ink-400">
                        {card.kind}
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-sm font-semibold text-ink-900">{card.title}</h3>
                    <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-500">{card.desc}</p>
                    <Button
                      variant={isActive ? 'primary' : 'secondary'}
                      size="sm"
                      icon={isActive ? 'close' : 'eye'}
                      className="mt-4 w-full justify-center"
                      onClick={() => toggle(card.id)}
                    >
                      {isActive ? 'Fechar' : 'Mostrar'}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Prévia inline: ForbiddenBlock ── */}
        {active === 'forbidden' && (
          <section className="mb-8">
            <SectionHeader label="ForbiddenBlock" onClose={close} />
            <div className="rounded-md border border-line bg-surface">
              <ForbiddenBlock section="a Fila de Revisão" backHref="/dashboard" />
            </div>
          </section>
        )}

        {/* ── Prévia inline: LLMUnavailableBanner ── */}
        {active === 'llm' && (
          <section className="mb-8">
            <SectionHeader label="LLMUnavailableBanner" onClose={close} />
            <LLMUnavailableBanner
              onRetry={() => alert('→ onRetry()')}
              onOpenForm={() => alert('→ onOpenForm()')}
              retryCountdown={12}
            />
          </section>
        )}
      </div>

      {/* ── Modais ── */}

      {active === 'session' && (
        <SessionExpiredModal
          user={{ name: 'Maria Oliveira', email: 'maria.oliveira@demo.com' }}
        />
      )}

      {active === 'upload' && (
        <UploadErrorModal
          files={MOCK_FILES}
          onClose={close}
          onRetry={() => { alert('→ onRetry()'); close() }}
        />
      )}

      {active === 'link' && (
        <LinkPreviewWrapper onClose={close} />
      )}
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────

function SectionHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="font-mono text-xs uppercase tracking-caps text-ink-400">{label}</span>
      <button
        onClick={onClose}
        className="text-xs text-ink-400 transition-colors hover:text-ink-700"
      >
        Fechar prévia
      </button>
    </div>
  )
}

/** Wrapper que exibe o LinkExpiredOverlay numa janela simulada. */
function LinkPreviewWrapper({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-900/60" onClick={onClose} />

      {/* Janela simulada de viewer */}
      <div className="absolute inset-x-4 bottom-4 top-4 mx-auto max-w-4xl overflow-hidden rounded-md bg-surface shadow-4 md:inset-x-12">
        {/* Barra simulada do viewer */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-3">
          <span className="font-mono text-sm text-ink-700">Memorial.pdf · 4 páginas · 2.1 MB</span>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 transition-colors">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Área de preview com overlay */}
        <div className="relative" style={{ height: 'calc(100% - 49px)' }}>
          <LinkExpiredOverlay
            onGenerateNew={() => { alert('→ onGenerateNew()'); onClose() }}
            onGoBack={onClose}
          />
        </div>
      </div>
    </div>
  )
}
