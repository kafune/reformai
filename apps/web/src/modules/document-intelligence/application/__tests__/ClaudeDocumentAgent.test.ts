import { describe, expect, it, vi } from "vitest"
import type { LLMProvider } from "../../domain/LLMProvider"
import { ClaudeAnalysisAgent } from "../ClaudeAnalysisAgent"
import { ClaudeDocumentAgent } from "../ClaudeDocumentAgent"

function makeLLM(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
    stream: vi.fn(),
    completeWithTools: vi.fn(),
    streamComplete: vi.fn(),
  }
}

describe("ClaudeDocumentAgent", () => {
  it("parseia corretamente uma resposta válida do LLM", async () => {
    const llmResponse = `<extraction>{"documentType":"ART_RRT","extractedFields":{"art":"123","crea":"X"},"confidence":0.9,"warnings":[]}</extraction>`
    const agent = new ClaudeDocumentAgent(makeLLM(llmResponse))

    const result = await agent.extract("texto qualquer", "ART_RRT")

    expect(result.documentType).toBe("ART_RRT")
    expect(result.extractedFields).toEqual({ art: "123", crea: "X" })
    expect(result.confidence).toBe(0.9)
    expect(result.warnings).toEqual([])
  })

  it("retorna confidence=0 com warnings quando a resposta não tem tags", async () => {
    const agent = new ClaudeDocumentAgent(makeLLM("isso aqui não é JSON, nem tem tags"))

    const result = await agent.extract("texto qualquer", "MEMORIAL")

    expect(result.documentType).toBe("MEMORIAL")
    expect(result.confidence).toBe(0)
    expect(result.extractedFields).toEqual({})
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("retorna confidence=0 com warnings quando o JSON é inválido", async () => {
    const llmResponse = `<extraction>{ nao eh json valido }</extraction>`
    const agent = new ClaudeDocumentAgent(makeLLM(llmResponse))

    const result = await agent.extract("texto qualquer", "AUTHORIZATION")

    expect(result.confidence).toBe(0)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/JSON inválido/i)
  })

  it("retorna confidence=0 com warnings quando o JSON tem shape inválido (confidence > 1)", async () => {
    const llmResponse = `<extraction>{"documentType":"ART_RRT","extractedFields":{},"confidence":1.5,"warnings":[]}</extraction>`
    const agent = new ClaudeDocumentAgent(makeLLM(llmResponse))

    const result = await agent.extract("texto qualquer", "ART_RRT")

    expect(result.confidence).toBe(0)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/Validação Zod/i)
  })

  it("retorna confidence=0 com warnings quando falta campo no JSON", async () => {
    const llmResponse = `<extraction>{"documentType":"ART_RRT","extractedFields":{}}</extraction>`
    const agent = new ClaudeDocumentAgent(makeLLM(llmResponse))

    const result = await agent.extract("texto qualquer", "ART_RRT")

    expect(result.confidence).toBe(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("usa system prompt específico para ART_RRT", async () => {
    const llmResponse = `<extraction>{"documentType":"ART_RRT","extractedFields":{},"confidence":0.5,"warnings":[]}</extraction>`
    const llm = makeLLM(llmResponse)
    const agent = new ClaudeDocumentAgent(llm)

    await agent.extract("texto", "ART_RRT")

    const completeMock = llm.complete as ReturnType<typeof vi.fn>
    const [, options] = completeMock.mock.calls[0] as [unknown, { system: string }]
    expect(options.system).toContain("número da ART")
    expect(options.system).toContain("CREA")
  })

  it("usa system prompt específico para MEMORIAL", async () => {
    const llmResponse = `<extraction>{"documentType":"MEMORIAL","extractedFields":{},"confidence":0.5,"warnings":[]}</extraction>`
    const llm = makeLLM(llmResponse)
    const agent = new ClaudeDocumentAgent(llm)

    await agent.extract("texto", "MEMORIAL")

    const completeMock = llm.complete as ReturnType<typeof vi.fn>
    const [, options] = completeMock.mock.calls[0] as [unknown, { system: string }]
    expect(options.system).toContain("materiais")
    expect(options.system).toContain("serviços")
  })
})

describe("ClaudeAnalysisAgent", () => {
  it("detecta inconsistência entre ART e MEMORIAL com nomes diferentes", async () => {
    const llmResponse = `{
      "consistent": false,
      "inconsistencies": [
        {
          "field": "responsavel",
          "documentA": "ART_RRT",
          "documentB": "MEMORIAL",
          "description": "Nome do responsável técnico difere entre ART e memorial",
          "severity": "high"
        }
      ],
      "pendencies": ["Esclarecer divergência de nome do responsável técnico"],
      "recommendation": "request_corrections",
      "reasoning": "O nome listado na ART não corresponde ao do memorial."
    }`
    const agent = new ClaudeAnalysisAgent(makeLLM(llmResponse))

    const result = await agent.analyze([
      { type: "ART_RRT", extractedData: { responsavel: "João Silva", art: "123" } },
      { type: "MEMORIAL", extractedData: { responsavel: "Maria Souza", materiais: [] } },
    ])

    expect(result.consistent).toBe(false)
    expect(result.inconsistencies.length).toBeGreaterThan(0)
    expect(result.inconsistencies[0]!.severity).toBe("high")
    expect(result.recommendation).toBe("request_corrections")
    expect(result.degraded).toBeUndefined()
  })

  it("system prompt foca impacto predial e proíbe auditoria de materiais/comercial", async () => {
    const llmResponse = `{"consistent":true,"inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":"ok"}`
    const llm = makeLLM(llmResponse)
    const agent = new ClaudeAnalysisAgent(llm)

    await agent.analyze([])

    const completeMock = llm.complete as ReturnType<typeof vi.fn>
    const [, options] = completeMock.mock.calls[0] as [unknown, { system: string }]
    expect(options.system).toContain("áreas comuns")
    expect(options.system).toContain("prumadas")
    expect(options.system).toContain("impermeabilização")
    expect(options.system).toMatch(/NÃO avalie/i)
    expect(options.system).toContain("marcas")
  })

  it("inclui o escopo declarado na triagem no prompt quando fornecido", async () => {
    const llmResponse = `{"consistent":true,"inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":"ok"}`
    const llm = makeLLM(llmResponse)
    const agent = new ClaudeAnalysisAgent(llm)

    await agent.analyze(
      [{ type: "MEMORIAL", extractedData: { servicos: ["Troca de piso"] } }],
      {
        reformScope: { services: ["Troca de piso com demolição"], affectsCommonAreas: false },
        riskLevel: "MEDIUM",
      },
    )

    const completeMock = llm.complete as ReturnType<typeof vi.fn>
    const [messages] = completeMock.mock.calls[0] as [Array<{ content: string }>]
    expect(messages[0]!.content).toContain("Escopo declarado pelo morador")
    expect(messages[0]!.content).toContain("Troca de piso com demolição")
    expect(messages[0]!.content).toContain("MEDIUM")
  })

  it("envia o JSON Schema de structured outputs na chamada ao LLM", async () => {
    const llmResponse = `{"consistent":true,"inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":"ok"}`
    const llm = makeLLM(llmResponse)
    const agent = new ClaudeAnalysisAgent(llm)

    await agent.analyze([])

    const completeMock = llm.complete as ReturnType<typeof vi.fn>
    const [, options] = completeMock.mock.calls[0] as [
      unknown,
      { outputJsonSchema?: Record<string, unknown>; maxTokens: number },
    ]
    expect(options.outputJsonSchema).toMatchObject({ type: "object" })
    expect(options.maxTokens).toBeGreaterThanOrEqual(8000)
  })

  it("tolera JSON cercado por preâmbulo/markdown (provider sem structured outputs)", async () => {
    const llmResponse =
      'Segue a análise:\n```json\n{"consistent":true,"inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":"ok"}\n```'
    const agent = new ClaudeAnalysisAgent(makeLLM(llmResponse))

    const result = await agent.analyze([])

    expect(result.recommendation).toBe("approve")
    expect(result.degraded).toBeUndefined()
  })

  it("degrada com degraded=true quando a resposta do LLM falha na validação Zod", async () => {
    const llmResponse = `{"consistent":"not-a-boolean","inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":""}`
    const agent = new ClaudeAnalysisAgent(makeLLM(llmResponse))

    const result = await agent.analyze([])

    expect(result.consistent).toBe(false)
    expect(result.recommendation).toBe("request_corrections")
    expect(result.pendencies.length).toBeGreaterThan(0)
    expect(result.degraded).toBe(true)
  })

  it("degrada com degraded=true quando a resposta não contém JSON", async () => {
    const agent = new ClaudeAnalysisAgent(makeLLM("resposta sem json nenhum"))

    const result = await agent.analyze([])

    expect(result.consistent).toBe(false)
    expect(result.recommendation).toBe("request_corrections")
    expect(result.degraded).toBe(true)
  })

  it("degrada com degraded=true quando a chamada ao LLM lança erro", async () => {
    const llm = makeLLM("")
    ;(llm.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rate limit"))
    const agent = new ClaudeAnalysisAgent(llm)

    const result = await agent.analyze([])

    expect(result.degraded).toBe(true)
    expect(result.reasoning).toMatch(/Falha na chamada ao LLM/)
  })
})
