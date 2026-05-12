import Anthropic from "@anthropic-ai/sdk"
import type { CompletionOptions, LLMMessage, LLMProvider } from "../../domain/LLMProvider"

const MODEL = "claude-sonnet-4-20250514"

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic

  constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada")
    this.client = new Anthropic({ apiKey })
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const res = await this.client.messages.create({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
      system: options?.system,
      messages,
    })
    const parts = res.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
    return parts.join("\n")
  }

  async *stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
      system: options?.system,
      messages,
    })
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text
      }
    }
  }
}
