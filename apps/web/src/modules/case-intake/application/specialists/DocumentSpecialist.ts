import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import type {
  SpecialistPlugin,
  PluginContext,
  PluginResult,
} from "../../domain/specialists/SpecialistPlugin"
import type { LLMMessage } from "@/modules/document-intelligence/domain/LLMProvider"

const KEYWORDS = [
  "document",
  "memorial",
  "art",
  "rrt",
  "crea",
  "cau",
  "habite",
  "autorização",
  "projeto",
  "cronograma",
  "mão de obra",
  "fotos",
  "enviar",
  "pendência",
  "inválido",
  "corrigir",
  "problema",
  "preciso",
  "o que falta",
  "quais",
  "documento",
]

const SYSTEM_PROMPT = `Você é um especialista em documentação para reformas prediais em condomínios.
Seu papel é orientar o morador sobre:
- Quais documentos são necessários para o tipo de reforma dele
- Como obter cada documento (especialmente ART/RRT)
- O que significam os status dos documentos (INVALID, VALID_WITH_CAVEATS, etc.)
- Como corrigir pendências identificadas pela análise da IA

Regras:
- Seja claro, direto e use linguagem simples (não técnica)
- NUNCA diga que a plataforma emite ART/RRT — isso é responsabilidade exclusiva do profissional habilitado
- Se o usuário perguntar sobre ART/RRT, explique o que é e como obter junto ao profissional
- Baseie suas respostas nos documentos já enviados e no escopo da reforma
- Se identificar pendências específicas nos documentos, explique-as em linguagem simples
`

export class DocumentSpecialist implements SpecialistPlugin {
  readonly id = "document"
  readonly name = "Documentos"
  readonly description = "Orientação sobre documentos necessários e pendências"
  readonly icon = "upload"
  readonly color = "azulejo"

  matchesIntent(_message: string, _ctx: PluginContext): boolean {
    return false // roteamento feito pelo HaikuIntentDetector
  }

  private buildUserMessage(ctx: PluginContext): string {
    const scope = ctx.reformCase.reformScope
    const services = scope?.services?.join(", ") ?? "não informado"

    const docsInfo =
      ctx.documents.length === 0
        ? "Nenhum documento enviado ainda."
        : ctx.documents
            .map((d) => {
              const pendencies =
                d.pendencies && typeof d.pendencies === "object"
                  ? JSON.stringify(d.pendencies)
                  : "nenhuma"
              return `- ${d.type} (${d.fileName}): ${d.status}. Pendências: ${pendencies}`
            })
            .join("\n")

    return `Serviços da reforma: ${services}
Risco: ${ctx.reformCase.riskLevel ?? "não classificado"}
Requer ART/RRT: ${ctx.reformCase.evaluationResult?.requiresART ?? "não avaliado"}

Documentos enviados:
${docsInfo}

Pergunta do morador: ${ctx.message}`
  }

  private buildMessages(ctx: PluginContext): LLMMessage[] {
    return [
      ...ctx.history.map((h) => ({
        role: (h.role.toLowerCase() === "user" ? "user" : "assistant") as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: this.buildUserMessage(ctx) },
    ]
  }

  async process(ctx: PluginContext): Promise<PluginResult> {
    const llm = new AnthropicProvider()
    const messages = this.buildMessages(ctx)
    const text = await llm.complete(messages, {
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.3,
    })
    return { text, metadata: { specialistId: this.id } }
  }

  processStream(ctx: PluginContext) {
    const llm = new AnthropicProvider()
    const messages = this.buildMessages(ctx)
    const { textChunks, completion } = llm.streamComplete(messages, {
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
      temperature: 0.3,
    })
    const result = completion.then(
      (r): PluginResult => ({
        text: r.content,
        metadata: { specialistId: this.id },
      }),
    )
    return { textChunks, result }
  }
}
