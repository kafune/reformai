# C13 — Webhooks para Administradoras Externas

**Grupo:** C — Features novas  
**Prioridade:** 🟢 Estratégico, esforço maior  
**Estimativa:** 3 dias  

---

## 1. Contexto

Tenants do tipo `ADMINISTRADORA` (gestoras de múltiplos condomínios) têm sistemas
próprios — ERPs, CRMs, sistemas de cobrança — que precisam saber quando uma reforma
muda de estado para disparar processos internos: cobrar o condomínio, atualizar
registros, notificar a equipe de campo.

Webhooks transformam o ReformAI em uma plataforma integrável, abrindo para o
mercado enterprise.

---

## 2. User Stories

- **Como administrador de uma administradora**, quero configurar um webhook URL
  para receber eventos de mudança de status dos casos dos meus condomínios, para
  integrar com meu ERP sem precisar fazer polling na API.

- **Como desenvolvedor de sistemas da administradora**, quero receber um payload
  JSON assinado com HMAC quando um caso muda de estado, para acionar automações
  internas com segurança.

- **Como SUPER_ADMIN**, quero monitorar entregas de webhook e reenviar manualmente
  em caso de falha.

---

## 3. Design Técnico

### 3.1 Modelo de dados

```prisma
model WebhookEndpoint {
  id          String   @id @default(cuid())
  tenantId    String
  url         String
  secret      String   // usado para HMAC SHA-256
  description String?
  events      String[] // ['case.status.changed', 'document.uploaded', ...]
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant     Tenant           @relation(fields: [tenantId], references: [id])
  deliveries WebhookDelivery[]
}

model WebhookDelivery {
  id           String              @id @default(cuid())
  endpointId   String
  event        String
  payload      Json
  status       WebhookStatus       @default(PENDING)
  httpStatus   Int?
  response     String?
  attemptCount Int                 @default(0)
  nextAttemptAt DateTime?
  deliveredAt  DateTime?
  createdAt    DateTime            @default(now())

  endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id])
}

enum WebhookStatus { PENDING DELIVERED FAILED RETRYING }
```

### 3.2 Eventos disponíveis

```typescript
type WebhookEvent =
  | 'case.created'
  | 'case.status.changed'
  | 'case.partner.assigned'
  | 'case.concluded'
  | 'case.archived'
  | 'document.uploaded'
  | 'document.validated'
  | 'inspection.scheduled'
  | 'inspection.completed'
  | 'commercial.offer.accepted'
```

### 3.3 Payload padrão

```json
{
  "event": "case.status.changed",
  "timestamp": "2026-05-25T14:30:00Z",
  "tenantId": "cuid...",
  "data": {
    "caseId": "cuid...",
    "protocol": "RF-2026-042",
    "condominiumId": "cuid...",
    "condominiumName": "Edifício Primavera",
    "unitIdentifier": "203",
    "previousStatus": "AWAITING_DOCUMENTS",
    "currentStatus": "DOCUMENTS_UNDER_REVIEW",
    "riskLevel": "HIGH",
    "requiresART": true,
    "triggeredBy": "system",
    "reason": "Todos os documentos enviados"
  }
}
```

### 3.4 Assinatura HMAC

```typescript
// Adicionar header: X-Webhook-Signature: sha256=<hmac>
function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}
```

Destinatários verificam:
```
X-Webhook-Signature: sha256=abc123...
```

### 3.5 `WebhookDispatchService`

```typescript
// infrastructure/webhooks/WebhookDispatchService.ts
export class WebhookDispatchService {
  async dispatch(event: WebhookEvent, tenantId: string, data: object): Promise<void> {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId, active: true, events: { has: event } }
    })

    for (const endpoint of endpoints) {
      // Enfileirar no BullMQ (não chamar HTTP synchronously)
      await this.queue.add('webhook-delivery', {
        endpointId: endpoint.id,
        event,
        data
      })
    }
  }
}
```

### 3.6 Worker de entrega — `WebhookWorker`

```typescript
// infrastructure/queue/WebhookWorker.ts
async function deliverWebhook(job: Job<WebhookDeliveryJob>) {
  const { endpointId, event, data } = job.data
  const endpoint = await prisma.webhookEndpoint.findUnique(...)

  const payload = JSON.stringify({ event, timestamp: new Date(), ...data })
  const signature = signPayload(payload, endpoint.secret)

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event,
      'X-Webhook-Delivery': deliveryId,
    },
    body: payload,
    signal: AbortSignal.timeout(10_000),  // 10s timeout
  })

  // Registrar resultado na WebhookDelivery
  // Retry automático: 3 tentativas com backoff exponencial
}
```

### 3.7 Retry com backoff

Tentativas: imediato → 5min → 30min → 2h → 24h (5 tentativas total).
Após 5 falhas → `status: FAILED`, alerta in-app para admin.

### 3.8 Painel admin de webhooks

Novo menu em `/admin/webhooks` ou `/superadmin/webhooks` (dependendo do scope):

- Listar endpoints configurados
- Adicionar/editar/deletar endpoint
- Log de entregas com status, HTTP status e payload
- Botão "Reenviar" para deliveries com falha

### 3.9 Integração nos use cases

```typescript
// Em cada use case com transição de estado:
await webhookDispatchService.dispatch(
  'case.status.changed',
  reformCase.tenantId,
  { caseId, protocol, previousStatus, currentStatus, ... }
).catch(() => {})  // non-fatal
```

### 3.10 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `WebhookEndpoint`, `WebhookDelivery` |
| `infrastructure/webhooks/WebhookDispatchService.ts` | Criar |
| `infrastructure/queue/WebhookWorker.ts` | Criar |
| `app/api/v1/admin/webhooks/route.ts` | CRUD endpoints |
| `app/api/v1/admin/webhooks/[id]/deliveries/route.ts` | Listar entregas |
| `app/api/v1/admin/webhooks/[id]/deliveries/[deliveryId]/retry/route.ts` | Reenviar |
| `app/(admin)/webhooks/page.tsx` | Painel admin |
| Use cases com transições | Integrar `webhookDispatchService.dispatch()` |

---

## 4. Critérios de Aceite

- [ ] Admin cria endpoint com URL, secret e lista de eventos
- [ ] Payload enviado com assinatura HMAC correta
- [ ] Timeout de 10s na chamada HTTP ao endpoint
- [ ] Retry automático: 5 tentativas com backoff exponencial
- [ ] `WebhookDelivery` registra cada tentativa com HTTP status e response
- [ ] Admin pode reenviar manualmente uma entrega com falha
- [ ] Webhook só enviado para eventos assinados pelo endpoint
- [ ] Tenant-scoped: webhook de um tenant não recebe eventos de outro
- [ ] Falha na entrega não afeta o fluxo principal do caso

---

## 5. Dependências

- Migration nova
- Fila BullMQ já configurada — apenas adicionar novo worker

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 1h |
| `WebhookDispatchService` | 1.5h |
| `WebhookWorker` com retry | 2h |
| API Routes (CRUD + deliveries + retry) | 2h |
| Painel admin | 2.5h |
| Integrar nos use cases | 1.5h |
| Testes | 1.5h |
| **Total** | **~12h (3 dias)** |
