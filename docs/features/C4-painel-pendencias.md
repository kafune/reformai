# C4 — Painel de Pendências por Perfil de Usuário

**Grupo:** C — Features novas  
**Prioridade:** 🔴 Alto impacto, baixo esforço  
**Estimativa:** 1.5 dias  

---

## 1. Contexto

Cada perfil de usuário tem um conjunto de ações específicas que aguardam ele:

- **Morador:** enviar documentos, corrigir pendências, aceitar proposta, pagar
- **Síndico:** aprovar reformas (B2), casos com SLA vencido (B3)
- **Parceiro:** aceitar atribuição, completar vistorias agendadas
- **Admin:** casos em `HUMAN_REVIEW_REQUIRED`, casos sem parceiro atribuído

Hoje essas informações estão espalhadas em listas genéricas. Um "inbox de ações"
personalizado por perfil reduz o tempo de resposta e evita que itens caiam no
esquecimento.

---

## 2. User Stories

- **Como morador**, ao fazer login, quero ver imediatamente o que preciso fazer
  para avançar minha reforma, sem precisar navegar.

- **Como parceiro**, quero ver minhas vistorias de amanhã e os casos que ainda
  não aceitei, logo ao abrir o app.

- **Como síndico**, quero um resumo do que precisa da minha atenção hoje, não
  uma lista de todos os casos.

- **Como administrador**, quero que o dashboard mostre somente o que exige ação
  minha agora, não métricas de vaidade.

---

## 3. Design Técnico

### 3.1 Definição de pendências por perfil

```typescript
// case-intake/application/GetPendingActionsUseCase.ts

type PendingAction = {
  type: ActionType
  caseId: string
  protocol: string
  unitIdentifier: string
  description: string
  urgency: 'critical' | 'high' | 'normal'
  dueAt?: Date
}

const PENDING_BY_STATUS: Record<UserRole, Record<CaseStatus, ActionType | null>> = {
  CLIENT: {
    AWAITING_DOCUMENTS:   'upload_documents',
    PENDING_CORRECTIONS:  'correct_documents',
    COMMERCIAL_OFFER_SENT:'accept_offer',
    AWAITING_PAYMENT:     'confirm_payment',
    // ...demais = null
  },
  CONDOMINIUM: {
    AWAITING_SYNDIC_APPROVAL: 'approve_reform',  // B2
    // Cases com SLA vencido = 'sla_breach'        // B3
  },
  PARTNER: {
    ASSIGNED_TO_PARTNER:  'accept_assignment',
    INSPECTIONS_SCHEDULED:'complete_inspection',  // se data <= hoje + 1 dia
  },
  ADMIN: {
    HUMAN_REVIEW_REQUIRED: 'human_review',
    ASSIGNED_TO_PARTNER:   'assign_partner',  // se sem parceiro há > 24h
  },
  // MANAGER = mesmos que ADMIN
  // SUPER_ADMIN = mesmos que ADMIN
}
```

### 3.2 API Route

```
GET /api/v1/me/pending-actions
  Auth: qualquer role autenticado
  Response: PendingAction[]
```

Query otimizada — um único `prisma.reformCase.findMany` com `where` que filtra pelos
status relevantes para o role do usuário, tenant-scoped.

### 3.3 Widget `PendingActionsWidget`

Componente de "inbox" para exibir nas páginas de dashboard:

```
┌──────────────────────────────────────────────────┐
│  📋 Pendências (3)                                │
│ ──────────────────────────────────────────────── │
│  🔴 RF-2026-042 • Apto 203 • Apto 203            │
│     Enviar documentos obrigatórios               │
│     [Enviar agora →]                             │
│                                                  │
│  🟡 RF-2026-039 • Apto 101                       │
│     Corrigir o memorial descritivo               │
│     [Ver pendências →]                           │
│                                                  │
│  🟡 RF-2026-035 • Apto 512                       │
│     Aceitar proposta comercial (expira em 2 dias)│
│     [Ver proposta →]                             │
└──────────────────────────────────────────────────┘
```

### 3.4 Onde exibir

| Perfil | Página | Local |
|--------|--------|-------|
| CLIENT | `/cases` | Topo (antes da lista de casos) |
| CONDOMINIUM | `/sindico/dashboard` | Substituir ou complementar cards atuais |
| PARTNER | `/partner/dashboard` | Substituir ou complementar cards atuais |
| ADMIN/MANAGER | `/dashboard` | Card de destaque no topo |

### 3.5 Auto-refresh

Polling leve a cada 60s (ou Server-Sent Events futuro) para manter as pendências
atualizadas:

```typescript
// Hook: usePendingActions
function usePendingActions() {
  const [actions, setActions] = useState<PendingAction[]>([])

  useEffect(() => {
    const fetch = () => api.get('/me/pending-actions').then(setActions)
    fetch()
    const interval = setInterval(fetch, 60_000)
    return () => clearInterval(interval)
  }, [])

  return actions
}
```

### 3.6 Badge no título da aba

Usar `document.title = `(${count}) ReformAI`` quando há pendências, para alertar
mesmo com a aba em background.

### 3.7 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `case-intake/application/GetPendingActionsUseCase.ts` | Criar |
| `app/api/v1/me/pending-actions/route.ts` | Criar endpoint |
| `interfaces/components/ui/PendingActionsWidget.tsx` | Criar componente |
| `app/cases/page.tsx` | Integrar widget |
| `app/(condominium)/sindico/dashboard/page.tsx` | Integrar widget |
| `app/(partner)/partner/dashboard/page.tsx` | Integrar widget |
| `app/(admin)/dashboard/page.tsx` | Integrar widget |

---

## 4. Critérios de Aceite

- [ ] Cada perfil vê apenas as pendências relevantes ao seu papel
- [ ] Morador vê pendências de envio de docs, correções, aceite de proposta
- [ ] Síndico vê reformas aguardando aprovação (após B2)
- [ ] Parceiro vê atribuições não aceitas e vistorias do dia seguinte
- [ ] Admin vê casos em `HUMAN_REVIEW_REQUIRED`
- [ ] Widget atualiza automaticamente a cada 60s
- [ ] Botão "Ir para o caso" navega diretamente à ação relevante
- [ ] Sem pendências exibe "✅ Tudo em dia"
- [ ] RBAC: morador não vê pendências de outros moradores

---

## 5. Dependências

- B2 (Aprovação síndico) para pendência `approve_reform`
- B3 (SLA) para urgência visual

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| `GetPendingActionsUseCase` + queries | 2h |
| API Route + validação RBAC | 45 min |
| Componente `PendingActionsWidget` | 2h |
| Integrar nos 4 dashboards | 1.5h |
| Testes unitários (use case) | 1h |
| **Total** | **~7h (1.5 dias)** |
