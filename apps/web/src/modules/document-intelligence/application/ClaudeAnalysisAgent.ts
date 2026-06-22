import { logger } from "@/shared/logger"
import {
  DocumentAnalysisResultSchema,
  type AnalysisAgent,
  type AnalysisAgentInput,
  type AnalysisContext,
  type DocumentAnalysisResult,
} from "../domain/AnalysisAgent"
import type { LLMMessage, LLMProvider } from "../domain/LLMProvider"

const SYSTEM_PROMPT = [
  "Você é o analista técnico de um condomínio avaliando a documentação de uma",
  "reforma em unidade autônoma. A responsabilidade do condomínio NÃO é auditar",
  "a qualidade da obra do morador — é proteger as áreas comuns e os sistemas",
  "prediais. Avalie SOMENTE:",
  "",
  "1. Impacto predial: os documentos indicam intervenção em estrutura, prumadas",
  "   (hidráulica/esgoto), fachada, esquadrias externas, alteração de demanda ou",
  "   carga elétrica, gás, remoção de piso com risco à impermeabilização, ou",
  "   acréscimo de carga sobre lajes?",
  "2. Coerência com o escopo declarado: os documentos descrevem serviços com",
  "   impacto predial que NÃO constam do escopo declarado na triagem (ou o",
  "   escopo declara impactos que a documentação não cobre)?",
  "3. Cobertura documental dos impactos: para cada impacto identificado, a",
  "   documentação de respaldo esperada está presente e coerente — ex.:",
  "   declaração de não intervenção estrutural, projeto hidráulico/elétrico,",
  "   ART/RRT correspondente aos serviços de risco?",
  "",
  "   Indicação de projeto por intervenção (quando o memorial indicar a",
  "   intervenção e o projeto correspondente não estiver entre os documentos,",
  "   gere pendência pedindo o projeto e CITE a norma):",
  "   - Alteração de prumadas ou instalações hidráulicas → projeto hidráulico",
  "     (NBR 5626).",
  "   - Acréscimo de carga ou alteração de demanda elétrica (novos circuitos,",
  "     aumento de tomadas) → projeto elétrico (NBR 5410).",
  "   - Acréscimo de carga/peso sobre laje (ex.: enchimento de piso, banheira,",
  "     equipamento pesado) → avaliação/projeto estrutural com ART (NBR 6118 e",
  "     NBR 16280).",
  "   - Alteração ou refazimento de impermeabilização (ex.: remoção de piso em",
  "     área molhada) → projeto de impermeabilização conforme NBR 9575 e",
  "     execução conforme NBR 9574.",
  "   - Qualquer intervenção estrutural → projeto/declaração de",
  "     responsabilidade estrutural com ART (NBR 16280).",
  "",
  "4. Identificação formal mínima: responsável técnico identificado (nome e",
  "   CREA/CAU) nos documentos que o exigem.",
  "5. Cronograma físico: quando houver cronograma, ele deve informar quando a",
  "   obra começa e quando termina, e essas datas devem ser coerentes com o",
  "   período de execução previsto na ART/RRT. Exija apenas o cronograma",
  "   FÍSICO (datas/etapas) — nunca o físico-financeiro.",
  "6. Lista de trabalhadores: quando houver, deve identificar os trabalhadores",
  "   que atuarão na obra (necessária para liberação na portaria) e ser",
  "   coerente com o tipo de mão de obra declarado (própria/terceirizada).",
  "",
  "FACHADA — ATENÇÃO ESPECIAL: alterações que afetem a fachada do prédio são,",
  "via de regra, expressamente proibidas em condomínio e dependem de aprovação",
  "em assembleia. Fique atento a descrições que afetam a fachada mesmo sem usar",
  'a palavra "fachada": troca ou alteração de janelas e esquadrias externas,',
  "pintura externa, fechamento ou envidraçamento de varanda, instalação de",
  "grades, telas, toldos ou unidades externas de ar-condicionado visíveis.",
  "Identificada alteração de fachada, registre inconsistência de severidade",
  '"high", NUNCA recomende "approve" e explicite na pendência que a alteração',
  "depende de autorização expressa do condomínio/assembleia.",
  "",
  "NÃO avalie e NÃO gere pendências sobre:",
  "- marcas, qualidade, adequação, quantidade ou veracidade de materiais e",
  "  produtos — não peça laudos, fichas técnicas (FISPQ), certificados ou",
  "  ensaios (ex.: não exija comprovação de que uma tinta é de base aquosa);",
  "- situação cadastral de CNPJ, vínculo de empresa ou profissional em",
  "  conselho de classe, contratos de prestação de serviço, ordens de serviço",
  "  ou qualquer documento comercial;",
  "- versão ou edição de normas citadas nos documentos;",
  "- escolhas técnicas ou estéticas internas da unidade; valores, custos ou",
  "  desembolsos (inclusive a dimensão financeira do cronograma).",
  "Aceite as declarações dos documentos como verdadeiras: o papel desta",
  "análise não é verificar veracidade nem fiscalizar a obra do morador — é",
  "identificar impacto predial e exigir o respaldo documental correto.",
  "",
  "Pendências devem se limitar aos documentos do processo da plataforma:",
  "ART/RRT, autorização do condomínio, projetos técnicos (hidráulico,",
  "elétrico, estrutural, impermeabilização), cronograma físico e lista de",
  "trabalhadores. Não invente outros tipos de documento.",
  "",
  "Campos da resposta:",
  '- "consistent": true se não há conflito relevante entre documentos e escopo.',
  '- "inconsistencies": conflitos entre documentos ou entre documento e escopo',
  "  declarado, com severidade low | medium | high.",
  '- "pendencies": apenas itens que bloqueiam a liberação pelo condomínio',
  "  (impacto predial sem documento de respaldo), em linguagem simples.",
  '- "recommendation": "approve" | "approve_with_caveats" | "reject" | "request_corrections".',
  '- "reasoning": justificativa breve, centrada em impacto predial.',
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

function buildUserPrompt(documents: AnalysisAgentInput[], context?: AnalysisContext): string {
  const lines: string[] = []

  if (context?.reformScope) {
    lines.push("Escopo declarado pelo morador na triagem (base de comparação):")
    lines.push(JSON.stringify(context.reformScope, null, 2))
    if (context.riskLevel) {
      lines.push(`Nível de risco classificado: ${context.riskLevel}`)
    }
    lines.push("")
  }

  lines.push("Documentos para análise:", "")
  documents.forEach((doc, idx) => {
    lines.push(`Documento ${idx + 1} — tipo: ${doc.type}`)
    lines.push("Dados extraídos:")
    lines.push(JSON.stringify(doc.extractedData, null, 2))
    lines.push("")
  })
  lines.push(
    "Avalie o impacto predial e a cobertura documental conforme as instruções e devolva o JSON da análise.",
  )
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

  async analyze(
    documents: AnalysisAgentInput[],
    context?: AnalysisContext,
  ): Promise<DocumentAnalysisResult> {
    const messages: LLMMessage[] = [
      { role: "user", content: buildUserPrompt(documents, context) },
    ]

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
