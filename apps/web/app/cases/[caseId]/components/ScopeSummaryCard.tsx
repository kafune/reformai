"use client"
import { Icon, Eyebrow, Badge } from "@/interfaces/components/ui"

export interface ReformScopeView {
  services?: unknown
  areasAffected?: unknown
  affectsCommonAreas?: boolean
  estimatedArea?: number
  estimatedDurationDays?: number
  workforceType?: string
  affectsStructure?: boolean
  affectsExternalFacade?: boolean
  affectsNeighbors?: boolean
  urgency?: string
  description?: string
  notes?: string
}

const WORKFORCE_LABEL: Record<string, string> = {
  proprio: "Equipe própria",
  terceirizado: "Terceirizada",
  indefinido: "A definir",
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : []
}

/**
 * Resumo do escopo da reforma que o morador descreveu na triagem.
 * Estrutura `reformScope` (hoje invisível na UI). Não renderiza sem escopo.
 */
export function ScopeSummaryCard({ scope }: { scope: ReformScopeView | null | undefined }) {
  if (!scope) return null
  const services = asStringArray(scope.services)
  if (services.length === 0) return null

  const areas = asStringArray(scope.areasAffected)

  const impacts: string[] = []
  if (scope.affectsStructure) impacts.push("Estrutura")
  if (scope.affectsExternalFacade) impacts.push("Fachada externa")
  if (scope.affectsCommonAreas) impacts.push("Áreas comuns")
  if (scope.affectsNeighbors) impacts.push("Vizinhos")

  const workforce = scope.workforceType ? WORKFORCE_LABEL[scope.workforceType] : null
  const isUrgent = scope.urgency === "urgent"

  return (
    <div className="rounded-md bg-surface p-5 shadow-hair" data-testid="scope-summary-card">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-green-100">
          <Icon name="list" size={16} className="text-green-700" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">Escopo da reforma</p>
          <Eyebrow>O que você descreveu</Eyebrow>
        </div>
      </div>

      {/* Serviços */}
      <div className="flex flex-wrap gap-1.5">
        {services.map((s, i) => (
          <span
            key={i}
            className="rounded-full bg-bone-100 px-2.5 py-0.5 text-[11px] font-medium text-ink-700"
          >
            {s}
          </span>
        ))}
        {isUrgent && <Badge tone="ochre">Urgente</Badge>}
      </div>

      {/* Áreas afetadas */}
      {areas.length > 0 && (
        <div className="mt-3">
          <Eyebrow className="mb-1">Ambientes</Eyebrow>
          <p className="text-xs text-ink-700">{areas.join(", ")}</p>
        </div>
      )}

      {/* Dimensionamento */}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {typeof scope.estimatedArea === "number" && (
          <Field label="Área estimada" value={`${scope.estimatedArea} m²`} />
        )}
        {typeof scope.estimatedDurationDays === "number" && (
          <Field label="Duração estimada" value={`${scope.estimatedDurationDays} dias`} />
        )}
        {workforce && <Field label="Mão de obra" value={workforce} />}
      </dl>

      {/* Impactos */}
      {impacts.length > 0 && (
        <div className="mt-3">
          <Eyebrow className="mb-1.5">Impactos declarados</Eyebrow>
          <div className="flex flex-wrap gap-1.5">
            {impacts.map((imp, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-ochre-100 px-2 py-0.5 text-[11px] font-medium text-ochre-800"
              >
                <Icon name="alert" size={10} />
                {imp}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Descrição livre */}
      {(scope.description || scope.notes) && (
        <p className="mt-3 border-t border-divider pt-2.5 text-xs leading-relaxed text-ink-600">
          {scope.description || scope.notes}
        </p>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-caps text-ink-400">{label}</dt>
      <dd className="truncate text-xs text-ink-800" title={value}>{value}</dd>
    </div>
  )
}
