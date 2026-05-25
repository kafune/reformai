# C8 — Alertas Automáticos de Casos Parados

**Grupo:** C — Features novas  
**Prioridade:** 🟡 Alto impacto, esforço médio  
**Estimativa:** 1.5 dias  
**Dependência:** B3 (SLA Dashboard) — compartilha a lógica de `SLA_BY_STATUS`  

---

## 1. Contexto

O B3 cria a infraestrutura de SLA (campo `lastTransitionAt`, `SLA_BY_STATUS`,
badges na UI). Este documento detalha a camada de **alertas proativos** — notificações
automáticas que saem da plataforma (e-mail, push, futuramente WhatsApp) quando
um caso ultrapassa o prazo.

A distinção é:
- **B3** = visualização e monitoramento passivo no dashboard
- **C8** = alertas ativos que chegam ao responsável sem ele precisar acessar a plataforma

---

## 2. User Stories

- **Como administrador**, quero receber um e-mail quando um caso ficar 24h em
  `HUMAN_REVIEW_REQUIRED` sem ação, para não deixar moradores esperando.

- **Como síndico**, quero receber uma notificação push quando uma reforma do meu
  condomínio ultrapassar o prazo esperado.

- **Como parceiro**, quero ser lembrado por e-mail quando tenho uma vistoria
  agendada para amanhã e ainda não confirmei.

---

## 3. Design Técnico

### 3.1 Matriz de alertas

| Status | Destinatário | Canal | Quando alertar |
|--------|-------------|-------|----------------|
| `HUMAN_REVIEW_REQUIRED` | Admin | E-mail + push | 12h no status |
| `HUMAN_REVIEW_REQUIRED` | Admin | E-mail (escalação) | 24h no status |
| `AWAITING_DOCUMENTS` | Morador | E-mail + push | 72h sem upload |
| `PENDING_CORRECTIONS` | Morador | E-mail | 48h sem ação |
| `COMMERCIAL_OFFER_SENT` | Morador | E-mail | 48h sem aceite |
| `ASSIGNED_TO_PARTNER` | Parceiro | E-mail + push | 24h sem aceite |
| `ASSIGNED_TO_PARTNER` | Admin | E-mail | 48h sem aceite (escalação) |
| `AWAITING_SYNDIC_APPROVAL` | Síndico | E-mail + push | 24h sem ação |
| `INSPECTIONS_SCHEDULED` | Parceiro | E-mail | D-1 da vistoria |
| Qualquer status com SLA | Admin | Push | 80% do prazo |

### 3.2 Modelo de dados — `SlaAlert`

Para evitar alertas duplicados, rastrear alertas já enviados:

```prisma
model SlaAlert {
  id        String   @id @default(cuid())
  caseId    String
  status    CaseStatus
  alertType String   // 'warning_80pct' | 'breach_100pct' | 'escalation_150pct'
  sentAt    DateTime @default(now())
  sentTo    String   // userId ou 'admin'

  @@unique([caseId, status, alertType, sentTo])  // idempotência
}
```

### 3.3 `SlaAlertService`

```typescript
// infrastructure/sla/SlaAlertService.ts
export class SlaAlertService {
  async checkAndAlert(reformCase: ReformCase): Promise<void> {
    const slaHours = SLA_BY_STATUS[reformCase.status]
    if (!slaHours) return

    const hoursInStatus = getHoursInStatus(reformCase)
    const pct = hoursInStatus / slaHours

    if (pct >= 1.5) {
      await this.sendIfNotSent(reformCase, 'escalation_150pct')
    } else if (pct >= 1.0) {
      await this.sendIfNotSent(reformCase, 'breach_100pct')
    } else if (pct >= 0.8) {
      await this.sendIfNotSent(reformCase, 'warning_80pct')
    }
  }

  private async sendIfNotSent(
    reformCase: ReformCase,
    alertType: string
  ): Promise<void> {
    const recipients = await this.resolveRecipients(reformCase)

    for (const recipient of recipients) {
      const exists = await prisma.slaAlert.findUnique({
        where: {
          caseId_status_alertType_sentTo: {
            caseId: reformCase.id,
            status: reformCase.status,
            alertType,
            sentTo: recipient.id,
          }
        }
      })
      if (exists) continue  // já enviado

      await prisma.slaAlert.create({ data: { ... } })
      await this.notify(recipient, reformCase, alertType)
    }
  }
}
```

### 3.4 Integração com `SlaCheckerWorker` (B3)

O `SlaCheckerWorker` do B3 chama `SlaAlertService.checkAndAlert()` para cada
caso identificado:

```typescript
// SlaCheckerWorker.ts (B3 + C8 integrados)
for (const reformCase of activeCases) {
  await slaAlertService.checkAndAlert(reformCase)  // C8
  updateDashboardMetrics(reformCase)               // B3
}
```

### 3.5 Lembrete de vistoria (D-1)

Job separado ou verificação adicional no `SlaCheckerWorker`:

```typescript
// Rodando 1x por dia às 09:00
const tomorrowInspections = await prisma.inspection.findMany({
  where: {
    status: 'SCHEDULED',
    scheduledAt: { gte: startOfTomorrow(), lt: endOfTomorrow() }
  }
})

for (const inspection of tomorrowInspections) {
  await emailService.send(inspection.partner.email, 'inspection-reminder', ...)
  await pushService.send(inspection.partner.userId, 'Vistoria amanhã às ...')
}
```

### 3.6 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | Adicionar `SlaAlert` |
| `infrastructure/sla/SlaAlertService.ts` | Criar |
| `infrastructure/queue/SlaCheckerWorker.ts` | Integrar `SlaAlertService` (B3) |
| `infrastructure/email/caseTemplates.ts` | Templates de alerta SLA por status |
| `workers/document-worker.ts` | Garantir que o cron de SLA está registrado |

---

## 4. Critérios de Aceite

- [ ] Nenhum alerta duplicado para a mesma combinação (caso + status + tipo + destinatário)
- [ ] Admin recebe e-mail em 12h + e-mail de escalação em 24h para `HUMAN_REVIEW_REQUIRED`
- [ ] Morador recebe e-mail em 72h para `AWAITING_DOCUMENTS`
- [ ] Parceiro recebe lembrete em D-1 da vistoria agendada
- [ ] `SlaAlert` registrado no banco antes do envio (idempotência)
- [ ] Falha no envio de notificação não interrompe processamento dos outros casos

---

## 5. Dependências

- **B3** obrigatório (compartilha `SlaCheckerWorker` e `SLA_BY_STATUS`)
- Migration para `SlaAlert`

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration (`SlaAlert`) | 30 min |
| `SlaAlertService` | 2h |
| Templates de e-mail de alerta | 1h |
| Lembrete de vistoria D-1 | 1h |
| Integração com `SlaCheckerWorker` | 45 min |
| Testes | 1h |
| **Total** | **~6h (1.5 dias)** |
