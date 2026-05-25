# A3 — Ampliar Testes do `DeterministicEvaluator`

**Grupo:** A — Backlog técnico  
**Severidade:** Baixa (mas módulo crítico)  
**Estimativa:** 2h  

---

## 1. Contexto

`DeterministicEvaluator` é o coração do `rule-engine` — toda classificação de risco
e determinação de `requiresART` passa por ele. É o módulo que garante que nenhuma IA
tome decisões críticas sozinha.

Atualmente tem apenas **3 casos de teste** em `DeterministicEvaluator.test.ts`,
cobrindo apenas o caminho feliz básico. Cenários importantes não testados:

- Múltiplas regras disparando ao mesmo tempo (acumulação de `riskDelta`)
- Score exato nos thresholds de fronteira (20, 45, 70)
- `overrides` de condomínio desabilitando regras
- Caso sem nenhuma regra ativa
- Score > 100 (deve ser limitado a 100)
- `requiresHumanReview` e `mandatoryInspection` como OR de múltiplas regras
- `requiresART: 'uncertain'` quando há regras conflitantes

---

## 2. User Stories

- **Como desenvolvedor**, quero testes que cubram os thresholds de fronteira do
  avaliador para ter confiança ao alterar os limites de risco.

- **Como desenvolvedor**, quero que qualquer regressão no `DeterministicEvaluator`
  seja capturada imediatamente por testes, dado que ele afeta toda a triagem.

---

## 3. Design Técnico

### Casos de teste a adicionar

```typescript
describe('DeterministicEvaluator', () => {

  // Thresholds de fronteira
  it('score 20 → LOW')
  it('score 21 → MEDIUM')
  it('score 45 → MEDIUM')
  it('score 46 → HIGH')
  it('score 70 → HIGH')
  it('score 71 → CRITICAL')

  // Acumulação
  it('múltiplas regras acumulam riskDelta corretamente')
  it('score > 100 é limitado a 100')

  // Flags OR
  it('requiresART = true se QUALQUER regra disparada tiver requiresART')
  it('requiresHumanReview = true se QUALQUER regra disparada tiver requiresHumanReview')
  it('mandatoryInspection = true se QUALQUER regra disparada tiver mandatoryInspection')

  // Política sem regras ativas
  it('política sem regras retorna riskLevel LOW e score 0')

  // Prioridade
  it('regras são avaliadas em ordem de prioridade crescente')

  // Regra inativa
  it('regra com active=false não é avaliada')

  // Overrides (via applyOverrides)
  it('override desabilita regra — não acumula delta')
  it('override ajusta action.riskDelta')

  // Condições de matching
  it('operator EQ — match e non-match')
  it('operator GT / GTE / LT / LTE em campos numéricos')
  it('operator INCLUDES em arrays de serviços')
  it('campo inexistente no scope → regra não dispara')
})
```

### Fixture de política para testes

Criar `fixtures/policy.ts` no diretório de testes com uma política padrão e helpers
para compor `ReformScope` e `Policy` de forma concisa.

---

## 4. Critérios de Aceite

- [ ] Todos os 6 thresholds de fronteira testados
- [ ] Acumulação de delta e teto de 100 testados
- [ ] Todos os 3 flags (ART, humanReview, inspection) testados com OR de múltiplas regras
- [ ] Regras inativas não contribuem para o score
- [ ] Cobertura de linha do `DeterministicEvaluator.ts` ≥ 90%
- [ ] `bun run test` passa sem regressões

---

## 5. Dependências

Nenhuma — testes unitários puros, sem banco ou rede.

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Escrever fixtures e helpers | 30 min |
| Escrever os ~18 casos de teste | 60 min |
| Ajustar implementação se bugs encontrados | 30 min |
| **Total** | **~2h** |
