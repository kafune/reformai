import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined
}

export type TemplateId =
  | "relatorio-analise"
  | "memorial-descritivo"
  | "cronograma-basico"
  | "parecer-pendencias"
  | "proposta-comercial"
  | "ordem-servico"

const VALID_TEMPLATES: ReadonlySet<TemplateId> = new Set<TemplateId>([
  "relatorio-analise",
  "memorial-descritivo",
  "cronograma-basico",
  "parecer-pendencias",
  "proposta-comercial",
  "ordem-servico",
])

const MISSING_PLACEHOLDER = "[CAMPO NÃO PREENCHIDO]"

const DISCLAIMER =
  "\n\n---\n\n" +
  "*Este documento foi gerado com auxílio de inteligência artificial pela plataforma " +
  "ReformAI e tem caráter meramente informativo e auxiliar. Não substitui laudo técnico, " +
  "ART/RRT ou qualquer documento oficial emitido por profissional habilitado. A " +
  "responsabilidade técnica pela obra é exclusiva do profissional responsável devidamente " +
  "registrado no CREA/CAU.*\n"

const templatesDir = path.dirname(fileURLToPath(import.meta.url))
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
const cache = new Map<TemplateId, string>()

function loadTemplate(templateId: TemplateId): string {
  const cached = cache.get(templateId)
  if (cached !== undefined) return cached
  const filePath = path.join(templatesDir, `${templateId}.md`)
  const content = readFileSync(filePath, "utf8")
  cache.set(templateId, content)
  return content
}

function resolveValue(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return MISSING_PLACEHOLDER
  if (typeof value === "string" && value.trim() === "") return MISSING_PLACEHOLDER
  return String(value)
}

export function renderTemplate(
  templateId: TemplateId,
  variables: TemplateVariables,
): string {
  if (!VALID_TEMPLATES.has(templateId)) {
    throw new Error(`Template inválido: "${templateId}"`)
  }
  const raw = loadTemplate(templateId)
  const rendered = raw.replace(VARIABLE_PATTERN, (_, key: string) =>
    resolveValue(variables[key]),
  )
  return rendered.trimEnd() + DISCLAIMER
}
