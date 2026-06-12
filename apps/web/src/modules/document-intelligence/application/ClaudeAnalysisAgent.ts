import { logger } from "@/shared/logger"
import {
  DocumentAnalysisResultSchema,
  type AnalysisAgent,
  type AnalysisAgentInput,
  type DocumentAnalysisResult,
} from "../domain/AnalysisAgent"
import type { LLMMessage, LLMProvider } from "../domain/LLMProvider"

const SYSTEM_PROMPT = [
  "Você é auditor técnico. Identifique inconsistências cross-documentos",
  "(nomes divergentes entre ART e memorial/autorização, datas incoerentes,",
  "serviços executados não autorizados, materiais não previstos).",
  "Campos da resposta:",
  '- "consistent": true se não há inconsistências relevantes entre os documentos.',
  '- "inconsistencies": conflitos entre documentos, com severidade low | medium | high.',
  '- "pendencies": itens faltando ou a corrigir, em linguagem simples para o morador.',
  '- "recommendation": "approve" | "approve_with_caveats" | "reject" | "request_corrections".',
  '- "reasoning": justificativa breve da recomendação.',
  "Responda somente com o JSON — sem texto adicional.",
].join("\n")

// Espelha DocumentAnalysisResultSchema (Zod) no formato JSON Schema exigido
// por structured outputs (todos os objetos com additionalProperties: false).
const ANALYSIS_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    consistent: { type: "boolean" },
    inconsistencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string" },
          documentA: { type: "string" },
          documentB: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["field", "documentA", "documentB", "description", "severity"],
        additionalProperties: false,
      },
    },
    pendencies: { type: "array", items: { type: "string" } },
    recommendation: {
      type: "string",
      enum: ["approve", "approve_with_caveats", "reject", "request_corrections"],
    },
    reasoning: { type: "string" },
  },
  required: ["consistent", "inconsistencies", "pendencies", "recommendation", "reasoning"],
  additionalProperties: false,
}

function buildUserPrompt(documents: AnalysisAgentInput[]): string {
  const lines: string[] = ["Documentos para análise cruzada:", ""]
  documents.forEach((doc, idx) => {
    lines.push(`Documento ${idx + 1} — tipo: ${doc.type}`)
    lines.push("Dados extraídos:")
    lines.push(JSON.stringify(doc.extractedData, null, 2))
    lines.push("")
  })
  lines.push("Analise os documentos acima e devolva o JSON da análise.")
  return lines.join("\n")
}

/**
 * Rede de segurança para providers que ignorem `outputJsonSchema`: aceita a
 * resposta como JSON puro ou recorta o trecho entre o primeiro `{` e o último
 * `}` (preâmbulo, cercas de markdown).
 */
function extractJson(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith("{")) return trimmed
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end <= start) return trimmed
  return raw.slice(start, end + 1)
}

export interface AnalysisAgentModelOptions {
  /** Modelo usado na análise cruzada (exige raciocínio — modelo mais capaz). */
  model?: string
}

export class ClaudeAnalysisAgent implements AnalysisAgent {
  constructor(
    private readonly llm: LLMProvider,
    private readonly models: AnalysisAgentModelOptions = {},
  ) {}

  async analyze(documents: AnalysisAgentInput[]): Promise<DocumentAnalysisResult> {
    const messages: LLMMessage[] = [{ role: "user", content: buildUserPrompt(documents) }]

    let raw: string
    try {
      raw = await this.llm.complete(messages, {
        system: SYSTEM_PROMPT,
        maxTokens: 8000,
        temperature: 0,
        model: this.models.model,
        outputJsonSchema: ANALYSIS_OUTPUT_SCHEMA,
      })
    } catch (err) {
      return this.failure("Falha na chamada ao LLM", { error: (err as Error).message })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(extractJson(raw))
    } catch (err) {
      return this.failure("JSON inválido na resposta", { error: (err as Error).message })
    }

    const validation = DocumentAnalysisResultSchema.safeParse(parsed)
    if (!validation.success) {
      return this.failure("Shape inválido", { issues: validation.error.issues })
    }

    return validation.data
  }

  // Degrada com `degraded: true` em vez de lançar — o consumidor (worker)
  // decide a política de retry/status; o agente permanece puro.
  private failure(reason: string, meta?: Record<string, unknown>): DocumentAnalysisResult {
    logger.warn("analysis.agent.degraded", { reason, ...meta })
    return {
      consistent: false,
      inconsistencies: [],
      pendencies: ["Análise automática indisponível — requer revisão manual."],
      recommendation: "request_corrections",
      reasoning: `Análise automática não pôde ser concluída: ${reason}.`,
      degraded: true,
    }
  }
}
