import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import type {
  SpecialistPlugin,
  PluginContext,
  PluginResult,
} from "../../domain/specialists/SpecialistPlugin"
import type { LLMMessage, LLMTool } from "@/modules/document-intelligence/domain/LLMProvider"

const KEYWORDS = [
  "etapa",
  "sequência",
  "ordem",
  "quando",
  "primeiro",
  "depois",
  "cronograma",
  "processo",
  "passo a passo",
  "começo",
  "início",
  "prazo",
  "quanto tempo",
  "semanas",
  "dias",
  "meses",
]

const SUBMIT_PROCESS_PLAN_TOOL: LLMTool = {
  name: "submit_process_plan",
  description: "Submete o plano de etapas da reforma em formato estruturado",
  inputSchema: {
    type: "object",
    properties: {
      etapas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            duracaoDias: { type: "number" },
            dependeDe: { type: "array", items: { type: "string" } },
            observacoes: { type: "string" },
            critico: { type: "boolean" },
          },
          required: ["nome", "duracaoDias", "dependeDe"],
        },
      },
      duracaoTotalDias: { type: "number" },
      observacoesGerais: { type: "string" },
    },
    required: ["etapas"],
  },
}

const SYSTEM_PROMPT = `Você é um especialista em gerenciamento de reformas prediais.
Analise os serviços da reforma e gere um plano de etapas lógico e seguro.

Regras obrigatórias de sequência:
- Impermeabilização SEMPRE antes de cerâmica/acabamento (NBR 9952)
- Demolição SEMPRE antes de alvenaria nova
- Elétrica e Hidráulica ANTES de reboco e acabamentos
- Gás: vistoria COMGAS obrigatória antes de qualquer fechamento
- Estrutural: laudo técnico ANTES de qualquer demolição

Use a tool submit_process_plan para retornar o plano estruturado.
Antes de chamar a tool, explique brevemente o raciocínio da sequência proposta.
`

interface ProcessStep {
  nome: string
  duracaoDias: number
  dependeDe: string[]
  observacoes?: string
  critico?: boolean
}

interface ProcessPlanInput {
  etapas: ProcessStep[]
  duracaoTotalDias?: number
  observacoesGerais?: string
}

function formatProcessPlan(plan: ProcessPlanInput): string {
  const totalDays = plan.duracaoTotalDias
    ? `**Duração total estimada: ${plan.duracaoTotalDias} dias**`
    : ""

  const tableRows = plan.etapas
    .map((etapa, i) => {
      const deps = etapa.dependeDe.length > 0 ? etapa.dependeDe.join(", ") : "—"
      const obs = etapa.observacoes ?? ""
      const critico = etapa.critico ? " ⚠️ Crítico" : ""
      return `| ${i + 1} | ${etapa.nome} | ${etapa.duracaoDias} dias | ${deps} | ${obs}${critico} |`
    })
    .join("\n")

  const obs = plan.observacoesGerais ? `\n**Observações:** ${plan.observacoesGerais}` : ""

  return `## Sequência de Etapas

${totalDays}

| # | Etapa | Duração | Depende de | Observação |
|---|-------|---------|------------|------------|
${tableRows}${obs}`
}

export class ProcessSpecialist implements SpecialistPlugin {
  readonly id = "process"
  readonly name = "Processo"
  readonly description = "Sequência de etapas e cronograma da reforma"
  readonly icon = "list"
  readonly color = "violet"

  matchesIntent(message: string, _ctx: PluginContext): boolean {
    const lower = message.toLowerCase()
    return KEYWORDS.some((k) => lower.includes(k))
  }

  private buildMessages(ctx: PluginContext): LLMMessage[] {
    const scope = ctx.reformCase.reformScope
    const services = scope?.services?.join(", ") ?? "não informado"
    const durationDays = scope?.estimatedDurationDays
    const areas = scope?.areasAffected?.join(", ") ?? "não informado"

    const userContent = `Serviços da reforma: ${services}
Áreas afetadas: ${areas}
${durationDays ? `Duração estimada pelo morador: ${durationDays} dias` : ""}
Afeta estrutura: ${scope?.affectsStructure ? "Sim" : "Não"}
Afeta fachada: ${scope?.affectsExternalFacade ? "Sim" : "Não"}

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
    const llm = new AnthropicProvider()
    const messages = this.buildMessages(ctx)

    const result = await llm.completeWithTools(messages, {
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_PROCESS_PLAN_TOOL],
      maxTokens: 2048,
      temperature: 0.2,
    })

    let text = result.content
    let processSteps: PluginResult["metadata"]["processSteps"]

    if (result.stopReason === "tool_use" && result.toolCall?.name === "submit_process_plan") {
      const plan = result.toolCall.input as unknown as ProcessPlanInput
      const formatted = formatProcessPlan(plan)
      text = result.content ? `${result.content}\n\n${formatted}` : formatted
      processSteps = plan.etapas.map((e) => ({
        nome: e.nome,
        duracaoDias: e.duracaoDias,
        dependeDe: e.dependeDe,
        observacoes: e.observacoes,
      }))
    }

    return {
      text: text || "Não consegui gerar o plano de etapas. Tente descrever melhor os serviços.",
      metadata: {
        specialistId: this.id,
        processSteps,
      },
    }
  }

  processStream(ctx: PluginContext) {
    const llm = new AnthropicProvider()
    const messages = this.buildMessages(ctx)
    const { textChunks, completion } = llm.streamComplete(messages, {
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_PROCESS_PLAN_TOOL],
      maxTokens: 2048,
      temperature: 0.2,
    })

    const result = completion.then((r): PluginResult => {
      let text = r.content
      let processSteps: PluginResult["metadata"]["processSteps"]

      if (r.stopReason === "tool_use" && r.toolCall?.name === "submit_process_plan") {
        const plan = r.toolCall.input as unknown as ProcessPlanInput
        const formatted = formatProcessPlan(plan)
        text = r.content ? `${r.content}\n\n${formatted}` : formatted
        processSteps = plan.etapas.map((e) => ({
          nome: e.nome,
          duracaoDias: e.duracaoDias,
          dependeDe: e.dependeDe,
          observacoes: e.observacoes,
        }))
      }

      return {
        text: text || "Não consegui gerar o plano de etapas. Tente descrever melhor os serviços.",
        metadata: {
          specialistId: this.id,
          processSteps,
        },
      }
    })

    return { textChunks, result }
  }
}
