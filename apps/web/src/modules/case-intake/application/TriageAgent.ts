import { CANONICAL_SERVICES, ReformScopeSchema, type ReformScope } from "@/shared/schemas/ReformScopeSchema"
import type {
  CompletionResult,
  LLMMessage,
  LLMProvider,
  LLMTool,
  StreamCompleteResult,
} from "@/modules/document-intelligence/domain/LLMProvider"

export interface ChatHistoryItem {
  role: string
  content: string
}

export interface TriageResult {
  response: string
  scope?: ReformScope
  scopeComplete: boolean
}

const SUBMIT_SCOPE_TOOL: LLMTool = {
  name: "submit_scope",
  description:
    "Use esta ferramenta quando tiver informações suficientes sobre a reforma para registrar o escopo técnico. Utilize os nomes canônicos dos serviços fornecidos na lista.",
  inputSchema: {
    type: "object",
    properties: {
      services: {
        type: "array",
        items: { type: "string", enum: CANONICAL_SERVICES },
        minItems: 1,
        description: "Lista de serviços canônicos que serão realizados",
      },
      areasAffected: {
        type: "array",
        items: { type: "string" },
        description: "Cômodos ou áreas da unidade afetados pela obra (ex.: cozinha, banheiro, sala)",
      },
      estimatedArea: {
        type: "number",
        description: "Área estimada da obra em m²",
      },
      estimatedDurationDays: {
        type: "integer",
        description: "Duração estimada da obra em dias",
      },
      workforceType: {
        type: "string",
        enum: ["proprio", "terceirizado", "indefinido"],
        description: "Tipo de mão de obra: própria do morador, terceirizada ou indefinida",
      },
      affectsStructure: {
        type: "boolean",
        description: "A obra afeta a estrutura do prédio (vigas, pilares, lajes)?",
      },
      affectsExternalFacade: {
        type: "boolean",
        description: "A obra afeta a fachada externa do edifício?",
      },
      affectsCommonAreas: {
        type: "boolean",
        description: "A obra afeta áreas comuns do condomínio?",
      },
      affectsNeighbors: {
        type: "boolean",
        description: "A obra afeta unidades vizinhas?",
      },
      city: {
        type: "string",
        description: "Cidade onde o condomínio está localizado",
      },
      urgency: {
        type: "string",
        enum: ["normal", "urgent"],
        description: "Urgência da obra",
      },
      description: {
        type: "string",
        description: "Descrição livre da obra",
      },
      notes: {
        type: "string",
        description: "Observações adicionais relevantes para a triagem",
      },
    },
    required: ["services"],
  },
}

