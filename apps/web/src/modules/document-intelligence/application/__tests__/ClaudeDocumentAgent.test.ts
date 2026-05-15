import { describe, expect, it, vi } from "vitest"
import { ValidationError } from "@/shared/errors/DomainError"
import type { LLMProvider } from "../../domain/LLMProvider"
import { ClaudeAnalysisAgent } from "../ClaudeAnalysisAgent"
import { ClaudeDocumentAgent } from "../ClaudeDocumentAgent"

function makeLLM(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
    stream: vi.fn(),
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
    const llmResponse = `<analysis>{
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
    }</analysis>`
    const agent = new ClaudeAnalysisAgent(makeLLM(llmResponse))

    const result = await agent.analyze([
      { type: "ART_RRT", extractedData: { responsavel: "João Silva", art: "123" } },
      { type: "MEMORIAL", extractedData: { responsavel: "Maria Souza", materiais: [] } },
    ])

    expect(result.consistent).toBe(false)
    expect(result.inconsistencies.length).toBeGreaterThan(0)
    expect(result.inconsistencies[0]!.severity).toBe("high")
    expect(result.recommendation).toBe("request_corrections")
  })

  it("lança ValidationError quando a resposta do LLM falha na validação Zod", async () => {
    const llmResponse = `<analysis>{"consistent":"not-a-boolean","inconsistencies":[],"pendencies":[],"recommendation":"approve","reasoning":""}</analysis>`
    const agent = new ClaudeAnalysisAgent(makeLLM(llmResponse))

    await expect(agent.analyze([])).rejects.toBeInstanceOf(ValidationError)
  })

  it("lança ValidationError quando não há tags <analysis> na resposta", async () => {
    const agent = new ClaudeAnalysisAgent(makeLLM("resposta sem tags"))

    await expect(agent.analyze([])).rejects.toBeInstanceOf(ValidationError)
  })
})
