"use client"
import { useEffect, useState } from "react"
import { Icon, Eyebrow, type IconName } from "@/interfaces/components/ui"

interface ReportRow {
  id: string
  type: string
  version: number
  generatedAt: string
}

const TYPE_META: Record<string, { label: string; icon: IconName }> = {
  ANALYSIS: { label: "Relatório de análise", icon: "search" },
  TECHNICAL_OPINION: { label: "Parecer técnico", icon: "doc" },
  COMMERCIAL_PROPOSAL: { label: "Proposta comercial", icon: "star" },
  SERVICE_ORDER: { label: "Ordem de serviço", icon: "list" },
  INSPECTION_SUMMARY: { label: "Resumo de vistoria", icon: "search" },
  RELEASE_OPINION: { label: "Parecer de liberação", icon: "shield" },
  MEMORIAL_DESCRITIVO: { label: "Memorial descritivo", icon: "doc" },
  CRONOGRAMA: { label: "Cronograma", icon: "clock" },
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "short" })
  } catch {
    return iso
  }
}

/**
 * Central de relatórios do caso — todos os documentos gerados pela plataforma
 * num só lugar, com download em PDF. Não aparece se não houver relatórios.
 */
export function ReportsSection({
  caseId,
  refreshKey,
}: {
  caseId: string
  refreshKey?: string
}) {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/v1/cases/${caseId}/reports`)
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((body) => {
        if (active) setReports(Array.isArray(body.reports) ? body.reports : [])
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [caseId, refreshKey])

  if (!loaded || reports.length === 0) return null

  return (
    <div className="rounded-md bg-surface p-5 shadow-hair" data-testid="reports-section">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-bone-200">
          <Icon name="layers" size={16} className="text-ink-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">Relatórios &amp; documentos</p>
          <Eyebrow>Gerados pela plataforma</Eyebrow>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-divider">
        {reports.map((r) => {
          const meta = TYPE_META[r.type] ?? { label: r.type, icon: "doc" as IconName }
          return (
            <li key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <Icon name={meta.icon} size={15} className="shrink-0 text-ink-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-ink-900">
                  {meta.label}
                  {r.version > 1 && (
                    <span className="ml-1 font-mono text-[10px] text-ink-400">v{r.version}</span>
                  )}
                </p>
                <p className="font-mono text-[10px] text-ink-400">{formatDate(r.generatedAt)}</p>
              </div>
              <a
                href={`/api/v1/cases/${caseId}/reports/${r.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-sm bg-bone-100 px-2.5 py-1 text-[11px] font-medium text-ink-700 transition-colors hover:bg-bone-200"
                title="Baixar PDF"
              >
                <Icon name="doc" size={11} />
                PDF
              </a>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex items-start gap-1.5 border-t border-divider pt-2.5">
        <Icon name="shield" size={12} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-[10px] leading-relaxed text-ink-400">
          Documentos gerados com apoio de IA. Não substituem a ART/RRT, emitida
          pelo profissional habilitado parceiro.
        </p>
      </div>
    </div>
  )
}
