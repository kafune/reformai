# M3-W0 — Templates e Engine de Relatórios

**Tipo:** Sessão única  
**Pré-requisito:** M2-W3 mergeada em `main`  
**Duração estimada:** 30–45 min  

> Esta wave define os templates e o motor de renderização que o ReportAgent
> (M3-W1) vai consumir.

---

## PROMPT PARA O CLAUDE CODE

```
Implemente os templates de documentos e o motor de renderização do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- packages/templates/engine.ts
- packages/templates/relatorio-analise.md
- packages/templates/memorial-descritivo.md
- packages/templates/cronograma-basico.md
- packages/templates/parecer-pendencias.md
- packages/templates/proposta-comercial.md
- packages/templates/ordem-servico.md
- packages/templates/index.ts
- packages/templates/__tests__/engine.test.ts

──────────────────────────────────────────────────────
1. packages/templates/engine.ts
──────────────────────────────────────────────────────
Motor de renderização de templates.

Lê arquivos .md da pasta packages/templates/ e substitui variáveis no formato {{variavel}}.

export interface TemplateVariables {
  [key: string]: string | number | boolean | undefined
}

export type TemplateId =
  | 'relatorio-analise'
  | 'memorial-descritivo'
  | 'cronograma-basico'
  | 'parecer-pendencias'
  | 'proposta-comercial'
  | 'ordem-servico'

export function renderTemplate(templateId: TemplateId, variables: TemplateVariables): string

- Lê o arquivo .md correspondente
- Substitui todas as ocorrências de {{nome_da_variavel}} pelos valores fornecidos
- Variáveis ausentes devem resultar em '[CAMPO NÃO PREENCHIDO]' (nunca string vazia)
- O disclaimer obrigatório (veja abaixo) é SEMPRE injetado no final de todo relatório,
  independente do template. Nunca pode ser omitido.
- Retorna o Markdown renderizado como string

DISCLAIMER OBRIGATÓRIO (injete no final de todos os templates):

---
*Este documento foi gerado com auxílio de inteligência artificial pela plataforma
ReformAI e tem caráter meramente informativo e auxiliar. Não substitui laudo técnico,
ART/RRT ou qualquer documento oficial emitido por profissional habilitado. A
responsabilidade técnica pela obra é exclusiva do profissional responsável devidamente
registrado no CREA/CAU.*

──────────────────────────────────────────────────────
2. Templates Markdown
──────────────────────────────────────────────────────
Crie cada template com seções realistas para o domínio de reformas prediais.
Use variáveis {{nome_da_variavel}} para todos os dados dinâmicos.

relatorio-analise.md — Relatório de Análise Técnica
  Variáveis: protocolo, data_analise, condominio, unidade, servicos,
             risco, score_triagem, requer_art, regras_ativadas,
             pendencias, recomendacao, nome_responsavel

memorial-descritivo.md — Memorial Descritivo da Reforma
  Variáveis: protocolo, data, condominio, unidade, proprietario,
             descricao_obra, servicos, materiais, area_afetada,
             prazo_execucao, responsavel_tecnico

cronograma-basico.md — Cronograma de Execução
  Variáveis: protocolo, data, condominio, unidade,
             data_inicio_prevista, duracao_dias, etapas,
             responsavel_execucao

parecer-pendencias.md — Parecer de Pendências Documentais
  Variáveis: protocolo, data, condominio, unidade,
             documentos_validos, documentos_pendentes,
             inconsistencias, prazo_correcao, instrucoes

proposta-comercial.md — Proposta Comercial
  Variáveis: protocolo, data, condominio, unidade, proprietario,
             plano, valor_base, vistorias_inclusas, valor_vistoria_extra,
             servicos_inclusos, validade_proposta, forma_pagamento

ordem-servico.md — Ordem de Serviço
  Variáveis: protocolo, data, condominio, unidade, proprietario,
             parceiro, crea_parceiro, servicos_autorizados,
             data_inicio, restricoes_horario, contato_sindico

──────────────────────────────────────────────────────
3. packages/templates/index.ts
──────────────────────────────────────────────────────
Re-exporta engine e tipos:
  export { renderTemplate, TemplateId, TemplateVariables } from './engine'

──────────────────────────────────────────────────────
4. Testes
──────────────────────────────────────────────────────
engine.test.ts:
  - Renderiza relatorio-analise com variáveis válidas e verifica substituição
  - Variável ausente resulta em '[CAMPO NÃO PREENCHIDO]'
  - Disclaimer está sempre presente no output
  - Template inválido lança erro claro

REGRAS:
  - Não use nenhuma biblioteca de template (handlebars, mustache, etc.)
    A substituição é simples — implemente com regex
  - Os templates devem ser profissionais e adequados para apresentação ao condômino
  - Português brasileiro correto

Runtime: bun. Rode `bun run test` ao final.
```

---

## Arquivos gerados por esta wave

```
packages/templates/
  engine.ts
  index.ts
  relatorio-analise.md
  memorial-descritivo.md
  cronograma-basico.md
  parecer-pendencias.md
  proposta-comercial.md
  ordem-servico.md
  __tests__/engine.test.ts
```

## Checklist antes de mergear

- [ ] `bun run test` passa
- [ ] Disclaimer presente em todos os templates renderizados
- [ ] Variáveis ausentes → `[CAMPO NÃO PREENCHIDO]` (nunca vazio)
- [ ] Conteúdo dos templates é profissional e em português correto
