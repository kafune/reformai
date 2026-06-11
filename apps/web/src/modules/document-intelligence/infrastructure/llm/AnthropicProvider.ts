import Anthropic from "@anthropic-ai/sdk"
import type {
  CompletionOptions,
  CompletionResult,
  DocumentInput,
  LLMMessage,
  LLMProvider,
  LLMTool,
  StreamCompleteResult,
} from "../../domain/LLMProvider"

// Default geral da plataforma. Pode ser sobrescrito globalmente via
// ANTHROPIC_MODEL ou por chamada via CompletionOptions.model (os agentes de
// documento usam ANTHROPIC_MODEL_EXTRACTION / ANTHROPIC_MODEL_ANALYSIS).
const DEFAULT_MODEL = "claude-sonnet-4-6"

function resolveDefaultModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL
}

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
  private readonly model: string

  constructor(apiKey = process.env.ANTHROPIC_API_KEY, model?: string) {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada")
    this.client = new Anthropic({ apiKey })
    this.model = model?.trim() || resolveDefaultModel()
  }

  async complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string> {
    const res = await this.client.messages.create({
      model: options?.model ?? this.model,
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
      model: options?.model ?? this.model,
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
      model: options?.model ?? this.model,
      max_tokens: options?.maxTokens ?? 2048,
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options?.system ? { system: options.system } : {}),
      ...(options?.tools?.length ? { tools: toAnthropicTools(options.tools) } : {}),
      messages,
    })
    return processMessage(res)
  }

  /**
   * Transcreve o texto de um PDF (incl. escaneado) ou imagem via leitura
   * nativa do modelo — usado como fallback quando o OCR local volta vazio.
   */
  async readDocumentText(
    document: DocumentInput,
    options?: CompletionOptions,
  ): Promise<string> {
    const base64 = document.data.toString("base64")
    const contentBlock: Anthropic.Beta.BetaContentBlockParam =
      document.mimeType === "application/pdf"
        ? {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          }
        : {
            type: "image",
            source: {
              type: "base64",
              media_type: document.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          }

    const res = await this.client.beta.messages.create({
      model: options?.model ?? this.model,
      max_tokens: options?.maxTokens ?? 4000,
      temperature: 0,
      betas: ["pdfs-2024-09-25"],
      system:
        "Você é um transcritor de documentos. Transcreva fielmente todo o texto " +
        "legível do documento, preservando a ordem de leitura. Não resuma, não " +
        "comente e não invente conteúdo. Se algo estiver ilegível, marque [ilegível].",
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            { type: "text", text: "Transcreva o texto deste documento." },
          ],
        },
      ],
    })

    return res.content
      .filter((c): c is Anthropic.Beta.BetaTextBlock => c.type === "text")
      .map((c) => c.text)
      .join("\n")
  }

  streamComplete(messages: LLMMessage[], options?: CompletionOptions): StreamCompleteResult {
    const stream = this.client.messages.stream({
      model: options?.model ?? this.model,
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
