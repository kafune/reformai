import { z } from "zod"
import { renderTemplate, type TemplateId, type TemplateVariables } from "@reformai/templates"
import type { LLMMessage, LLMProvider } from "@/modules/document-intelligence/domain/LLMProvider"
import type { ReformCaseData, ReportAgent, ReportGenerationResult } from "../domain/ReportAgent"
import { logger } from "@/shared/logger"

// ─── Output validation ────────────────────────────────────────────────────────

const DISCLAIMER_MARKER = "caráter meramente informativo"

const ReportContentSchema = z
  .string()
  .min(1, "Conteúdo do relatório não pode ser vazio")
  .refine(
    (s) => s.includes(DISCLAIMER_MARKER),
    "O relatório deve conter o disclaimer obrigatório",
  )

// ─── AI enrichment types ──────────────────────────────────────────────────────

interface NarrativeFields {
  recomendacao?: string
  pendencias?: string
  instrucoes?: string
  descricao_obra?: string
}

const NarrativeSchema = z.object({
  recomendacao: z.string().optional(),
  pendencias: z.string().optional(),
  instrucoes: z.string().optional(),
  descricao_obra: z.string().optional(),
})

const NARRATIVE_OPEN_TAG = "<narrative>"
const NARRATIVE_CLOSE_TAG = "</narrative>"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJson(raw: string): string | null {
  const openIdx = raw.indexOf(NARRATIVE_OPEN_TAG)
  if (openIdx === -1) return null
  const start = openIdx + NARRATIVE_OPEN_TAG.length
  const closeIdx = raw.indexOf(NARRATIVE_CLOSE_TAG, start)
  if (closeIdx === -1) return null
  return raw.slice(start, closeIdx).trim()
}

function buildNarrativePrompt(templateId: TemplateId, caseData: ReformCaseData): string {
  const { reformCase } = caseData
  const scope = reformCase.reformScope
    ? JSON.stringify(reformCase.reformScope, null, 2)
    : "(não disponível)"
  const evaluation = reformCase.evaluationResult
    ? JSON.stringify(reformCase.evaluationResult, null, 2)
    : "(não disponível)"

  return [
    `Você é um analista técnico de reformas prediais. Gere texto em português para o relatório "${templateId}".`,
    "",
    "DADOS DO CASO:",
    `Protocolo: ${reformCase.protocol}`,
    `Nível de risco: ${reformCase.riskLevel ?? "não classificado"}`,
    `Requer ART/RRT: ${reformCase.requiresART ?? "não determinado"}`,
    `Score de triagem: ${reformCase.triageScore ?? "N/A"}`,
    "",
    "ESCOPO DA OBRA:",
    scope,
    "",
    "RESULTADO DA AVALIAÇÃO:",
    evaluation,
    "",
    "Responda APENAS com um objeto JSON entre as tags <narrative>...</narrative>.",
    "O JSON pode ter os campos: recomendacao, pendencias, instrucoes, descricao_obra",
    '(use apenas os campos relevantes para o template "' + templateId + '").',
    "Seja objetivo, técnico e em português formal.",
    "Não invente dados. Use apenas as informações fornecidas.",
    "Não inclua texto fora das tags <narrative>...</narrative>.",
  ].join("\n")
}

// ─── Template variable builders ───────────────────────────────────────────────

