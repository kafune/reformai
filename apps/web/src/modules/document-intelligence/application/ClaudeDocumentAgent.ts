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
    "Você é um analista técnico. Extraia: número da ART, CREA do responsável, data de validade, período previsto de execução do serviço (datas de início e término, se constarem), tipo de obra, valor da obra, nome do responsável técnico.",
  MEMORIAL:
    "Extraia do memorial descritivo: serviços descritos; intervenções com impacto predial (estrutura, prumadas, fachada, esquadrias externas, alteração de demanda/carga elétrica, hidráulica, gás, remoção de piso com risco à impermeabilização, acréscimo de carga sobre laje); responsável técnico (nome e CREA/CAU) se identificado; data de emissão e assinatura se presentes. Não extraia marcas nem quantidades de materiais.",
  AUTHORIZATION:
    "Extraia: nome do condômino, identificador da unidade, data de autorização, lista de serviços autorizados.",
  PROJECT:
    "Você é um analista técnico. Extraia: tipo de projeto, intervenções descritas com impacto predial (estrutura, prumadas, fachada, elétrica, hidráulica, gás, impermeabilização) e responsável técnico se identificado.",
  SCHEDULE:
    "Extraia do cronograma de obra: data de início, data de término e etapas com datas, se houver. Ignore valores, custos e desembolsos (a dimensão financeira não é avaliada).",
  WORKFORCE:
    "Extraia: lista de trabalhadores que atuarão na obra (nome e documento de cada um), empresa/prestadora responsável se houver, e tipo de mão de obra (própria ou terceirizada).",
  WORKER_DOCS:
    "Extraia: identificação dos trabalhadores (nome e documento) presentes nos documentos.",
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

export interface DocumentAgentModelOptions {
  /** Modelo usado na extração de campos (tarefa estruturada — modelo econômico). */
  model?: string
  /** Modelo de maior precisão para documentos do tipo PHOTOS. Sem valor, usa `model`. */
  photosModel?: string
}

export class ClaudeDocumentAgent implements DocumentAgent {
  constructor(
    private readonly llm: LLMProvider,
    private readonly models: DocumentAgentModelOptions = {},
  ) {}

  async extract(text: string, documentType: DocumentType): Promise<DocumentExtractionResult> {
    const system = buildSystemPrompt(documentType)
    const messages: LLMMessage[] = [
      { role: "user", content: buildUserPrompt(text, documentType) },
    ]

    const model =
      documentType === "PHOTOS"
        ? (this.models.photosModel ?? this.models.model)
        : this.models.model

    let raw: string
    try {
      raw = await this.llm.complete(messages, { system, maxTokens: 2000, temperature: 0, model })
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
