import { Card, Eyebrow } from "@/interfaces/components/ui"

export interface AiInconsistency {
  field?: string
  documentA?: string
  documentB?: string
  description?: string
  severity?: string
}

/** Shape gravada pelo DocumentWorker em Document.pendencies (análise cruzada da IA). */
export interface AiDocumentAnalysis {
  items?: string[]
  inconsistencies?: AiInconsistency[]
  recommendation?: string
  reasoning?: string
}

const AI_RECOMMENDATION_LABELS: Record<string, { label: string; className: string }> = {
  approve: { label: "Aprovar", className: "text-green-800 bg-green-100" },
  approve_with_caveats: {
    label: "Aprovar com ressalvas",
    className: "text-ochre-700 bg-ochre-100",
  },
  reject: { label: "Rejeitar", className: "text-clay-700 bg-clay-100" },
  request_corrections: {
    label: "Solicitar correções",
    className: "text-clay-700 bg-clay-100",
  },
}

/**
 * Extrai a análise cruzada mais recente a partir dos documentos do caso
 * (espera a lista ordenada por uploadedAt desc).
 */
export function extractAiAnalysis(
  documents: Array<{ pendencies: unknown }>,
): AiDocumentAnalysis | null {
  const found = documents.find((d) => d.pendencies !== null && d.pendencies !== undefined)
  return (found?.pendencies as AiDocumentAnalysis | undefined) ?? null
}

export function AiAnalysisCard({ analysis }: { analysis: AiDocumentAnalysis }) {
  const recommendation = analysis.recommendation
    ? (AI_RECOMMENDATION_LABELS[analysis.recommendation] ?? {
        label: analysis.recommendation,
        className: "text-ink-500 bg-bone-200",
      })
    : null

  return (
    <Card padded>
      <div className="mb-4 flex items-start justify-between">
        <h2 className="text-sm font-semibold tracking-snug text-ink-900">
          Análise da IA — documentação
        </h2>
        <span className="font-mono text-xs text-ink-400">
          Sugestão assistiva · decisão é do revisor
        </span>
      </div>

      {recommendation && (
        <div className="mb-4">
          <Eyebrow className="mb-1.5">Recomendação</Eyebrow>
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${recommendation.className}`}
          >
            {recommendation.label}
          </span>
        </div>
      )}

      {analysis.reasoning && (
        <div className="mb-4">
          <Eyebrow className="mb-1.5">Justificativa</Eyebrow>
          <p className="text-sm leading-relaxed text-ink-700">{analysis.reasoning}</p>
        </div>
      )}

      {analysis.items && analysis.items.length > 0 && (
        <div className="mb-4">
          <Eyebrow className="mb-2">Pendências apontadas</Eyebrow>
          <ul className="flex flex-col gap-2">
            {analysis.items.map((item) => (
              <li key={item} className="rounded-sm bg-bone-50 px-3 py-2.5 text-sm text-ink-700">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.inconsistencies && analysis.inconsistencies.length > 0 && (
        <div className="mb-1">
          <Eyebrow className="mb-2">Inconsistências entre documentos</Eyebrow>
          <ul className="flex flex-col gap-2">
            {analysis.inconsistencies.map((inc, idx) => (
              <li
                key={`${inc.field ?? "inc"}-${idx}`}
                className="rounded-sm bg-clay-100 px-3 py-2.5 text-sm"
              >
                <span className="font-medium text-clay-700">
                  {inc.documentA && inc.documentB
                    ? `${inc.documentA} × ${inc.documentB}`
                    : (inc.field ?? "Inconsistência")}
                </span>
                {inc.description && <span className="text-ink-700"> — {inc.description}</span>}
                {inc.severity && (
                  <span className="ml-2 font-mono text-xs uppercase text-ink-400">
                    {inc.severity}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-400">
        Parecer gerado por IA com caráter assistivo. Não substitui a análise do responsável
        técnico habilitado nem emite ART/RRT.
      </p>
    </Card>
  )
}