const SYSTEM_PROMPT = `Você é um assistente de triagem técnica da plataforma ReformAI para reformas em unidades autônomas de condomínios no Brasil.

Sua função é conduzir uma entrevista amigável e objetiva para coletar informações sobre a reforma planejada pelo morador.

**Informações que você deve coletar:**
1. Quais serviços de reforma serão realizados (OBRIGATÓRIO)
2. Quais cômodos/áreas serão afetados
3. Área estimada da obra em m² e duração estimada em dias
4. Tipo de mão de obra (própria ou terceirizada)
5. Se a obra afeta estrutura do prédio (vigas, pilares, lajes)
6. Se afeta fachada externa, áreas comuns ou unidades vizinhas
7. Urgência (normal ou urgente)

**Serviços canônicos disponíveis (use EXATAMENTE estes nomes):**
${CANONICAL_SERVICES.map((s) => `- ${s}`).join("\n")}

**Guia de classificação de risco e ART/RRT (para orientar perguntas relevantes):**
- BAIXO risco (sem ART): Pintura simples, Troca de piso sem demolição, Ar-condicionado (split)
- MÉDIO risco (exige ART): Troca de piso com demolição, Mudança de layout, Esquadrias externas, Equipamentos fixos pesados
- ALTO risco (exige ART): Elétrica, Hidráulica, Impermeabilização (vistoria obrigatória), Gás (vistoria obrigatória)
- CRÍTICO / revisão humana obrigatória: Demolição de alvenaria, Fachada, Impacto estrutural/prumadas
- Serviços podem ser combinados; os scores somam.

**Mapeamento de descrições comuns para serviços canônicos:**
- "trocar tomadas", "fiação", "quadro elétrico", "disjuntor" → Elétrica
- "encanamento", "canos", "registro", "chuveiro novo" → Hidráulica
- "reboco", "chapisco", "argamassa" sem demolição → Pintura simples ou Troca de piso sem demolição
- "derrubar parede", "abrir vão", "parede de alvenaria" → Demolição de alvenaria
- "laje", "viga", "pilar", "prumada", "coluna" → Impacto estrutural/prumadas
- "janela externa", "porta de entrada do prédio" → Esquadrias externas
- "ar split", "multi-split" → Ar-condicionado (split)
- "impermeabilizar varanda/banheiro/telhado" → Impermeabilização
- "gás encanado", "fogão embutido", "aquecedor a gás" → Gás

**Instruções:**
- Faça no máximo 2-3 perguntas por mensagem. Não sobrecarregue o morador.
- Quando tiver ao menos os serviços planejados, use a ferramenta submit_scope para registrar o escopo.
- Seja cordial, claro e objetivo. Responda sempre em português brasileiro.
- Você NÃO emite ART/RRT. Você NÃO aprova obras nem classifica risco — isso é feito por regras determinísticas após sua coleta.
- Se o morador descrever serviços com palavras diferentes, mapeie para os nomes canônicos mais próximos.
- Ao registrar o escopo, inclua apenas os serviços confirmados pelo morador.`

export class TriageAgent {
  constructor(private readonly llm: LLMProvider) {}

  /** Conclusão não-streaming — usada pela rota POST /messages. */
  async process(history: ChatHistoryItem[], newUserMessage: string): Promise<TriageResult> {
    const messages = this.buildMessages(history, newUserMessage)
    const result = await this.llm.completeWithTools(messages, {
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_SCOPE_TOOL],
      maxTokens: 1024,
      temperature: 0,
    })

    const scope = this.extractScope(result)
    if (scope) {
      const response =
        result.content ||
        `Escopo registrado! Serviços identificados: ${scope.services.join(", ")}. Vou processar a triagem técnica agora.`
      return { response, scope, scopeComplete: true }
    }

    return { response: result.content, scopeComplete: false }
  }

  /** Conclusão com streaming — usada pela rota SSE /messages/stream. */
  processStream(
    history: ChatHistoryItem[],
    newUserMessage: string,
  ): StreamCompleteResult & { scopePromise: Promise<ReformScope | null> } {
    const messages = this.buildMessages(history, newUserMessage)
    const { textChunks, completion } = this.llm.streamComplete(messages, {
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_SCOPE_TOOL],
      maxTokens: 1024,
      temperature: 0,
    })

    const scopePromise = completion.then((result) => this.extractScope(result))
    return { textChunks, completion, scopePromise }
  }

  /** Valida a chamada de tool submit_scope contra o ReformScopeSchema. */
  private extractScope(result: CompletionResult): ReformScope | null {
    if (result.stopReason !== "tool_use" || result.toolCall?.name !== "submit_scope") {
      return null
    }
    const parsed = ReformScopeSchema.safeParse(result.toolCall.input)
    return parsed.success ? parsed.data : null
  }

  private buildMessages(history: ChatHistoryItem[], newUserMessage: string): LLMMessage[] {
    const past = history
      .filter((m) => m.role === "USER" || m.role === "ASSISTANT")
      .map<LLMMessage>((m) => ({
        role: m.role === "USER" ? "user" : "assistant",
        content: m.content,
      }))
    return [...past, { role: "user", content: newUserMessage }]
  }
}
