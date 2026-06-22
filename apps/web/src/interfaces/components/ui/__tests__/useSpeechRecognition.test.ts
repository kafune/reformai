import { describe, expect, it } from "vitest"
import { appendTranscript } from "../useSpeechRecognition"

describe("appendTranscript", () => {
  it("retorna o transcript quando o input está vazio", () => {
    expect(appendTranscript("", "trocar o piso da sala")).toBe("trocar o piso da sala")
  })

  it("mantém o texto base quando o transcript é vazio ou só espaços", () => {
    expect(appendTranscript("quero pintar", "")).toBe("quero pintar")
    expect(appendTranscript("quero pintar", "   ")).toBe("quero pintar")
  })

  it("insere espaço entre o texto base e o transcript", () => {
    expect(appendTranscript("quero pintar", "a sala")).toBe("quero pintar a sala")
  })

  it("não duplica espaço quando o base termina em espaço", () => {
    expect(appendTranscript("quero pintar ", "a sala")).toBe("quero pintar a sala")
  })

  it("remove espaços nas bordas do transcript", () => {
    expect(appendTranscript("quero", "  pintar a sala  ")).toBe("quero pintar a sala")
  })
})
