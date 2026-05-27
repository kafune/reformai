'use client'

import { useEffect, useState } from 'react'

import { Logo } from '@/interfaces/components/ui'

/**
 * Data/hora de término da manutenção.
 *
 * Configurável via variável de ambiente NEXT_PUBLIC_MAINTENANCE_END
 * (formato ISO 8601, ex.: "2026-06-01T03:00:00Z").
 * Se não definida, exibe o estado "voltando agora" imediatamente.
 */
function getMaintenanceEnd(): Date | null {
  const raw = process.env.NEXT_PUBLIC_MAINTENANCE_END
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

// ── Hook ──────────────────────────────────────────────────────

interface Countdown {
  d: number
  h: number
  m: number
  s: number
  done: boolean
}

function useCountdown(target: Date | null): Countdown {
  const [diff, setDiff] = useState<number>(() =>
    target ? Math.max(0, target.getTime() - Date.now()) : 0,
  )

  useEffect(() => {
    if (!target) return
    const id = setInterval(() => {
      setDiff(Math.max(0, target.getTime() - Date.now()))
    }, 1000)
    return () => clearInterval(id)
  }, [target])

  const total = Math.floor(diff / 1000)
  const done = total <= 0
  return {
    d: Math.floor(total / 86400),
    h: Math.floor(total / 3600) % 24,
    m: Math.floor(total / 60) % 60,
    s: total % 60,
    done,
  }
}

// ── Auto-reload quando a manutenção encerrar ──────────────────

function useAutoReload(done: boolean, delaySec = 30) {
  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => window.location.reload(), delaySec * 1000)
    return () => clearTimeout(id)
  }, [done, delaySec])
}

const pad = (n: number) => String(n).padStart(2, '0')

// ── Página ────────────────────────────────────────────────────

export default function ManutencaoPage() {
  const target = getMaintenanceEnd()
  const { d, h, m, s, done } = useCountdown(target)
  useAutoReload(done, 30)

  return (
    <div
      className="relative flex min-h-screen flex-col justify-between overflow-hidden px-10 py-16 md:px-20"
      style={{ background: 'var(--rai-ink-900)', color: 'var(--rai-bone-50)' }}
    >
      {/* Decoração de fundo */}
      <svg
        className="pointer-events-none absolute -right-28 -top-28 opacity-10"
        fill="none"
        height="700"
        viewBox="0 0 700 700"
        width="700"
      >
        <circle cx="350" cy="350" r="340" stroke="var(--rai-green-300)" strokeWidth="1" fill="none" />
        <circle cx="350" cy="350" r="240" stroke="var(--rai-green-300)" strokeWidth="1" fill="none" />
        <circle cx="350" cy="350" r="140" stroke="var(--rai-green-300)" strokeWidth="1" fill="none" />
        <path d="M70 350 Q350 70 630 350" stroke="var(--rai-ochre-400)" strokeWidth="1.5" fill="none" />
      </svg>

      {/* Cabeçalho */}
      <div className="relative flex items-start justify-between">
        <Logo
          size={32}
          variant="lockup"
          color="var(--rai-bone-50)"
          accent="var(--rai-green-300)"
        />
        <span
          className="rounded-xs px-3 py-1.5 font-mono text-xs uppercase tracking-caps"
          style={{
            background: done ? 'var(--rai-green-700)' : 'var(--rai-ochre-700)',
            color: 'var(--rai-bone-50)',
          }}
        >
          {done ? 'Encerrando manutenção' : 'Em manutenção'}
        </span>
      </div>

      {/* Conteúdo principal */}
      <div className="relative" style={{ maxWidth: 820 }}>
        <p
          className="font-mono text-xs uppercase tracking-caps"
          style={{ color: done ? 'var(--rai-green-300)' : 'var(--rai-ochre-300)' }}
        >
          {done ? 'Manutenção concluída' : 'Manutenção programada'}
        </p>

        <h1
          className="mb-4 mt-3 font-semibold tracking-tight"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            lineHeight: 1.05,
            color: 'var(--rai-bone-50)',
          }}
        >
          {done ? (
            <>
              Quase lá —<br />
              <span style={{ color: 'var(--rai-green-300)' }}>recarregando a plataforma.</span>
            </>
          ) : (
            <>
              Em obras —<br />
              <span style={{ color: 'var(--rai-green-300)' }}>voltamos em breve.</span>
            </>
          )}
        </h1>

        <p
          className="max-w-[620px] text-base leading-relaxed"
          style={{ color: 'var(--rai-ink-200)' }}
        >
          {done
            ? 'A janela de manutenção encerrou. Esta página será atualizada automaticamente em instantes.'
            : 'Estamos atualizando a plataforma para melhorar o desempenho e a segurança. Novos casos estão pausados durante esta janela. Casos em andamento não são afetados.'}
        </p>

        {/* Contagem regressiva — só exibe se ainda há tempo e temos um target */}
        {!done && target && (
          <div className="mt-10 flex items-end gap-5">
            {[
              { value: pad(d), label: 'dias' },
              { value: pad(h), label: 'horas' },
              { value: pad(m), label: 'min' },
              { value: pad(s), label: 'seg' },
            ].map(({ value, label }, i) => (
              <div key={label} className="flex items-end gap-5">
                <div className="text-center">
                  <p
                    className="font-mono font-medium leading-none tabular-nums"
                    style={{
                      fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                      color: 'var(--rai-bone-50)',
                      letterSpacing: '-0.04em',
                    }}
                  >
                    {value}
                  </p>
                  <p
                    className="mt-2 font-mono text-xs uppercase tracking-caps"
                    style={{ color: 'var(--rai-ink-400)' }}
                  >
                    {label}
                  </p>
                </div>
                {i < 3 && (
                  <p
                    className="pb-6 font-mono text-3xl leading-none"
                    style={{ color: 'var(--rai-ink-600)' }}
                  >
                    :
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sem data configurada: aviso de prazo desconhecido */}
        {!done && !target && (
          <p
            className="mt-6 font-mono text-sm"
            style={{ color: 'var(--rai-ink-400)' }}
          >
            Prazo estimado não disponível — acompanhe em status.reformai.app
          </p>
        )}
      </div>

      {/* Grade de status */}
      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            border: 'var(--rai-ochre-500)',
            labelColor: 'var(--rai-ochre-300)',
            label: 'Pausado',
            desc: 'Abertura de novos casos e análise de documentos.',
          },
          {
            border: 'var(--rai-green-500)',
            labelColor: 'var(--rai-green-300)',
            label: 'Disponível',
            desc: 'Vistorias de campo, upload de fotos e histórico de casos.',
          },
          {
            border: 'var(--rai-azulejo-500)',
            labelColor: 'var(--rai-azulejo-300)',
            label: 'Mais informações',
            desc: 'status.reformai.app',
            href: 'https://status.reformai.app',
          },
        ].map(({ border, labelColor, label, desc, href }) => (
          <div
            key={label}
            className="rounded-md p-4"
            style={{ background: 'rgba(245,240,228,.06)', borderLeft: `3px solid ${border}` }}
          >
            <p className="font-mono text-xs uppercase tracking-caps" style={{ color: labelColor }}>
              {label}
            </p>
            {href ? (
              <a
                href={href}
                rel="noopener noreferrer"
                target="_blank"
                className="mt-2 block text-sm leading-relaxed hover:underline"
                style={{ color: 'var(--rai-bone-50)' }}
              >
                {desc}
              </a>
            ) : (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--rai-bone-50)' }}>
                {desc}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
