/**
 * Helpers de exibição da análise de IA dos documentos para o morador.
 *
 * Os dados vêm como o DocumentWorker os persiste:
 *  - extractedData    → Record<string, unknown> (campos extraídos pela IA)
 *  - inconsistencies  → { warnings: string[]; confidence: number }   (extração)
 *  - pendencies       → { items, inconsistencies, recommendation, reasoning, degraded? } (análise)
 *
 * Esta camada é puramente de apresentação: traduz os vereditos da IA para
 * linguagem amigável ao morador, sempre acompanhados do disclaimer assistivo.
 */

import type { DocumentItem } from "./DocumentList"

// ─── Shapes persistidos pelo DocumentWorker ──────────────────────────────────

export interface StoredExtraction {
  warnings?: string[]
  confidence?: number
}

export interface StoredAnalysisInconsistency {
  field?: string
  documentA?: string
  documentB?: string
  description?: string
  severity?: "low" | "medium" | "high"
}

export interface StoredAnalysis {
  items?: string[]
  inconsistencies?: StoredAnalysisInconsistency[]
  recommendation?:
    | "approve"
    | "approve_with_caveats"
    | "reject"
    | "request_corrections"
    | null
  reasoning?: string
  degraded?: boolean
}

// ─── Recomendação → metadados amigáveis ──────────────────────────────────────

export type Tone = "success" | "warning" | "error" | "info"

export interface RecommendationMeta {
  label: string
  tone: Tone
  icon: "check" | "alert" | "close" | "info"
}

export const RECOMMENDATION_META: Record<
  NonNullable<StoredAnalysis["recommendation"]>,
  RecommendationMeta
> = {
  approve: {
    label: "Documento coerente com o escopo",
    tone: "success",
    icon: "check",
  },
  approve_with_caveats: {
    label: "Aceito com ressalvas",
    tone: "warning",
    icon: "alert",
  },
  request_corrections: {
    label: "Faltam ajustes na documentação",
    tone: "warning",
    icon: "alert",
  },
  reject: {
    label: "Documento não aceito",
    tone: "error",
    icon: "close",
  },
}

// ─── Confiança ───────────────────────────────────────────────────────────────

export interface ConfidenceMeta {
  /** 0–100, já arredondado. */
  percent: number
  label: "Alta" | "Média" | "Baixa"
  tone: Tone
}

/** Converte a confiança 0–1 da extração em metadados de exibição. */
export function confidenceMeta(confidence: number | undefined): ConfidenceMeta | null {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) return null
  const percent = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  if (percent >= 80) return { percent, label: "Alta", tone: "success" }
  if (percent >= 50) return { percent, label: "Média", tone: "warning" }
  return { percent, label: "Baixa", tone: "info" }
}

// ─── Humanização de campos extraídos ─────────────────────────────────────────

/** Rótulos amigáveis para chaves comuns; fallback genérico cobre o resto. */
const FIELD_LABEL_OVERRIDES: Record<string, string> = {
  art_number: "Número da ART",
  artNumber: "Número da ART",
  rrt_number: "Número da RRT",
  professional_name: "Profissional responsável",
  professionalName: "Profissional responsável",
  crea: "Registro CREA/CAU",
  creaNumber: "Registro CREA/CAU",
  cau: "Registro CAU",
  responsible: "Responsável técnico",
  scope: "Escopo descrito",
  description: "Descrição",
  services: "Serviços",
  start_date: "Data de início",
  startDate: "Data de início",
  end_date: "Data de término",
  endDate: "Data de término",
  deadline: "Prazo",
  area: "Área",
  address: "Endereço",
  value: "Valor",
  cost: "Custo",
}

/** Converte camelCase / snake_case em "Título Legível". */
export function humanizeFieldKey(key: string): string {
  const override = FIELD_LABEL_OVERRIDES[key]
  if (override) return override
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
  if (!spaced) return key
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Formata o valor de um campo extraído para texto legível. */
export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  if (typeof value === "number") return String(value)
  if (typeof value === "string") return value.trim() || "—"
  if (Array.isArray(value)) {
    const parts = value.map((v) => formatFieldValue(v)).filter((s) => s !== "—")
    return parts.length ? parts.join(", ") : "—"
  }
  if (typeof value === "object") {
    try {
      const entries = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${humanizeFieldKey(k)}: ${formatFieldValue(v)}`)
        .filter((s) => !s.endsWith(": —"))
      return entries.length ? entries.join(" · ") : "—"
    } catch {
      return "—"
    }
  }
  return String(value)
}

export interface ExtractedField {
  key: string
  label: string
  value: string
}

/** Lista de campos extraídos, prontos para render, ignorando vazios. */
export function extractedFields(
  data: Record<string, unknown> | null | undefined,
): ExtractedField[] {
  if (!data || typeof data !== "object") return []
  return Object.entries(data)
    .map(([key, raw]) => ({
      key,
      label: humanizeFieldKey(key),
      value: formatFieldValue(raw),
    }))
    .filter((f) => f.value !== "—")
}

// ─── Agregado de análise por documento ───────────────────────────────────────

export interface DocumentAnalysisView {
  confidence: ConfidenceMeta | null
  recommendation: RecommendationMeta | null
  reasoning: string | null
  fields: ExtractedField[]
  warnings: string[]
  problems: string[]
  degraded: boolean
  /** Há qualquer conteúdo de análise para exibir? */
  hasContent: boolean
}

/** Reúne tudo que a IA produziu para um documento num único objeto de view. */
export function buildAnalysisView(doc: DocumentItem): DocumentAnalysisView {
  const extraction = (doc.inconsistencies ?? null) as StoredExtraction | null
  const analysis = (doc.pendencies ?? null) as StoredAnalysis | null

  const fields = extractedFields(doc.extractedData)
  const warnings = (extraction?.warnings ?? []).filter(Boolean)

  const problems: string[] = []
  if (analysis?.items) problems.push(...analysis.items.filter(Boolean))
  if (analysis?.inconsistencies) {
    for (const inc of analysis.inconsistencies) {
      if (inc?.description) problems.push(inc.description)
    }
  }

  const recommendation = analysis?.recommendation
    ? RECOMMENDATION_META[analysis.recommendation]
    : null

  const reasoning = analysis?.reasoning?.trim() || null
  const degraded = analysis?.degraded === true

  const hasContent =
    fields.length > 0 ||
    warnings.length > 0 ||
    problems.length > 0 ||
    recommendation !== null ||
    reasoning !== null

  return {
    confidence: confidenceMeta(extraction?.confidence),
    recommendation,
    reasoning,
    fields,
    warnings,
    problems,
    degraded,
    hasContent,
  }
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-green-700",
  warning: "text-ochre-700",
  error: "text-iron-700",
  info: "text-azulejo-700",
}

export const TONE_CHIP: Record<Tone, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-ochre-100 text-ochre-800",
  error: "bg-iron-100 text-iron-700",
  info: "bg-azulejo-100 text-azulejo-800",
}
