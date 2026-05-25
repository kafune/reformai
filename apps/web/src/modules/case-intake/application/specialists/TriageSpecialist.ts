import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { TriageAgent } from "../TriageAgent"
import type {
  SpecialistPlugin,
  PluginContext,
  PluginResult,
} from "../../domain/specialists/SpecialistPlugin"

export class TriageSpecialist implements SpecialistPlugin {
  readonly id = "triage"
  readonly name = "Triagem"
  readonly description = "Condutor da triagem técnica da reforma"
  readonly icon = "chat"
  readonly color = "green"

  private agent(): TriageAgent {
    return new TriageAgent(new AnthropicProvider())
  }

  matchesIntent(_message: string, _ctx: PluginContext): boolean {
    // É o fallback — nunca auto-detecta; retorna false para dar chance aos outros
    return false
  }

  async process(ctx: PluginContext): Promise<PluginResult> {
    const { response } = await this.agent().process(ctx.history, ctx.message)
    return { text: response, metadata: { specialistId: this.id } }
  }

  processStream(ctx: PluginContext) {
    const { textChunks, completion } = this.agent().processStream(ctx.history, ctx.message)
    const result = completion.then(
      (r): PluginResult => ({
        text: r.content,
        metadata: { specialistId: this.id },
      }),
    )
    return { textChunks, result }
  }
}
