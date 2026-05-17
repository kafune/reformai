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

export interface LLMProvider {
  /** Conclusão simples — retorna apenas o texto agregado. */
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>
  /** Streaming simples — emite apenas chunks de texto. */
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>
  /** Conclusão com suporte a tool-use — retorna texto, toolCall e stopReason. */
  completeWithTools(messages: LLMMessage[], options?: CompletionOptions): Promise<CompletionResult>
  /** Streaming com tool-use — chunks de texto + promessa do resultado final estruturado. */
  streamComplete(messages: LLMMessage[], options?: CompletionOptions): StreamCompleteResult
}
