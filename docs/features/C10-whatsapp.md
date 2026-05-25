# C10 — Notificações via WhatsApp

**Grupo:** C — Features novas  
**Prioridade:** 🟢 Estratégico, esforço maior  
**Estimativa:** 3-4 dias  

---

## 1. Contexto

No Brasil, WhatsApp tem penetração de ~95% entre usuários de smartphone. Moradores
de condomínio respondem a mensagens de WhatsApp muito mais rapidamente do que e-mails
ou notificações push. Para um fluxo que depende de ação do morador (enviar documentos,
aceitar proposta), o canal de comunicação é determinante para a velocidade do processo.

A infraestrutura de notificação já tem interface abstrata (`NotifyUserUseCase`) —
WhatsApp seria mais um canal.

---

## 2. User Stories

- **Como morador**, quero receber uma mensagem de WhatsApp quando minha reforma
  precisar de alguma ação minha, para não perder prazos importantes.

- **Como administrador**, quero configurar qual canal de notificação está ativo
  por tenant (e-mail, push, WhatsApp), para adequar ao perfil dos moradores.

- **Como síndico**, quero receber notificações de reformas urgentes no WhatsApp,
  já que verifico menos o e-mail.

---

## 3. Design Técnico

### 3.1 Escolha do provedor

| Provedor | Custo | Complexidade | API |
|----------|-------|-------------|-----|
| **Evolution API** (self-hosted) | Gratuito | Alta (infra própria) | REST |
| **Twilio WhatsApp** | $0.005/msg | Baixa | SDK oficial |
| **Z-API** | ~R$49/mês | Baixa | REST |
| **WPPConnect** | Gratuito | Alta | Docker |

**Recomendação para MVP:** **Z-API** — custo fixo baixo, API REST simples, sem
aprovação de template obrigatória para mensagens de negócio iniciadas por sessão.
Evoluir para Twilio/Meta Business API quando tiver volume que justifique.

### 3.2 Novo model — `WhatsAppSubscription`

```prisma
model WhatsAppSubscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  phone     String   // +55 11 99999-9999 (E.164)
  active    Boolean  @default(true)
  optedInAt DateTime @default(now())
  tenantId  String

  user User @relation(fields: [userId], references: [id])
}
```

### 3.3 `WhatsAppProvider`

```typescript
// infrastructure/whatsapp/WhatsAppProvider.ts
export interface WhatsAppProvider {
  sendText(phone: string, message: string): Promise<void>
  sendTemplate(phone: string, templateId: string, vars: Record<string, string>): Promise<void>
}

// infrastructure/whatsapp/ZApiWhatsAppProvider.ts
// infrastructure/whatsapp/TwilioWhatsAppProvider.ts
// infrastructure/whatsapp/WhatsAppFactory.ts  ← seleciona por env var WHATSAPP_PROVIDER
```

### 3.4 Variáveis de ambiente

```env
# WhatsApp (zapi | twilio | disabled)
WHATSAPP_PROVIDER=disabled
ZAPI_INSTANCE_ID=
ZAPI_TOKEN=
# ou
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

### 3.5 Templates de mensagem

Mensagens curtas, diretas, com link para o caso:

```
# AWAITING_DOCUMENTS
🏗️ *ReformAI* — Protocolo RF-2026-042

Olá, {nome}! Sua solicitação de reforma foi classificada.

Para prosseguir, envie os documentos necessários:
{link_do_caso}

Dúvidas? Responda esta mensagem.

---
# COMMERCIAL_OFFER_SENT
💰 *ReformAI* — Proposta disponível

Olá, {nome}! A proposta para sua reforma (RF-2026-042) está disponível.

Valor: R$ {valor}
Válida por: {validade}

Ver proposta:
{link_do_caso}
```

### 3.6 Opt-in do morador

**Importante — LGPD e políticas do WhatsApp:** O morador precisa optar por receber
mensagens antes do primeiro envio.

Fluxo de opt-in:
1. Na tela de perfil do morador, campo "Receber notificações por WhatsApp"
2. Usuário informa número de telefone
3. Sistema envia mensagem de confirmação: "Responda SIM para ativar notificações"
4. Webhook do Z-API/Twilio captura a resposta e ativa o `WhatsAppSubscription`

### 3.7 Integração com `CaseNotificationService`

```typescript
// CaseNotificationService.onTransition()
const whatsapp = await prisma.whatsAppSubscription.findUnique({
  where: { userId: recipient.id, active: true }
})

if (whatsapp) {
  await whatsAppProvider.sendTemplate(
    whatsapp.phone,
    template.whatsappTemplateId,
    vars
  ).catch(() => {})  // non-fatal
}
```

### 3.8 Painel admin — configuração por tenant

Em `/admin` ou `/superadmin/tenants`, campo para ativar/desativar WhatsApp por tenant
e configurar as credenciais.

### 3.9 Webhook de recebimento

```
POST /api/v1/webhooks/whatsapp
  Público, validado por assinatura HMAC
```

Processa respostas de opt-in ("SIM") e desativações ("PARAR", "SAIR").

### 3.10 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `WhatsAppSubscription` |
| `infrastructure/whatsapp/WhatsAppProvider.ts` | Interface |
| `infrastructure/whatsapp/ZApiWhatsAppProvider.ts` | Implementação Z-API |
| `infrastructure/whatsapp/WhatsAppFactory.ts` | Factory |
| `case-intake/application/CaseNotificationService.ts` | Integrar WhatsApp |
| `app/api/v1/webhooks/whatsapp/route.ts` | Webhook de opt-in |
| `app/(client)/profile/page.tsx` | Toggle opt-in + campo de telefone |
| `.env.example` | Variáveis de WhatsApp |

---

## 4. Critérios de Aceite

- [ ] Morador opt-in via tela de perfil + confirmação por mensagem
- [ ] Morador opt-out respondendo "PARAR" ou pela tela de perfil
- [ ] Mensagens enviadas nos mesmos eventos que o e-mail
- [ ] Falha no envio de WhatsApp não afeta fluxo principal
- [ ] `WHATSAPP_PROVIDER=disabled` desativa totalmente (padrão)
- [ ] LGPD: `optedInAt` registrado, opt-out imediato
- [ ] Webhook valida assinatura HMAC antes de processar

---

## 5. Dependências

- C2 (e-mail em status changes) — compartilha lógica de `CaseNotificationService`
- Conta Z-API ou Twilio configurada
- Número de WhatsApp Business

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 30 min |
| `WhatsAppProvider` interface + Z-API impl | 3h |
| Templates de mensagem (12 eventos) | 2h |
| Opt-in flow (webhook + UI) | 3h |
| Integração no `CaseNotificationService` | 1h |
| Testes + configuração em dev | 2h |
| **Total** | **~11.5h (3 dias)** |
