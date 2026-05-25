# B3 — SLA Tracking com Alertas

**Grupo:** B — Estrutura incompleta  
**Severidade:** Média  
**Estimativa:** 2 dias  

---

## 1. Contexto

O campo `Partner.slaHours` existe e o `PartnerMatcher` ordena por SLA, mas não há:
- Monitoramento de casos que passaram do prazo acordado com o parceiro
- Alertas automáticos quando um caso fica parado além do esperado em qualquer estado
- Dashboard de SLA no painel admin

Casos parados prejudicam a experiência do morador e a reputação do condomínio. Sem
alertas, o problema só aparece quando o morador reclama.

---

## 2. User Stories

- **Como administrador**, quero ver no dashboard quantos casos estão com SLA
  vencido ou em risco, para priorizar minha atenção de forma proativa.

- **Como administrador**, quero receber uma notificação quando um caso fica parado
  em qualquer status por mais de X horas sem transição, para tomar ação antes
  que o morador reclame.

- **Como síndico**, quero ser alertado quando um caso do meu condomínio ultrapassa
  o prazo esperado, para acionar a administradora.

---

## 3. Design Técnico

### 3.1 Definição de SLA por status

Configuração global padrão (pode ser sobrescrita por tenant futuramente):

```typescript
// shared/sla.ts
export const SLA_BY_STATUS: Record<CaseStatus, number | null> = {
  DRAFT:                      null,  // sem SLA (ação do morador)
  AWAITING_SCOPE_DETAILS:     48,    // 48h para morador completar triagem
  AWAITING_SYNDIC_APPROVAL:   72,    // 3 dias para síndico aprovar
  SCOPE_CLASSIFIED:           4,     // 4h para sistema processar
  AWAITING_DOCUMENTS:         120,   // 5 dias para morador enviar docs
  DOCUMENTS_UNDER_REVIEW:     24,    // 24h para revisão automática
  PENDING_CORRECTIONS:        72,    // 3 dias para morador corrigir
  ELIGIBLE_FOR_RELEASE:       8,     // 8h para admin agir
  RELEASED_WITH_CONDITIONS:   8,
  HUMAN_REVIEW_REQUIRED:      24,    // 24h para revisor humano
  COMMERCIAL_OFFER_SENT:      72,    // 3 dias para morador aceitar
  AWAITING_PAYMENT:           48,
  ASSIGNED_TO_PARTNER:        24,    // 24h para parceiro aceitar
  ART_RRT_PENDING:            168,   // 7 dias (prazo do CREA)
  INSPECTIONS_SCHEDULED:      null,  // depende da data agendada
  IN_EXECUTION:               null,  // depende do cronograma
  CONCLUDED:                  null,
  ARCHIVED:                   null,
}
```

### 3.2 Campo `lastTransitionAt` no `ReformCase`

Para calcular tempo no status atual sem precisar fazer JOIN em `CaseTransitionLog`:

```prisma
model ReformCase {
  // ...campos existentes...
  lastTransitionAt DateTime @default(now())  // atualizado a cada transição
}
```

Atualizado no `CaseStateMachine.transition()`.

### 3.3 Job BullMQ periódico — `SlaCheckerWorker`

Novo job `sla-check` que roda a cada hora via BullMQ `repeat`:

```typescript
// infrastructure/queue/SlaCheckerWorker.ts
async function checkSla() {
  const activeCases = await prisma.reformCase.findMany({
    where: {
      status: { notIn: ['CONCLUDED', 'ARCHIVED'] },
      lastTransitionAt: { lt: new Date(Date.now() - MIN_SLA_HOURS * 3600_000) }
    }
  })

  for (const reformCase of activeCases) {
    const slaHours = SLA_BY_STATUS[reformCase.status]
    if (!slaHours) continue

    const hoursInStatus = (Date.now() - reformCase.lastTransitionAt.getTime()) / 3600_000

    if (hoursInStatus >= slaHours) {
      await notifySlaBreached(reformCase, hoursInStatus)
    } else if (hoursInStatus >= slaHours * 0.8) {
      await notifySlaAtRisk(reformCase, hoursInStatus, slaHours)
    }
  }
}
```

### 3.4 Notificações de SLA

- **Em risco (80% do prazo)** — notificação in-app para admin/síndico
- **Vencido (100%)** — notificação in-app + e-mail para admin
- **24h após vencimento** — nova notificação de escalação

### 3.5 Dashboard de SLA no admin

Novo card no `/admin/dashboard`:

```
┌─────────────────────────────────────────────┐
│  SLA de Casos                               │
│                                             │
│  🔴 Vencidos        3 casos                 │
│  🟡 Em risco        7 casos                 │
│  🟢 Dentro do prazo 28 casos                │
│                                             │
│  [Ver casos vencidos →]                     │
└─────────────────────────────────────────────┘
```

### 3.6 Filtro na listagem de casos

Em `/admin/review-queue` e `/sindico/cases`, adicionar filtro "Com SLA vencido".

### 3.7 Badge no `CaseCard`

Se o caso está vencido: badge vermelho "⚠️ SLA vencido há 2h".
Se em risco: badge amarelo "⏱ 80% do prazo".

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `ReformCase.lastTransitionAt` |
| `shared/sla.ts` | Criar constante `SLA_BY_STATUS` |
| `case-intake/domain/entities/CaseStateMachine.ts` | Atualizar `lastTransitionAt` na transição |
| `infrastructure/queue/SlaCheckerWorker.ts` | Criar job periódico |
| `workers/document-worker.ts` | Registrar o worker de SLA |
| `app/(admin)/dashboard/page.tsx` | Card de SLA |
| `app/(admin)/review-queue/page.tsx` | Filtro + badges |
| `app/(condominium)/sindico/cases/page.tsx` | Filtro + badges |
| `interfaces/components/ui/CaseCard.tsx` | Badge de SLA |

---

## 4. Critérios de Aceite

- [ ] `SLA_BY_STATUS` define prazo para todos os estados relevantes
- [ ] `ReformCase.lastTransitionAt` atualizado em toda transição de estado
- [ ] Job BullMQ detecta casos vencidos e em risco corretamente
- [ ] Notificação in-app gerada para admin quando caso vence SLA
- [ ] E-mail gerado para admin quando caso vence SLA (via `EmailFactory`)
- [ ] Dashboard admin exibe contadores de vencidos/em risco/ok
- [ ] Badge de SLA exibido nos cards de caso
- [ ] Filtro "SLA vencido" funciona na listagem admin e síndico
- [ ] Job não gera notificações duplicadas (idempotência)

---

## 5. Dependências

- Migration (`lastTransitionAt`)
- `EmailFactory` configurada (já existe, mas pode falhar silenciosamente se sem config)

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration + `SLA_BY_STATUS` | 45 min |
| `CaseStateMachine` (atualizar `lastTransitionAt`) | 20 min |
| `SlaCheckerWorker` + lógica de notificação | 2h |
| Dashboard card | 1h |
| Filtros e badges na UI | 1.5h |
| Testes | 1h |
| **Total** | **~6.5h (1.5-2 dias)** |
