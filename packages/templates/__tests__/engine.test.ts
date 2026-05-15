import { describe, it, expect } from "vitest"
import { renderTemplate, type TemplateId } from "../engine"

const ALL_TEMPLATES: TemplateId[] = [
  "relatorio-analise",
  "memorial-descritivo",
  "cronograma-basico",
  "parecer-pendencias",
  "proposta-comercial",
  "ordem-servico",
]

const UNRENDERED_PLACEHOLDER = /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\}\}/
const DISCLAIMER_FRAGMENT = /responsabilidade técnica pela obra é exclusiva/
const DISCLAIMER_CREA = /CREA\/CAU/
const MISSING = "[CAMPO NÃO PREENCHIDO]"

describe("renderTemplate", () => {
  it("substitui variáveis de relatorio-analise pelos valores fornecidos", () => {
    const out = renderTemplate("relatorio-analise", {
      protocolo: "ART-2026-0001",
      data_analise: "15/05/2026",
      condominio: "Edifício Solar das Acácias",
      unidade: "Apto 302 — Bloco B",
      servicos: "- Pintura interna\n- Substituição de revestimento cerâmico",
      risco: "LOW",
      score_triagem: 12,
      requer_art: false,
      regras_ativadas: "- Pintura simples\n- Troca de piso sem demolição",
      pendencias: "Nenhuma pendência identificada.",
      recomendacao: "Liberar com condições padrão de horário de obra.",
      nome_responsavel: "Eng. Maria Silva (CREA 12345/SP)",
    })

    expect(out).toContain("ART-2026-0001")
    expect(out).toContain("Edifício Solar das Acácias")
    expect(out).toContain("Apto 302 — Bloco B")
    expect(out).toContain("Eng. Maria Silva (CREA 12345/SP)")
    expect(out).toContain("12")
    expect(out).not.toMatch(UNRENDERED_PLACEHOLDER)
  })

  it("preenche variáveis ausentes com [CAMPO NÃO PREENCHIDO]", () => {
    const out = renderTemplate("relatorio-analise", {
      protocolo: "ART-2026-0002",
    })
    expect(out).toContain("ART-2026-0002")
    expect(out).toContain(MISSING)
    expect(out).not.toMatch(UNRENDERED_PLACEHOLDER)
  })

  it("trata string vazia como ausente", () => {
    const out = renderTemplate("memorial-descritivo", {
      protocolo: "ART-2026-0003",
      descricao_obra: "",
    })
    expect(out).toContain(MISSING)
  })

  it.each(ALL_TEMPLATES)(
    "sempre injeta o disclaimer obrigatório (%s)",
    (id) => {
      const out = renderTemplate(id, {})
      expect(out).toMatch(DISCLAIMER_FRAGMENT)
      expect(out).toMatch(DISCLAIMER_CREA)
    },
  )

  it("disclaimer aparece no final do documento, depois de todo o conteúdo do template", () => {
    const out = renderTemplate("ordem-servico", {})
    const disclaimerIdx = out.search(DISCLAIMER_FRAGMENT)
    const titleIdx = out.indexOf("# Ordem de Serviço")
    expect(titleIdx).toBeGreaterThanOrEqual(0)
    expect(disclaimerIdx).toBeGreaterThan(titleIdx)
  })

  it("lança erro claro para template inválido", () => {
    expect(() =>
      renderTemplate("inexistente" as TemplateId, {}),
    ).toThrow(/inválido/i)
  })

  it("renderiza valores numéricos e booleanos como string", () => {
    const out = renderTemplate("proposta-comercial", {
      valor_base: 1500,
      vistorias_inclusas: 3,
    })
    expect(out).toContain("1500")
    expect(out).toContain("3")
  })
})
