import { describe, expect, it, vi } from "vitest"
import type {
  CompletionResult,
  LLMProvider,
  StreamCompleteResult,
} from "@/modules/document-intelligence/domain/LLMProvider"
import { TriageAgent } from "../TriageAgent"

function makeLLM(result: CompletionResult): LLMProvider {
  return {
    complete: vi.fn(),
    stream: vi.fn(),
    completeWithTools: vi.fn().mockResolvedValue(result),
    streamComplete: vi.fn((): StreamCompleteResult => ({
      textChunks: (async function* () {
        yield result.content
      })(),
      completion: Promise.resolve(result),
    })),
  }
}

describe("TriageAgent", () => {
  it("extrai o escopo quando o modelo chama a tool submit_scope", async () => {
    const agent = new TriageAgent(
      makeLLM({
        content: "",
        stopReason: "tool_use",
        toolCall: { name: "submit_scope", input: { services: ["Pintura simples", "Elétrica"] } },
      }),
    )

    const result = await agent.process([], "Quero pintar e mexer na fiação")

    expect(result.scopeComplete).toBe(true)
    expect(result.scope?.services).toEqual(["Pintura simples", "Elétrica"])
    expect(result.response).toContain("Pintura simples")
  })

  it("não extrai escopo em conclusão conversacional (end_turn)", async () => {
    const agent = new TriageAgent(
      makeLLM({ content: "Quais cômodos serão afetados?", stopReason: "end_turn" }),
    )

    const result = await agent.process([], "Vou reformar meu apartamento")

    expect(result.scopeComplete).toBe(false)
    expect(result.scope).toBeUndefined()
    expect(result.response).toBe("Quais cômodos serão afetados?")
  })

  it("ignora tool call com input inválido (sem services)", async () => {
    const agent = new TriageAgent(
      makeLLM({
        content: "",
        stopReason: "tool_use",
        toolCall: { name: "submit_scope", input: { services: [] } },
      }),
    )

    const result = await agent.process([], "não sei o que quero")

    expect(result.scopeComplete).toBe(false)
    expect(result.scope).toBeUndefined()
  })

  it("processStream resolve o escopo a partir da promessa de completion", async () => {
    const agent = new TriageAgent(
      makeLLM({
        content: "ok",
        stopReason: "tool_use",
        toolCall: { name: "submit_scope", input: { services: ["Hidráulica"] } },
      }),
    )

    const { scopePromise } = agent.processStream([], "trocar encanamento")
    const scope = await scopePromise

    expect(scope?.services).toEqual(["Hidráulica"])
  })
})
