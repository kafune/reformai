# A2 — `PriceCalculator` Considerar `riskLevel` no Preço

**Grupo:** A — Backlog técnico  
**Severidade:** Baixa  
**Estimativa:** 3h  

---

## 1. Contexto

`PriceCalculator.calculatePrice()` em `commercial-offers/domain/PriceCalculator.ts`
recebe `riskLevel` e `mandatoryInspection` como parâmetros mas os ignora:

```typescript
// Atual — risco não afeta preço
calculatePrice(input: {
  basePrice: Decimal
  extraInspectionPrice: Decimal
  inspectionCount: number
  riskLevel: RiskLevel       // ← recebido mas não usado
  mandatoryInspection: boolean // ← recebido mas não usado
}): PriceResult
```

Isso significa que uma obra CRITICAL (demolição estrutural) e uma obra LOW (pintura)
recebem a mesma proposta de preço se tiverem o mesmo número de vistorias.

---

## 2. User Stories

- **Como administrador**, quero que propostas para obras de alto risco incluam um
  multiplicador de preço, para refletir o trabalho adicional de revisão, vistorias
  extras obrigatórias e responsabilidade técnica maior.

- **Como parceiro**, quero que o preço da proposta reflita o nível de complexidade
  da obra para que meu esforço seja adequadamente remunerado.

---

## 3. Design Técnico

### Multiplicadores por risco

Configuração sugerida (pode virar campo no `CommercialPlan` futuramente):

```typescript
const RISK_MULTIPLIER: Record<RiskLevel, number> = {
  LOW:      1.0,   // sem ajuste
  MEDIUM:   1.1,   // +10%
  HIGH:     1.25,  // +25%
  CRITICAL: 1.5,   // +50%
}
```

### Lógica revisada

```typescript
calculatePrice(input: PriceInput): PriceResult {
  const inspectionCount = Math.max(3, input.inspectionCount) // mínimo 3
  const extraCount = Math.max(0, inspectionCount - 3)
  const inspectionCost = extraCount * input.extraInspectionPrice

  const riskMultiplier = RISK_MULTIPLIER[input.riskLevel ?? 'LOW']
  const subtotal = input.basePrice.add(inspectionCost)
  const total = subtotal.mul(new Decimal(riskMultiplier))

  return {
    subtotal,
    riskMultiplier,
    riskAdjustment: total.sub(subtotal), // valor do acréscimo por risco
    total,
    inspectionCount,
    extraInspections: extraCount,
  }
}
```

### Exibir no `CommercialAgent`

O prompt do `CommercialAgent` deve incluir o multiplicador na narrativa:
> "Devido ao nível de risco HIGH, foi aplicado multiplicador de 25% sobre o valor base."

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `commercial-offers/domain/PriceCalculator.ts` | Implementar multiplicador |
| `commercial-offers/domain/types.ts` | Adicionar `riskMultiplier`, `riskAdjustment` ao `PriceResult` |
| `commercial-offers/application/CommercialAgent.ts` | Incluir multiplicador na narrativa |
| `commercial-offers/application/QuoteCaseUseCase.ts` | Nenhuma mudança — já passa `riskLevel` |
| `PriceCalculator.test.ts` | Novos testes por nível de risco |

### Decisão de produto necessária

Os multiplicadores acima são sugestão. Antes de implementar, confirmar com produto
se os valores fazem sentido de negócio ou se devem ser configuráveis por tenant no
`CommercialPlan`.

---

## 4. Critérios de Aceite

- [ ] Obra LOW gera preço = `basePrice + extras` (multiplicador 1.0)
- [ ] Obra MEDIUM gera preço 10% acima do subtotal
- [ ] Obra HIGH gera preço 25% acima
- [ ] Obra CRITICAL gera preço 50% acima
- [ ] `PriceResult` retorna `riskMultiplier` e `riskAdjustment` como campos separados
- [ ] Proposta exibida na UI mostra linha de "Ajuste por nível de risco"
- [ ] Testes cobrem todos os 4 níveis de risco
- [ ] `PriceCalculator.test.ts` passa 100%

---

## 5. Dependências

- Decisão de produto sobre os multiplicadores (ou torná-los configuráveis por tenant)

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Alterar `PriceCalculator` | 30 min |
| Atualizar `CommercialAgent` (narrativa) | 30 min |
| Atualizar UI da proposta | 45 min |
| Testes unitários | 45 min |
| **Total** | **~2.5h** |
