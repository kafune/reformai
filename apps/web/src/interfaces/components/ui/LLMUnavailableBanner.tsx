'use client'

import { useState } from 'react'

import { Button } from './Button'
import { Icon } from './Icon'

interface LLMUnavailableBannerProps {
  /** Callback para tentar reconectar ao assistente. */
  onRetry?: () => void
  /** Callback para abrir o formulário manual em substituição ao chat. */
  onOpenForm?: () => void
  /** Segundos até a próxima tentativa automática (exibido como "Tentando em Xs"). */
  retryCountdown?: number
}

/**
 * Banner exibido no chat quando o assistente de IA está temporariamente fora do ar.
 * Oferece alternativa via formulário manual e botão de nova tentativa.
 */
export function LLMUnavailableBanner({
  onRetry,
  onOpenForm,
  retryCountdown,
}: LLMUnavailableBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="flex items-start gap-4 rounded-md border-l-[3px] border-ochre-500 bg-surface p-4 shadow-1">
      {/* Ícone */}
      <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-ochre-100 text-ochre-700">
        <Icon name="sparkle" size={16} />
      </div>

      {/* Texto */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">
          Assistente temporariamente indisponível.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          O assistente de IA está fora do ar neste momento. O restante da plataforma
          funciona normalmente. Você pode preencher o escopo pelo formulário — o
          resultado é equivalente para a classificação da reforma.
        </p>
        {retryCountdown != null && retryCountdown > 0 && (
          <p className="mt-1 font-mono text-xs text-ink-400">
            Tentando novamente em {retryCountdown}s
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <div className="flex gap-2">
          {onRetry && (
            <Button variant="primary" size="sm" icon="sparkle" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
          {onOpenForm && (
            <Button variant="secondary" size="sm" icon="list" onClick={onOpenForm}>
              Usar formulário
            </Button>
          )}
        </div>
        <button
          className="text-xs text-ink-400 transition-colors hover:text-ink-700"
          onClick={() => setDismissed(true)}
        >
          Recolher
        </button>
      </div>
    </div>
  )
}
