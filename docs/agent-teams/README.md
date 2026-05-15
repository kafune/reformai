# Agent Teams — ReformAI

Guia de execução dos Milestones 2 e 3 usando Agent Teams do Claude Code.

---

## Pré-requisito: habilitar Agent Teams

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Ou adicione em `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Versão mínima do Claude Code: **v2.1.32**.

---

## Como usar os arquivos deste diretório

Cada arquivo `.md` contém um **prompt pronto** para você colar diretamente no Claude Code.  
Copie o bloco marcado como `PROMPT PARA O CLAUDE CODE` e cole no terminal do Claude Code.

---

## Sequência obrigatória (dependências entre waves)

```
MILESTONE 2 — Pipeline Documental
──────────────────────────────────
m2-w0-contracts.md          ← sessão única (define contratos)
        │ merge para main
        ▼
m2-w1-infra-domain.md       ← equipe de 3 agentes (paralelo)
        │ merge para main
        ▼
m2-w2-workers-api.md        ← equipe de 3 agentes (paralelo)
        │ merge para main
        ▼
m2-w3-ui.md                 ← sessão única

MILESTONE 3 — Relatórios, Comercial e Parceiros
─────────────────────────────────────────────────
m3-w0-templates.md          ← sessão única (define templates)
        │ merge para main
        ▼
m3-w1-business.md           ← equipe de 3 agentes (paralelo)
        │ merge para main
        ▼
m3-w2-admin.md              ← equipe de 2 agentes (paralelo)
        │ merge para main
        ▼
m3-w3-final.md              ← equipe de 2 agentes (paralelo)
```

---

## Regras que todos os agentes devem seguir

O CLAUDE.md do projeto já é lido automaticamente por cada teammate.  
Os prompts abaixo reforçam os pontos mais críticos, mas o CLAUDE.md é a fonte de verdade.

1. **Runtime: Bun 1.3.6.** Nunca `npm`, `npx` ou `yarn`.
2. **Regra de negócio fica em `domain/`.** Nunca em route handler ou componente.
3. **Toda query ao banco filtra por `tenantId`.** Sem exceção.
4. **Toda saída da IA é validada por Zod antes de ser usada.**
5. **`LLMProvider` é interface.** Nunca importe `@anthropic-ai/sdk` fora de `AnthropicProvider.ts`.
6. **Nenhum módulo importa internals de outro módulo.**
7. **Cada agente só toca nos arquivos do seu escopo declarado.**

---

## Checklist de merge entre waves

Antes de iniciar a próxima wave:

- [ ] Todos os agentes da wave anterior terminaram
- [ ] Nenhum arquivo com conflito de merge
- [ ] `bun run build` passa sem erros
- [ ] `bun run test` passa
- [ ] Branch mergeada em `main`
