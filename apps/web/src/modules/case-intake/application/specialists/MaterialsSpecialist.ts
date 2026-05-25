import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { NormSearchService } from "@/modules/norms/application/NormSearchService"
import type {
  SpecialistPlugin,
  PluginContext,
  PluginResult,
} from "../../domain/specialists/SpecialistPlugin"
import type { LLMMessage } from "@/modules/document-intelligence/domain/LLMProvider"
import { logger } from "@/shared/logger"

const KEYWORDS = [
  "material",
  "produto",
  "marca",
  "usar",
  "comprar",
  "escolher",
  "argamassa",
  "manta",
  "tinta",
  "fio",
  "tubulação",
  "cerâmica",
  "norma",
  "abnt",
  "nbr",
  "especificação",
  "quanto custa",
  "custo",
  "recomenda",
  "melhor",
]

const SYSTEM_PROMPT = `Você é um especialista em materiais de construção para reformas prediais.
Seu papel é sugerir materiais técnicos adequados com base no escopo da reforma e nas normas ABNT.

Diretrizes:
- Cite sempre a norma ABNT relevante (ex: NBR 9952 para impermeabilização)
- Sugira especificações técnicas (ex: "argamassa ACI colante standard")
- Dê faixa de preço estimada quando possível (R$/m² ou R$/unidade)
- Explique por que cada material é adequado
- Mencione alternativas quando existirem
- Para impermeabilização: sempre mencionar inspeção obrigatória
- NUNCA recomendar marcas exclusivas — dê a especificação técnica e exemplo de marca

Formato de resposta:
- Use listas para materiais
- Cite normas entre parênteses: (NBR XXXXX)
- Separe por serviço quando houver múltiplos
`

export class MaterialsSpecialist implements SpecialistPlugin {
  readonly id = "materials"
  readonly name = "Materiais"
  readonly description = "Recomendação de materiais e normas ABNT para a reforma"
  readonly icon = "package"
  readonly color = "iron"

  matchesIntent(_message: string, _ctx: PluginContext): boolean {
    return false // roteamento feito pelo HaikuIntentDetector
  }

  private buildSearchQuery(ctx: PluginContext): string {
    const services = ctx.reformCase.reformScope?.services?.join(" ") ?? ""
    return `${ctx.message} ${services}`.trim()
  }

  private async fetchNormChunks(query: string) {
    try {
      const service = new NormSearchService()
      return await service.search(query, 8)
    } catch (err) {
      logger.warn("materials.specialist.norm_search_failed", {
        message: err instanceof Error ? err.message : "erro desconhecido",
      })
      return []
    }
  }

  private buildMessages(ctx: PluginContext, normContext: string): LLMMessage[] {
    const scope = ctx.reformCase.reformScope
    const services = scope?.services?.join(", ") ?? "não informado"
    const areas = scope?.areasAffected?.join(", ") ?? "não informado"

    const userContent = normContext
      ? `Serviços da reforma: ${services}
Áreas afetadas: ${areas}

${normContext}

Pergunta: ${ctx.message}`
      : `Serviços da reforma: ${services}
Áreas afetadas: ${areas}

Pergunta: ${ctx.message}`

    return [
      ...ctx.history.map((h) => ({
        role: (h.role.toLowerCase() === "user" ? "user" : "assistant") as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: userContent },
    ]
  }

  async process(ctx: PluginContext): Promise<PluginResult> {
    const query = this.buildSearchQuery(ctx)
    const hits = await this.fetchNormChunks(query)

    const normContext =
      hits.length > 0
        ? `Trechos de normas relevantes:\n${hits.map((h) => `[${h.norm}${h.section ? ` §${h.section}` : ""}] ${h.content}`).join("\n")}`
        : ""

    const sources = hits.map((h) => ({
      norm: h.norm,
      section: h.section,
      excerpt: h.content.slice(0, 200),
    }))

    const llm = new AnthropicProvider()
    const messages = this.buildMessages(ctx, normContext)

    const text = await llm.complete(messages, {
      system: SYSTEM_PROMPT,
      maxTokens: 1500,
      temperature: 0.3,
    })

    return {
      text,
      metadata: {
        specialistId: this.id,
        sources: sources.length > 0 ? sources : undefined,
      },
    }
  }

  processStream(ctx: PluginContext) {
    // Norm search is async — we collect hits first, then stream the LLM response
    const self = this
    let resolveResult!: (r: PluginResult) => void
    let rejectResult!: (e: unknown) => void
    const result = new Promise<PluginResult>((res, rej) => {
      resolveResult = res
      rejectResult = rej
    })

    const textChunks = (async function* () {
      const query = self.buildSearchQuery(ctx)
      const hits = await self.fetchNormChunks(query)

      const normContext =
        hits.length > 0
          ? `Trechos de normas relevantes:\n${hits.map((h) => `[${h.norm}${h.section ? ` §${h.section}` : ""}] ${h.content}`).join("\n")}`
          : ""

      const sources = hits.map((h) => ({
        norm: h.norm,
        section: h.section,
        excerpt: h.content.slice(0, 200),
      }))

      const llm = new AnthropicProvider()
      const messages = self.buildMessages(ctx, normContext)
      const { textChunks: chunks, completion } = llm.streamComplete(messages, {
        system: SYSTEM_PROMPT,
        maxTokens: 1500,
        temperature: 0.3,
      })

      let fullText = ""
      for await (const chunk of chunks) {
        fullText += chunk
        yield chunk
      }

      const completionResult = await completion
      resolveResult({
        text: completionResult.content || fullText,
        metadata: {
          specialistId: self.id,
          sources: sources.length > 0 ? sources : undefined,
        },
      })
    })()

    // Attach error handling to the async generator
    const wrappedChunks = (async function* () {
      try {
        for await (const chunk of textChunks) {
          yield chunk
        }
      } catch (err) {
        rejectResult(err)
        throw err
      }
    })()

    return { textChunks: wrappedChunks, result }
  }
}
