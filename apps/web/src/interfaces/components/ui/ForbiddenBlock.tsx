'use client'

import Link from 'next/link'

import { Button } from './Button'
import { Icon } from './Icon'

interface ForbiddenBlockProps {
  /** Nome da área/seção que o usuário tentou acessar. */
  section?: string
  /** Destino do botão "voltar". Padrão: '/'. */
  backHref?: string
}

/**
 * Bloco de acesso negado exibido dentro do AppShell (não substitui a página inteira).
 * Use quando o usuário não tem permissão para acessar uma rota específica.
 */
export function ForbiddenBlock({ section = 'esta área', backHref = '/' }: ForbiddenBlockProps) {
  return (
    <div className="mx-auto mt-12 flex max-w-xl flex-col items-start px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink-900">
        Você não tem acesso<br />a {section}.
      </h1>
      <p className="mt-3 text-base leading-relaxed text-ink-500">
        Seu perfil atual não tem permissão para acessar este recurso. Se você
        acredita que isso é um engano, entre em contato com o administrador da
        plataforma.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={backHref}>
          <Button variant="primary" icon="home">
            Ir para o início
          </Button>
        </Link>
        <a href="mailto:suporte@reformai.app">
          <Button variant="ghost" icon="send">
            Pedir acesso
          </Button>
        </a>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-md bg-bone-100 p-4 text-sm leading-relaxed text-ink-500">
        <Icon name="info" size={14} className="mt-0.5 shrink-0 text-ink-400" />
        <span>
          Esta tentativa de acesso foi registrada automaticamente para fins de segurança.
        </span>
      </div>
    </div>
  )
}
