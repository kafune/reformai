'use client'

import { Button } from './Button'

interface LinkExpiredOverlayProps {
  /** Callback para gerar um novo link de acesso ao documento. */
  onGenerateNew?: () => void
  /** Callback para navegar de volta à listagem de documentos. */
  onGoBack?: () => void
  /** Indica que a geração do link está em andamento. */
  isLoading?: boolean
}

/**
 * Sobreposição exibida na área de visualização de documentos quando o link
 * expirou (signed URL > 1 hora). Substitui o conteúdo do preview.
 */
export function LinkExpiredOverlay({
  onGenerateNew,
  onGoBack,
  isLoading = false,
}: LinkExpiredOverlayProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bone-100">
      {/* Padrão de listras diagonais */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        preserveAspectRatio="none"
        viewBox="0 0 600 400"
      >
        <defs>
          <pattern
            id="diag-exp"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="14" stroke="var(--rai-ochre-600)" strokeWidth="3" />
          </pattern>
        </defs>
        <rect width="600" height="400" fill="url(#diag-exp)" />
      </svg>

      {/* Card central */}
      <div className="relative mx-4 w-full max-w-[400px] rounded-md bg-surface p-7 shadow-3">
        <h2 className="text-xl font-semibold tracking-snug text-ink-900">
          O link deste documento expirou.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Por segurança, links de documentos expiram após 1 hora. O arquivo continua
          armazenado com segurança — gere um novo link com um clique.
        </p>

        <div className="mt-6 flex gap-3">
          <Button
            variant="primary"
            icon="paperclip"
            onClick={onGenerateNew}
            disabled={isLoading}
          >
            {isLoading ? 'Gerando…' : 'Gerar novo link'}
          </Button>
          <Button variant="ghost" onClick={onGoBack}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  )
}
