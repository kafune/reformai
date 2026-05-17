import Anthropic from "@anthropic-ai/sdk"
import type {
  CompletionOptions,
  CompletionResult,
  LLMMessage,
  LLMProvider,
  LLMTool,
  StreamCompleteResult,
} from "../../domain/LLMProvider"

const MODEL = "claude-sonnet-4-20250514"

function toAnthropicTools(tools: LLMTool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
  }))
}

function processMessage(msg: Anthropic.Message): CompletionResult {
  let content = ""
  let toolCall: CompletionResult["toolCall"]

  for (const block of msg.content) {
    if (block.type === "text") content += block.text
    if (block.type === "tool_use") {
      toolCall = { name: block.name, input: block.input as Record<string, unknown> }
    }
  }

  const stopReason: CompletionResult["stopReason"] =
    msg.stop_reason === "tool_use"
      ? "tool_use"
      : msg.stop_reason === "max_tokens"
        ? "max_tokens"
        : "end_turn"

  return { content, toolCall, stopReason }
}

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

  async completeWithTools(
    messages: LLMMessage[],
    options?: CompletionOptions,
  ): Promise<CompletionResult> {
    const res = await this.client.messages.create({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.system ? { system: options.system } : {}),
      ...(options?.tools?.length ? { tools: toAnthropicTools(options.tools) } : {}),
      messages,
    })
    return processMessage(res)
  }

  streamComplete(messages: LLMMessage[], options?: CompletionOptions): StreamCompleteResult {
    const stream = this.client.messages.stream({
      model: MODEL,
      max_tokens: options?.maxTokens ?? 2048,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.system ? { system: options.system } : {}),
      ...(options?.tools?.length ? { tools: toAnthropicTools(options.tools) } : {}),
      messages,
    })

    const textChunks = (async function* () {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text
        }
      }
    })()

    const completion = stream.finalMessage().then(processMessage)

    return { textChunks, completion }
  }
}
