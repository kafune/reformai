import type { DocumentType } from "@reformai/database"
import {
  DocumentExtractionResultSchema,
  type DocumentAgent,
  type DocumentExtractionResult,
} from "../domain/DocumentAgent"
import type { LLMMessage, LLMProvider } from "../domain/LLMProvider"

const EXTRACTION_OPEN_TAG = "<extraction>"
const EXTRACTION_CLOSE_TAG = "</extraction>"

const SYSTEM_PROMPTS: Record<DocumentType, string> = {
  ART_RRT:
    "Você é um analista técnico. Extraia: número da ART, CREA do responsável, data de validade, tipo de obra, valor da obra, nome do responsável técnico.",
  MEMORIAL: "Extraia: materiais listados (com quantidades), serviços descritos.",
  AUTHORIZATION:
    "Extraia: nome do condômino, identificador da unidade, data de autorização, lista de serviços autorizados.",
  PROJECT: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  SCHEDULE: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  WORKFORCE: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  WORKER_DOCS: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  PHOTOS: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  INSPECTION_REPORT:
    "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  ART_RRT_FINAL: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
  OTHER: "Você é um analista técnico. Extraia os campos relevantes ao tipo do documento.",
}

function buildSystemPrompt(documentType: DocumentType): string {
  const base = SYSTEM_PROMPTS[documentType] ?? SYSTEM_PROMPTS.OTHER
  return [
    base,
    "",
    "Responda APENAS com um objeto JSON envolvido nas tags <extraction>...</extraction>.",
    "O JSON deve ter EXATAMENTE o seguinte formato:",
    "{",
    `  "documentType": "${documentType}",`,
    '  "extractedFields": { /* campos extraídos como pares chave-valor */ },',
    '  "confidence": <número entre 0 e 1>,',
    '  "warnings": [ /* lista de avisos, vazia se não houver */ ]',
    "}",
    "Não inclua texto fora das tags <extraction>...</extraction>.",
  ].join("\n")
}

function buildUserPrompt(text: string, documentType: DocumentType): string {
  return [
    `Tipo do documento: ${documentType}`,
    "",
    "Conteúdo do documento:",
    "---",
    text,
    "---",
    "",
    "Extraia os campos relevantes e devolva o JSON entre <extraction>...</extraction>.",
  ].join("\n")
}

function extractJsonBetweenTags(raw: string): string | null {
  const openIdx = raw.indexOf(EXTRACTION_OPEN_TAG)
  if (openIdx === -1) return null
  const start = openIdx + EXTRACTION_OPEN_TAG.length
  const closeIdx = raw.indexOf(EXTRACTION_CLOSE_TAG, start)
  if (closeIdx === -1) return null
  return raw.slice(start, closeIdx).trim()
}

export class ClaudeDocumentAgent implements DocumentAgent {
  constructor(private readonly llm: LLMProvider) {}

  async extract(text: string, documentType: DocumentType): Promise<DocumentExtractionResult> {
    const system = buildSystemPrompt(documentType)
    const messages: LLMMessage[] = [
      { role: "user", content: buildUserPrompt(text, documentType) },
    ]

    let raw: string
    try {
      raw = await this.llm.complete(messages, { system, maxTokens: 2000, temperature: 0 })
    } catch (err) {
      return this.failure(documentType, `LLM error: ${(err as Error).message}`)
    }

    const json = extractJsonBetweenTags(raw)
    if (json === null) {
      return this.failure(
        documentType,
        "Resposta do LLM não continha tags <extraction>...</extraction>.",
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      return this.failure(documentType, `JSON inválido: ${(err as Error).message}`)
    }

    const validation = DocumentExtractionResultSchema.safeParse(parsed)
    if (!validation.success) {
      return this.failure(documentType, `Validação Zod falhou: ${validation.error.message}`)
    }

    return validation.data
  }

  private failure(documentType: DocumentType, warning: string): DocumentExtractionResult {
    return {
      documentType,
      extractedFields: {},
      confidence: 0,
      warnings: [warning],
    }
  }
}
