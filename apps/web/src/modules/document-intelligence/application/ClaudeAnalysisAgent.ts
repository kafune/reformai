import { logger } from "@/shared/logger"
import {
  DocumentAnalysisResultSchema,
  type AnalysisAgent,
  type AnalysisAgentInput,
  type DocumentAnalysisResult,
} from "../domain/AnalysisAgent"
import type { LLMMessage, LLMProvider } from "../domain/LLMProvider"

const ANALYSIS_OPEN_TAG = "<analysis>"
const ANALYSIS_CLOSE_TAG = "</analysis>"

const SYSTEM_PROMPT = [
  "Você é auditor técnico. Identifique inconsistências cross-documentos",
  "(nomes divergentes entre ART e memorial/autorização, datas incoerentes,",
  "serviços executados não autorizados, materiais não previstos).",
  "Retorne JSON dentro de tags <analysis>...</analysis> no formato:",
  "{",
  '  "consistent": <boolean>,',
  '  "inconsistencies": [ { "field": string, "documentA": string, "documentB": string, "description": string, "severity": "low" | "medium" | "high" } ],',
  '  "pendencies": [ string ],',
  '  "recommendation": "approve" | "approve_with_caveats" | "reject" | "request_corrections",',
  '  "reasoning": string',
  "}",
  "Não inclua texto fora das tags <analysis>...</analysis>.",
].join("\n")

function buildUserPrompt(documents: AnalysisAgentInput[]): string {
  const lines: string[] = ["Documentos para análise cruzada:", ""]
  documents.forEach((doc, idx) => {
    lines.push(`Documento ${idx + 1} — tipo: ${doc.type}`)
    lines.push("Dados extraídos:")
    lines.push(JSON.stringify(doc.extractedData, null, 2))
    lines.push("")
  })
  lines.push(
    "Analise os documentos acima e devolva o JSON entre <analysis>...</analysis>.",
  )
  return lines.join("\n")
}

function extractJsonBetweenTags(raw: string): string | null {
  const openIdx = raw.indexOf(ANALYSIS_OPEN_TAG)
  if (openIdx === -1) return null
  const start = openIdx + ANALYSIS_OPEN_TAG.length
  const closeIdx = raw.indexOf(ANALYSIS_CLOSE_TAG, start)
  if (closeIdx === -1) return null
  return raw.slice(start, closeIdx).trim()
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
        maxTokens: 3000,
        temperature: 0,
        model: this.models.model,
      })
    } catch (err) {
      return this.failure("Falha na chamada ao LLM", { error: (err as Error).message })
    }

    const json = extractJsonBetweenTags(raw)
    if (json === null) {
      return this.failure("Tags <analysis>...</analysis> não encontradas na resposta")
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      return this.failure("JSON inválido na resposta", { error: (err as Error).message })
    }

    const validation = DocumentAnalysisResultSchema.safeParse(parsed)
    if (!validation.success) {
      return this.failure("Shape inválido", { issues: validation.error.issues })
    }

    return validation.data
  }

  // Degrada para revisão manual em vez de lançar — assim uma resposta ruim do
  // LLM não derruba o job de processamento documental (BullMQ, 3 tentativas).
  private failure(reason: string, meta?: Record<string, unknown>): DocumentAnalysisResult {
    logger.warn("analysis.agent.degraded", { reason, ...meta })
    return {
      consistent: false,
      inconsistencies: [],
      pendencies: ["Análise automática indisponível — requer revisão manual."],
      recommendation: "request_corrections",
      reasoning: `Análise automática não pôde ser concluída: ${reason}.`,
    }
  }
}
