export interface LLMMessage {
  role: "user" | "assistant"
  content: string
}

export interface CompletionOptions {
  system?: string
  maxTokens?: number
  temperature?: number
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: CompletionOptions): Promise<string>
  stream(messages: LLMMessage[], options?: CompletionOptions): AsyncIterable<string>
}
