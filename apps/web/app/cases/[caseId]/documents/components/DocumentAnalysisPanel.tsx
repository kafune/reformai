"use client"
import { useState } from "react"
import { Icon } from "@/interfaces/components/ui"
import type { DocumentItem } from "./DocumentList"
import {
  buildAnalysisView,
  TONE_CHIP,
  TONE_TEXT,
  type DocumentAnalysisView,
} from "./analysis-display"

/**
 * Painel "O que a IA leu neste documento" — exibido para todo documento
 * processado (inclusive VÁLIDO), tornando a análise da IA transparente ao
 * morador. Sempre acompanhado do disclaimer assistivo.
 */
export function DocumentAnalysisPanel({ doc }: { doc: DocumentItem }) {
  const view = buildAnalysisView(doc)
  const [showReasoning, setShowReasoning] = useState(false)

  if (view.degraded) {
    return (
      <div className="rounded-sm border border-bone-300 bg-bone-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <Icon name="clock" size={14} className="mt-0.5 shrink-0 text-ink-400" />
          <p className="text-xs leading-relaxed text-ink-500">
            A análise automática deste documento está temporariamente
            indisponível e será refeita. O arquivo foi recebido normalmente.
          </p>
        </div>
      </div>
    )
  }

  if (!view.hasContent) {
    return (
      <div className="rounded-sm border border-bone-300 bg-bone-50 px-4 py-3.5">
        <p className="text-xs text-ink-500">
          A IA ainda não extraiu dados estruturados deste documento.
        </p>
      </div>
    )
  }

  return (
    <div
      className="rounded-sm border border-bone-300 bg-bone-50 px-4 py-3.5"
      data-testid="document-analysis-panel"
    >
      {/* Cabeçalho com recomendação + confiança */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Icon name="sparkle" size={13} className="text-green-700" />
          <span className="text-xs font-semibold text-ink-700">
            O que a IA leu
          </span>
        </div>

        {view.recommendation && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              TONE_CHIP[view.recommendation.tone]
            }`}
          >
            <Icon name={view.recommendation.icon} size={11} />
            {view.recommendation.label}
          </span>
        )}

        {view.confidence && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              TONE_CHIP[view.confidence.tone]
            }`}
            title="Confiança da IA na leitura dos dados"
          >
            Confiança {view.confidence.label} · {view.confidence.percent}%
          </span>
        )}
      </div>

      {/* Campos extraídos */}
      {view.fields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {view.fields.map((f) => (
            <div key={f.key} className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-caps text-ink-400">
                {f.label}
              </dt>
              <dd className="truncate text-xs text-ink-800" title={f.value}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Avisos de extração */}
      {view.warnings.length > 0 && (
        <Section title="Observações da leitura" tone="info" items={view.warnings} />
      )}

      {/* Pendências / inconsistências da análise */}
      {view.problems.length > 0 && (
        <Section
          title="Pontos de atenção"
          tone="warning"
          items={view.problems}
        />
      )}

      {/* Raciocínio (colapsável) */}
      {view.reasoning && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            aria-expanded={showReasoning}
            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-medium text-green-700 hover:underline"
          >
            <Icon name={showReasoning ? "minus" : "plus"} size={11} />
            {showReasoning ? "Ocultar análise" : "Ver análise da IA"}
          </button>
          {showReasoning && (
            <p className="mt-1.5 rounded-sm bg-surface px-3 py-2 text-xs leading-relaxed text-ink-600">
              {view.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Disclaimer assistivo */}
      <div className="mt-3 flex items-start gap-1.5 border-t border-bone-300 pt-2.5">
        <Icon name="shield" size={12} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-[10px] leading-relaxed text-ink-400">
          Leitura assistiva por IA. A decisão final é do analista humano e pode
          divergir desta sugestão.
        </p>
      </div>
    </div>
  )
}

function Section({
  title,
  tone,
  items,
}: {
  title: string
  tone: "info" | "warning"
  items: string[]
}) {
  return (
    <div className="mt-3">
      <p className={`mb-1 text-[11px] font-semibold ${TONE_TEXT[tone]}`}>{title}</p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-ink-700">
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                tone === "warning" ? "bg-ochre-500" : "bg-azulejo-400"
              }`}
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export { buildAnalysisView }
export type { DocumentAnalysisView }
