import { describe, expect, it } from "vitest"
import { markdownToPdf } from "../markdownToPdf"

const SAMPLE = `# Relatório de Análise

## Resumo

Protocolo: **PROT-001**. Risco: **alto**.

- Elétrica
- Hidráulica

---

Este documento tem caráter meramente informativo.
`

describe("markdownToPdf", () => {
  it("gera um buffer PDF válido", async () => {
    const buf = await markdownToPdf(SAMPLE)
    expect(Buffer.isBuffer(buf)).toBe(true)
    // Assinatura de arquivo PDF
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
    // Conteúdo não-trivial
    expect(buf.length).toBeGreaterThan(500)
  })

  it("lida com markdown vazio sem lançar", async () => {
    const buf = await markdownToPdf("")
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-")
  })
})
