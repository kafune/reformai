"use client"
import Link from "next/link"
import { Icon, type IconName } from "@/interfaces/components/ui"

type Tone = "info" | "warning" | "ochre" | "success"

interface StepConfig {
  title: string
  description: string
  icon: IconName
  tone: Tone
  cta?: string
  /** Link de navegação. */
  href?: (caseId: string) => string
  /** Âncora na própria página para rolar até (ex.: card de proposta). */
  scrollTo?: string
}

// Apenas status que exigem uma AÇÃO do morador entram aqui — estados de espera
// já são cobertos pelo banner contextual de status.
const NEXT_STEP: Partial<Record<string, StepConfig>> = {
  AWAITING_SCOPE_DETAILS: {
    title: "Continue a triagem",
    description: "Descreva sua reforma no chat para a IA classificar o escopo.",
    icon: "chat",
    tone: "info",
  },
  AWAITING_DOCUMENTS: {
    title: "Envie os documentos",
    description: "Anexe os documentos necessários para liberar sua reforma.",
    icon: "upload",
    tone: "info",
    cta: "Enviar documentos",
    href: (id) => `/cases/${id}/documents`,
  },
  PENDING_CORRECTIONS: {
    title: "Corrija os documentos",
    description: "Alguns documentos precisam de ajustes. Revise e reenvie.",
    icon: "alert",
    tone: "warning",
    cta: "Revisar documentos",
    href: (id) => `/cases/${id}/documents`,
  },
  COMMERCIAL_OFFER_SENT: {
    title: "Você tem uma proposta",
    description: "Revise a proposta comercial e aceite para prosseguir.",
    icon: "star",
    tone: "ochre",
    cta: "Ver proposta",
    scrollTo: "proposta-comercial",
  },
  AWAITING_PAYMENT: {
    title: "Confirme o pagamento",
    description: "Proposta aceita. O pagamento libera a atribuição do parceiro.",
    icon: "clock",
    tone: "warning",
  },
}

const TONE_STYLES: Record<Tone, { wrap: string; icon: string; iconBg: string }> = {
  info: { wrap: "border-azulejo-200 bg-azulejo-50", icon: "text-azulejo-700", iconBg: "bg-azulejo-100" },
  warning: { wrap: "border-ochre-200 bg-ochre-50", icon: "text-ochre-700", iconBg: "bg-ochre-100" },
  ochre: { wrap: "border-ochre-300 bg-ochre-50", icon: "text-ochre-700", iconBg: "bg-ochre-100" },
  success: { wrap: "border-green-200 bg-green-50", icon: "text-green-700", iconBg: "bg-green-100" },
}

/**
 * Card "Próximo passo" — CTA primário no topo do caso, derivado do status.
 * Renderiza apenas quando há uma ação clara para o morador.
 */
export function NextStepCard({ caseId, status }: { caseId: string; status: string }) {
  const step = NEXT_STEP[status]
  if (!step) return null

  const styles = TONE_STYLES[step.tone]

  function handleScroll() {
    if (!step?.scrollTo) return
    document.getElementById(step.scrollTo)?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div
      className={`rounded-md border p-4 ${styles.wrap}`}
      data-testid="next-step-card"
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${styles.iconBg}`}>
          <Icon name={step.icon} size={17} className={styles.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-caps text-ink-400">
            Próximo passo
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink-900">{step.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{step.description}</p>

          {step.cta && step.href && (
            <Link
              href={step.href(caseId)}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-ink-900 px-3 py-1.5 text-xs font-medium text-bone-50 transition-colors hover:bg-ink-700"
            >
              {step.cta}
              <Icon name="arrow" size={12} />
            </Link>
          )}

          {step.cta && step.scrollTo && (
            <button
              type="button"
              onClick={handleScroll}
              className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-ink-900 px-3 py-1.5 text-xs font-medium text-bone-50 transition-colors hover:bg-ink-700"
            >
              {step.cta}
              <Icon name="arrow" size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
