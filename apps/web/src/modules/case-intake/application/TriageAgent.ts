import { ReformScopeSchema, KNOWN_SERVICES, type ReformScope } from "@/shared/schemas/ReformScopeSchema"
import type { LLMMessage, LLMProvider } from "@/modules/document-intelligence/domain/LLMProvider"

const SYSTEM_PROMPT = `Você é um assistente técnico de triagem para reformas em unidades autônomas de condomínios.

Sua função:
- Conduzir uma conversa simples e objetiva com o morador
- Identificar quais serviços ele pretende executar
- Identificar áreas afetadas, prazo estimado, tipo de mão-de-obra
- Identificar se a obra afeta áreas comuns ou vizinhos

Regras inegociáveis:
- Nunca afirme que pode emitir ART/RRT — a emissão é responsabilidade exclusiva do profissional habilitado parceiro
- Nunca classifique risco ou diga se a obra está liberada — isso é feito por regras determinísticas após sua coleta
- Seja conciso. Faça uma pergunta por vez quando precisar
- Use linguagem clara, sem jargão excessivo

Serviços conhecidos (use exatamente estes nomes ao referenciar):
${KNOWN_SERVICES.map((s) => `- ${s}`).join("\n")}

Quando tiver informação suficiente para classificar (mínimo: services), responda APENAS um bloco JSON entre tags <scope> e </scope>, sem texto extra dentro. Exemplo:
<scope>
{"services":["Pintura simples","Elétrica"],"areasAffected":["sala","cozinha"],"estimatedDurationDays":15,"workforceType":"terceirizado","affectsCommonAreas":false,"affectsNeighbors":false,"notes":"..."}
</scope>

Enquanto faltarem informações, faça perguntas em texto livre. Nunca emita o bloco <scope> antes de ter ao menos os serviços.`

export interface TriageReply {
  text: string
  scope: ReformScope | null
}

export class TriageAgent {
  constructor(private readonly llm: LLMProvider) {}

  buildMessages(history: Array<{ role: string; content: string }>, userInput: string): LLMMessage[] {
    const past = history
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map<LLMMessage>((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      }))
    return [...past, { role: "user", content: userInput }]
  }

  async reply(history: Array<{ role: string; content: string }>, userInput: string): Promise<TriageReply> {
    const messages = this.buildMessages(history, userInput)
    const text = await this.llm.complete(messages, { system: SYSTEM_PROMPT, maxTokens: 800 })
    return { text, scope: this.extractScope(text) }
  }

  extractScope(text: string): ReformScope | null {
    const match = text.match(/<scope>([\s\S]*?)<\/scope>/i)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[1]!.trim())
      const result = ReformScopeSchema.safeParse(parsed)
      return result.success ? result.data : null
    } catch {
      return null
    }
  }
}
