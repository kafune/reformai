import { z } from "zod"
import type { LLMMessage, LLMProvider } from "@/modules/document-intelligence/domain/LLMProvider"
import type { PriceCalculatorOutput } from "../domain/PriceCalculator"
import type { ReformCase, CommercialPlan } from "@reformai/database"

// ---------------------------------------------------------------------------
// Output schema (Zod-validated before returning to callers)
// ---------------------------------------------------------------------------

export const CommercialOfferOutputSchema = z.object({
  narrativa: z.string().min(1),
  beneficiosDestacados: z.array(z.string()).min(1),
  prazo: z.string().min(1),
})

export type CommercialOfferOutput = z.infer<typeof CommercialOfferOutputSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OFFER_OPEN_TAG = "<offer>"
const OFFER_CLOSE_TAG = "</offer>"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return [
    "Você é um especialista em comunicação comercial para o setor de reformas prediais.",
    "Sua tarefa é gerar texto de proposta comercial personalizado em linguagem natural para o cliente.",
    "",
    "IMPORTANTE:",
    "- Seja claro, profissional e persuasivo.",
    "- Destaque os benefícios para o cliente.",
    "- Nunca prometa emissão de ART/RRT pela plataforma — isso é responsabilidade do profissional habilitado.",
    "",
    "Responda APENAS com um objeto JSON envolvido nas tags <offer>...</offer>.",
    "O JSON deve ter EXATAMENTE o seguinte formato:",
    "{",
    '  "narrativa": "<texto da proposta em linguagem natural, 2-4 parágrafos>",',
    '  "beneficiosDestacados": ["<benefício 1>", "<benefício 2>", "..."],',
    '  "prazo": "<prazo estimado de resposta ou atendimento>"',
    "}",
    "Não inclua texto fora das tags <offer>...</offer>.",
  ].join("\n")
}

function buildUserPrompt(
  reformCase: Pick<ReformCase, "id" | "protocol" | "riskLevel" | "reformScope">,
  plan: CommercialPlan,
  quote: PriceCalculatorOutput,
): string {
  const scope = reformCase.reformScope
    ? JSON.stringify(reformCase.reformScope, null, 2)
    : "Não disponível"

  return [
    `Protocolo do caso: ${reformCase.protocol}`,
    `Nível de risco: ${reformCase.riskLevel ?? "Não classificado"}`,
    "",
    "Escopo da reforma:",
    scope,
    "",
    "Plano comercial selecionado:",
    `- Nome: ${plan.name}`,
    `- Descrição: ${plan.description}`,
    `- Preço base: R$ ${quote.basePrice.toFixed(2)}`,
    `- Vistorias incluídas: ${quote.inspectionsIncluded}`,
    ...(quote.extraInspectionCost > 0
      ? [`- Custo de vistorias extras: R$ ${quote.extraInspectionCost.toFixed(2)}`]
      : []),
    `- TOTAL: R$ ${quote.totalPrice.toFixed(2)}`,
    "",
    "Detalhamento:",
    ...quote.breakdown.map((b) => `  ${b.item}: R$ ${b.amount.toFixed(2)}`),
    "",
    "Gere a proposta comercial personalizada para este cliente com base nas informações acima.",
    "Devolva o JSON entre <offer>...</offer>.",
  ].join("\n")
}

function extractJsonBetweenTags(raw: string): string | null {
  const openIdx = raw.indexOf(OFFER_OPEN_TAG)
  if (openIdx === -1) return null
  const start = openIdx + OFFER_OPEN_TAG.length
  const closeIdx = raw.indexOf(OFFER_CLOSE_TAG, start)
  if (closeIdx === -1) return null
  return raw.slice(start, closeIdx).trim()
}

// ---------------------------------------------------------------------------
// CommercialAgent
// ---------------------------------------------------------------------------

export class CommercialAgent {
  constructor(private readonly llm: LLMProvider) {}

  async generateOffer(
    reformCase: Pick<ReformCase, "id" | "protocol" | "riskLevel" | "reformScope">,
    plan: CommercialPlan,
    quote: PriceCalculatorOutput,
  ): Promise<CommercialOfferOutput> {
    const system = buildSystemPrompt()
    const messages: LLMMessage[] = [
      { role: "user", content: buildUserPrompt(reformCase, plan, quote) },
    ]

    let raw: string
    try {
      raw = await this.llm.complete(messages, { system, maxTokens: 1500, temperature: 0.3 })
    } catch (err) {
      return this.fallback(`LLM error: ${(err as Error).message}`, plan, quote)
    }

    const json = extractJsonBetweenTags(raw)
    if (json === null) {
      return this.fallback(
        "Resposta do LLM não continha tags <offer>...</offer>.",
        plan,
        quote,
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (err) {
      return this.fallback(`JSON inválido: ${(err as Error).message}`, plan, quote)
    }

    const validation = CommercialOfferOutputSchema.safeParse(parsed)
    if (!validation.success) {
      return this.fallback(
        `Validação Zod falhou: ${validation.error.message}`,
        plan,
        quote,
      )
    }

    return validation.data
  }

  /** Returns a safe fallback offer when the LLM fails, so the flow doesn't crash. */
  private fallback(
    _reason: string,
    plan: CommercialPlan,
    quote: PriceCalculatorOutput,
  ): CommercialOfferOutput {
    return {
      narrativa: [
        `Apresentamos a proposta comercial para a sua reforma com o plano **${plan.name}**.`,
        `${plan.description}`,
        `O valor total é de **R$ ${quote.totalPrice.toFixed(2)}**, com ${quote.inspectionsIncluded} vistorias inclusas.`,
        "Nossa equipe entrará em contato para confirmar os próximos passos.",
      ].join("\n\n"),
      beneficiosDestacados: [
        "Triagem técnica especializada",
        "Acompanhamento por profissional habilitado",
        `${quote.inspectionsIncluded} vistorias de qualidade inclusas`,
        "Documentação completa do processo",
      ],
      prazo: "Até 2 dias úteis para retorno após confirmação",
    }
  }
}