function buildBaseVariables(
  templateId: TemplateId,
  caseData: ReformCaseData,
  narrative: NarrativeFields,
): TemplateVariables {
  const { reformCase } = caseData
  const now = new Date().toLocaleDateString("pt-BR")

  const evaluation = reformCase.evaluationResult as Record<string, unknown> | null
  const scope = reformCase.reformScope as Record<string, unknown> | null

  // Extract triggered rules text
  const triggeredRules = evaluation?.triggeredRules as Array<{
    ruleName: string
    reason: string
  }> | null
  const regrasAtivadas =
    triggeredRules && triggeredRules.length > 0
      ? triggeredRules.map((r) => `- **${r.ruleName}**: ${r.reason}`).join("\n")
      : "(nenhuma regra acionada)"

  // Extract services from scope
  const services = scope?.services as string[] | null
  const servicosText =
    services && services.length > 0
      ? services.map((s) => `- ${s}`).join("\n")
      : scope?.description
        ? String(scope.description)
        : "(não especificado)"

  const base: TemplateVariables = {
    protocolo: reformCase.protocol,
    data: now,
    data_analise: now,
    condominio: reformCase.condominiumId,
    unidade: reformCase.unitId,
    proprietario: reformCase.clientId,
    risco: reformCase.riskLevel ?? undefined,
    score_triagem: reformCase.triageScore ?? undefined,
    requer_art: reformCase.requiresART != null ? (reformCase.requiresART ? "Sim" : "Não") : undefined,
    servicos: servicosText,
    regras_ativadas: regrasAtivadas,
    // narrative fields (AI-enriched or empty → engine substitutes placeholder)
    recomendacao: narrative.recomendacao,
    pendencias: narrative.pendencias,
    instrucoes: narrative.instrucoes,
    descricao_obra: narrative.descricao_obra,
  }

  // Template-specific fields
  if (templateId === "proposta-comercial") {
    Object.assign(base, {
      plano: undefined,
      valor_base: undefined,
      vistorias_inclusas: "3",
      valor_vistoria_extra: undefined,
      servicos_inclusos: servicosText,
      validade_proposta: "30 dias",
      forma_pagamento: undefined,
    })
  }

  if (templateId === "ordem-servico") {
    Object.assign(base, {
      parceiro: undefined,
      crea_parceiro: undefined,
      servicos_autorizados: servicosText,
      data_inicio: undefined,
      restricoes_horario: undefined,
      contato_sindico: undefined,
    })
  }

  if (templateId === "memorial-descritivo") {
    Object.assign(base, {
      responsavel_tecnico: undefined,
      materiais: undefined,
      area_afetada: undefined,
      prazo_execucao: undefined,
    })
  }

  if (templateId === "cronograma-basico") {
    Object.assign(base, {
      responsavel_execucao: undefined,
      data_inicio_prevista: undefined,
      duracao_dias: undefined,
      etapas: undefined,
    })
  }

  if (templateId === "parecer-pendencias") {
    Object.assign(base, {
      documentos_validos: undefined,
      documentos_pendentes: undefined,
      inconsistencias: undefined,
      prazo_correcao: "15 dias corridos",
      nome_responsavel: undefined,
    })
  }

  if (templateId === "relatorio-analise") {
    Object.assign(base, {
      nome_responsavel: undefined,
    })
  }

  return base
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class ClaudeReportAgent implements ReportAgent {
  constructor(private readonly llm: LLMProvider) {}

  async generateReport(
    templateId: TemplateId,
    caseData: ReformCaseData,
    options?: { enrichWithAI?: boolean },
  ): Promise<ReportGenerationResult> {
    let narrative: NarrativeFields = {}

    if (options?.enrichWithAI) {
      narrative = await this.enrichWithAI(templateId, caseData)
    }

    const variables = buildBaseVariables(templateId, caseData, narrative)
    const content = renderTemplate(templateId, variables)

    const validation = ReportContentSchema.safeParse(content)
    if (!validation.success) {
      logger.error("report.agent.validation_failed", {
        caseId: caseData.reformCase.id,
        tenantId: caseData.reformCase.tenantId,
        message: validation.error.message,
      })
      throw new Error(`Relatório gerado é inválido: ${validation.error.message}`)
    }

    return { content: validation.data, templateUsed: templateId }
  }

  private async enrichWithAI(
    templateId: TemplateId,
    caseData: ReformCaseData,
  ): Promise<NarrativeFields> {
    const systemPrompt =
      "Você é um analista técnico de reformas prediais. " +
      "Gere texto técnico em português para campos narrativos de relatórios. " +
      "Responda APENAS com JSON entre as tags <narrative>...</narrative>."

    const messages: LLMMessage[] = [
      { role: "user", content: buildNarrativePrompt(templateId, caseData) },
    ]

    let raw: string
    try {
      raw = await this.llm.complete(messages, { system: systemPrompt, maxTokens: 1500, temperature: 0.2 })
    } catch (err) {
      logger.warn("report.agent.llm_error", {
        caseId: caseData.reformCase.id,
        message: (err as Error).message,
      })
      return {}
    }

    const json = extractJson(raw)
    if (json === null) {
      logger.warn("report.agent.no_narrative_tags", { caseId: caseData.reformCase.id })
      return {}
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      logger.warn("report.agent.narrative_json_invalid", { caseId: caseData.reformCase.id })
      return {}
    }

    const result = NarrativeSchema.safeParse(parsed)
    if (!result.success) {
      logger.warn("report.agent.narrative_schema_invalid", { caseId: caseData.reformCase.id })
      return {}
    }

    return result.data
  }
}
