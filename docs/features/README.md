# Roadmap de Features — ReformAI

> Gerado em 2026-05-25. Baseado na análise do `APP-STATE.md` e `CLAUDE.md`.
> Cada feature tem seu próprio arquivo com detalhamento completo de contexto,
> design técnico, critérios de aceite e estimativa de esforço.

---

## Visão Geral

O MVP está funcional de ponta a ponta. Este roadmap organiza o que vem a seguir
em três grupos:

| Grupo | Descrição |
|-------|-----------|
| **A — Backlog técnico** | Itens já identificados no APP-STATE §19-20: limpezas, correções e cobertura de testes |
| **B — Estrutura incompleta** | Código/schema já existe, mas UI ou fluxo não está completo |
| **C — Features novas** | Funcionalidades não planejadas anteriormente, ordenadas por impacto |

---

## Índice de Features

### Grupo A — Backlog Técnico (limpeza e estabilidade)

| Arquivo | Feature | Severidade |
|---------|---------|-----------|
| [A1-remover-register-orphan.md](./A1-remover-register-orphan.md) | Remover pages `/register/*` órfãs | Média |
| [A2-price-calculator-risklevel.md](./A2-price-calculator-risklevel.md) | `PriceCalculator` considerar `riskLevel` no preço | Baixa |
| [A3-testes-deterministic-evaluator.md](./A3-testes-deterministic-evaluator.md) | Ampliar testes do `DeterministicEvaluator` | Baixa |
| [A4-testes-norm-search.md](./A4-testes-norm-search.md) | Testes para `NormSearchService` | Baixa |
| [A5-vapid-dev.md](./A5-vapid-dev.md) | VAPID keys no `docker-compose.yml` | Informativa |
| [A6-limpar-repos-mortos.md](./A6-limpar-repos-mortos.md) | Limpar métodos de repositório mortos | Baixa |

### Grupo B — Estrutura Incompleta (completar o que foi iniciado)

| Arquivo | Feature | O que falta |
|---------|---------|------------|
| [B1-rating-parceiro.md](./B1-rating-parceiro.md) | Rating do parceiro pelo morador | Formulário pós-obra + cálculo de média |
| [B2-aprovacao-sindico.md](./B2-aprovacao-sindico.md) | Aprovação explícita pelo síndico | Botão "Aprovar" + estado intermediário |
| [B3-sla-dashboard.md](./B3-sla-dashboard.md) | SLA tracking com alertas | Job cron + UI de casos parados |

### Grupo C — Features Novas

#### 🔴 Alto impacto, baixo esforço

| Arquivo | Feature |
|---------|---------|
| [C1-busca-casos.md](./C1-busca-casos.md) | Busca full-text de casos |
| [C2-email-status-changes.md](./C2-email-status-changes.md) | E-mail automático nas mudanças de status |
| [C3-preview-documentos.md](./C3-preview-documentos.md) | Preview inline de documentos PDF/imagem |
| [C4-painel-pendencias.md](./C4-painel-pendencias.md) | Painel de pendências por perfil de usuário |

#### 🟡 Alto impacto, esforço médio

| Arquivo | Feature |
|---------|---------|
| [C5-historico-unidade.md](./C5-historico-unidade.md) | Histórico de obras por unidade |
| [C6-export-csv.md](./C6-export-csv.md) | Export CSV/Excel de casos |
| [C7-relatorio-mensal.md](./C7-relatorio-mensal.md) | Relatório mensal automático para síndico |
| [C8-alertas-sla.md](./C8-alertas-sla.md) | Alertas automáticos de casos parados |
| [C9-kanban-casos.md](./C9-kanban-casos.md) | Kanban view de casos no painel admin |

#### 🟢 Estratégico, esforço maior

| Arquivo | Feature |
|---------|---------|
| [C10-whatsapp.md](./C10-whatsapp.md) | Notificações via WhatsApp |
| [C11-assinatura-digital.md](./C11-assinatura-digital.md) | Assinatura digital de documentos |
| [C12-chat-sindico-morador.md](./C12-chat-sindico-morador.md) | Chat síndico ↔ morador dentro do caso |
| [C13-webhooks.md](./C13-webhooks.md) | Webhooks para administradoras externas |
| [C14-precificacao-dinamica.md](./C14-precificacao-dinamica.md) | Precificação dinâmica por parceiro |

---

## Ordem de Implementação Sugerida

```
Sprint 1 (solidificar MVP)
  A1  Remover pages /register órfãs
  B1  Rating do parceiro (formulário + cálculo)
  C1  Busca de casos
  C2  E-mail em status changes

Sprint 2 (experiência do usuário)
  B2  Aprovação pelo síndico
  C3  Preview inline de documentos
  C4  Painel de pendências

Sprint 3 (dados e compliance)
  C5  Histórico por unidade
  C6  Export CSV/Excel
  B3  SLA dashboard básico

Sprint 4 (automação)
  C7  Relatório mensal automático
  C8  Alertas de SLA por job
  C9  Kanban de casos

Mês 2+ (features estratégicas)
  C10 WhatsApp
  C11 Assinatura digital
  C12 Chat síndico/morador
  C13 Webhooks para administradoras
  C14 Precificação dinâmica
  A2  PriceCalculator com riskLevel
  A3-A6 Cobertura de testes e limpeza
```

---

## Convenções deste diretório

Cada arquivo segue a estrutura:

1. **Contexto** — motivação e situação atual
2. **User stories** — quem quer o quê e por quê
3. **Design técnico** — arquivos a criar/alterar, modelo de dados, fluxo
4. **Critérios de aceite** — o que define "pronto"
5. **Dependências** — o que precisa existir antes
6. **Estimativa** — pontos de complexidade / dias
