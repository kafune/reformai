export interface LLMMessage {
  role: "user" | "assistant"
  content: string
}

export interface LLMTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface CompletionOptions {
  system?: string
  maxTokens?: number
  temperature?: number
  tools?: LLMTool[]
  /** Identificador do modelo a usar nesta chamada. Sem valor, usa o default do provider. */
  model?: string
  /**
   * JSON Schema para saída estruturada — quando presente, o provider instrui a
   * API a responder somente com JSON válido nesse shape (structured outputs).
   */
  outputJsonSchema?: Record<string, unknown>
}

export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface CompletionResult {
  content: string
  toolCall?: ToolCall
  stopReason: "end_turn" | "tool_use" | "max_tokens"
}

export interface StreamCompleteResult {
  textChunks: AsyncIterable<string>
  completion: Promise<CompletionResult>
}

export interface DocumentInput {
  data: Buffer
  mimeType: string
}

export interface LLMProvider {
  /** Conclusão simples — retorna apenas o texto agregado. */
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>
  /** Streaming simples — emite apenas chunks de texto. */
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>
  /** Conclusão com suporte a tool-use — retorna texto, toolCall e stopReason. */
  completeWithTools(messages: LLMMessage[], options?: CompletionOptions): Promise<CompletionResult>
  /** Streaming com tool-use — chunks de texto + promessa do resultado final estruturado. */
  streamComplete(messages: LLMMessage[], options?: CompletionOptions): StreamCompleteResult
  /**
   * Transcreve o texto de um documento binário (ex.: PDF escaneado) via leitura
   * nativa do modelo. Opcional — providers sem suporte podem omitir.
   */
  readDocumentText?(document: DocumentInput, options?: CompletionOptions): Promise<string>
}
