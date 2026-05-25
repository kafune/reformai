# C2 — E-mail Automático nas Mudanças de Status

**Grupo:** C — Features novas  
**Prioridade:** 🔴 Alto impacto, baixo esforço  
**Estimativa:** 1 dia  

---

## 1. Contexto

`EmailFactory` existe (`infrastructure/email/`), é usada apenas para convites e
reset de senha. O `CaseTransitionLog` registra toda transição. Falta conectar os dois:
enviar e-mail ao morador (e quando relevante ao síndico/admin) quando o status do
caso muda.

Sem isso, o morador precisa acessar a plataforma ativamente para saber o andamento
da sua reforma — experiência ruim, alta taxa de "onde está meu caso?".

---

## 2. User Stories

- **Como morador**, quero receber um e-mail quando meu caso muda de estado
  (ex: "Seus documentos foram aprovados"), para acompanhar sem precisar logar
  toda hora.

- **Como síndico**, quero ser notificado por e-mail quando um caso do meu
  condomínio requer minha atenção ou foi concluído.

- **Como administrador**, quero ser notificado quando um caso entra em
  `HUMAN_REVIEW_REQUIRED`, para não perder nenhuma revisão pendente.

---

## 3. Design Técnico

### 3.1 Templates de e-mail por transição

Criar templates em `infrastructure/email/caseTemplates.ts`:

| Transição / Status destino | Destinatário | Assunto |
|---------------------------|-------------|---------|
| `AWAITING_DOCUMENTS` | Morador | "Documentos necessários para sua reforma" |
| `PENDING_CORRECTIONS` | Morador | "Corrija os documentos da sua reforma" |
| `ELIGIBLE_FOR_RELEASE` | Morador | "Sua reforma está apta para liberação" |
| `RELEASED_WITH_CONDITIONS` | Morador | "Reforma liberada com condições" |
| `COMMERCIAL_OFFER_SENT` | Morador | "Proposta comercial disponível para sua reforma" |
| `AWAITING_PAYMENT` | Morador | "Confirme o pagamento para prosseguir" |
| `ASSIGNED_TO_PARTNER` | Morador | "Parceiro técnico atribuído à sua obra" |
| `INSPECTIONS_SCHEDULED` | Morador | "Vistoria agendada" |
| `CONCLUDED` | Morador + Síndico | "Obra concluída — [Protocolo]" |
| `ARCHIVED` | Morador | "Caso arquivado" |
| `HUMAN_REVIEW_REQUIRED` | Admin | "Caso [Protocolo] aguarda revisão humana" |
| `AWAITING_SYNDIC_APPROVAL` | Síndico | "Nova reforma aguarda sua aprovação" |

### 3.2 Ponto de disparo

Integrar no `CaseStateMachine.transition()` ou criar um hook de pós-transição:

```typescript
// case-intake/application/CaseNotificationService.ts
export class CaseNotificationService {
  async onTransition(
    reformCase: ReformCase,
    toStatus: CaseStatus,
    context: TransitionContext
  ): Promise<void> {
    const template = TEMPLATES_BY_STATUS[toStatus]
    if (!template) return  // estados sem template = silêncio

    const recipients = await this.resolveRecipients(reformCase, template.target)

    for (const recipient of recipients) {
      await this.email.send({
        to: recipient.email,
        subject: template.subject(reformCase),
        html: template.html(reformCase, recipient),
      }).catch(() => {}) // e-mail é non-fatal
    }
  }
}
```

**Importante:** e-mail nunca bloqueia o fluxo principal (`.catch(() => {})` ou
equivalente). Segue o padrão existente de `EmailFactory` que já é non-fatal.

### 3.3 Onde chamar

Nos application services após cada transição:

```typescript
// CreateCaseUseCase, ClassifyScopeUseCase, SyndicReviewUseCase, etc.
await caseNotificationService.onTransition(reformCase, newStatus, context)
// ↑ não precisa de await, pode ser fire-and-forget com .catch() interno
```

### 3.4 Estrutura dos templates HTML

Cada template HTML deve incluir:
- Header com logo do tenant (via CSS vars white-label)
- Protocolo do caso
- Status atual em português
- Call-to-action com link direto para o caso (`NEXT_PUBLIC_APP_URL/cases/:id`)
- Footer com disclaimer e link de descadastro (LGPD)

### 3.5 Preferências de notificação

MVP: enviar para todos. Futuramente, adicionar `User.emailNotificationsEnabled`.

### 3.6 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `infrastructure/email/caseTemplates.ts` | Criar templates por status |
| `case-intake/application/CaseNotificationService.ts` | Criar serviço |
| `case-intake/application/ClassifyScopeUseCase.ts` | Disparar notificação |
| `inspection-scheduling/application/ScheduleInspectionUseCase.ts` | Disparar notificação |
| `inspection-scheduling/application/CompleteInspectionUseCase.ts` | Disparar notificação |
| `commercial-offers/application/QuoteCaseUseCase.ts` | Disparar notificação |
| Demais use cases com transições | Disparar notificação |

---

## 4. Critérios de Aceite

- [ ] Morador recebe e-mail em cada transição relevante listada acima
- [ ] Admin recebe e-mail quando caso entra em `HUMAN_REVIEW_REQUIRED`
- [ ] Síndico recebe e-mail quando caso entra em `AWAITING_SYNDIC_APPROVAL`
- [ ] Falha no envio de e-mail **não** propaga erro para o fluxo principal
- [ ] Link no e-mail aponta para a URL correta do caso
- [ ] E-mail inclui protocolo do caso
- [ ] Sem envios duplicados para a mesma transição
- [ ] Templates têm disclaimer LGPD e link de descadastro

---

## 5. Dependências

- `RESEND_API_KEY` ou `SMTP_*` configurados (já existe `EmailFactory`)
- B2 (Aprovação síndico) para o template `AWAITING_SYNDIC_APPROVAL`

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| `CaseNotificationService` + mapa de templates | 2h |
| Templates HTML (12) | 2h |
| Integrar nos use cases | 1.5h |
| Testes unitários (mock de email) | 1h |
| **Total** | **~6.5h (1 dia)** |
