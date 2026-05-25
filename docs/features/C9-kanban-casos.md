# C9 — Kanban View de Casos no Painel Admin

**Grupo:** C — Features novas  
**Prioridade:** 🟡 Alto impacto, esforço médio  
**Estimativa:** 1.5 dias  

---

## 1. Contexto

A listagem atual de casos em `/admin/review-queue` é uma tabela linear. Com dezenas
de casos, fica difícil ter uma visão holística do funil: quantos estão parados em
cada estado, onde há gargalos, o que precisa de ação imediata.

Um Kanban com colunas por status — **sem necessidade de drag-and-drop** (ação é via
botões no card) — oferece essa visão panorâmica de forma imediata.

---

## 2. User Stories

- **Como administrador**, quero ver uma visão Kanban dos casos organizados por
  status para identificar gargalos de forma visual.

- **Como síndico**, quero ver um Kanban dos casos do meu condomínio para acompanhar
  o fluxo de reformas de forma panorâmica.

---

## 3. Design Técnico

### 3.1 Colunas do Kanban

Agrupar os 17 estados em **7 colunas lógicas** (muitos estados individuais tornaria
o board ilegível):

| Coluna | Estados incluídos | Cor |
|--------|------------------|-----|
| **Triagem** | `DRAFT`, `AWAITING_SCOPE_DETAILS`, `SCOPE_CLASSIFIED` | Cinza |
| **Aguardando Síndico** | `AWAITING_SYNDIC_APPROVAL` | Azul |
| **Documentos** | `AWAITING_DOCUMENTS`, `DOCUMENTS_UNDER_REVIEW`, `PENDING_CORRECTIONS` | Amarelo |
| **Revisão** | `ELIGIBLE_FOR_RELEASE`, `RELEASED_WITH_CONDITIONS`, `HUMAN_REVIEW_REQUIRED` | Laranja |
| **Comercial** | `COMMERCIAL_OFFER_SENT`, `AWAITING_PAYMENT`, `ASSIGNED_TO_PARTNER` | Verde-claro |
| **Execução** | `ART_RRT_PENDING`, `INSPECTIONS_SCHEDULED`, `IN_EXECUTION` | Verde |
| **Encerrado** | `CONCLUDED`, `ARCHIVED` | Verde-escuro / Cinza |

### 3.2 Layout

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│  Triagem (4) │ Documentos(3)│  Revisão (2) │  Comercial(5)│ Execução (3) │
│──────────────│──────────────│──────────────│──────────────│──────────────│
│  ┌─────────┐ │  ┌─────────┐ │  ┌─────────┐ │  ┌─────────┐ │  ┌─────────┐ │
│  │RF-042   │ │  │RF-039   │ │  │RF-031   │ │  │RF-025   │ │  │RF-018   │ │
│  │Apto 203 │ │  │Apto 101 │ │  │Apto 512 │ │  │Apto 304 │ │  │Apto 105 │ │
│  │🔴 HIGH  │ │  │🟡 MED   │ │  │🔴 HIGH  │ │  │🟢 LOW   │ │  │🟠 HIGH  │ │
│  └─────────┘ │  └─────────┘ │  └─────────┘ │  └─────────┘ │  └─────────┘ │
│  ┌─────────┐ │  ...         │  ...         │  ...         │  ...         │
│  │RF-041   │ │              │              │              │              │
│  │...      │ │              │              │              │              │
│  └─────────┘ │              │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

### 3.3 Card do Kanban

```tsx
interface KanbanCard {
  protocol: string
  unitIdentifier: string
  block?: string
  riskLevel: RiskLevel
  status: CaseStatus
  slaStatus?: 'ok' | 'at_risk' | 'breached'  // B3
  clientName: string
  updatedAt: Date
}
```

Clique no card → navega para `/admin/review-queue/[caseId]`.

### 3.4 Alternância lista ↔ Kanban

Toggle na página de review-queue:

```
[☰ Lista]  [⊞ Kanban]
```

Preferência salva em `localStorage`.

### 3.5 API Route de agrupamento

```
GET /api/v1/admin/cases/kanban
  Auth: ADMIN | SUPER_ADMIN | MANAGER
  Response: { [CaseStatusGroup]: CaseSummary[] }
```

Ou reusar `GET /api/v1/cases` com `groupBy=statusGroup` — a ser decidido.

### 3.6 Filtros no Kanban

Os mesmos filtros da lista (condomínio, risco, data) devem funcionar no Kanban.

### 3.7 Responsividade

Em mobile (< 768px), o Kanban exibe **uma coluna por vez** com navegação
horizontal (swipe ou botões ◀ ▶). Não exibir todas as colunas em mobile — impossível.

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `interfaces/components/ui/KanbanBoard.tsx` | Criar componente |
| `interfaces/components/ui/KanbanCard.tsx` | Criar card |
| `app/api/v1/admin/cases/kanban/route.ts` | Criar endpoint agrupado |
| `app/(admin)/review-queue/page.tsx` | Toggle lista/kanban |
| `app/(condominium)/sindico/cases/page.tsx` | Toggle lista/kanban (síndico) |

---

## 4. Critérios de Aceite

- [ ] Board exibe 7 colunas com casos agrupados corretamente
- [ ] Contador de casos por coluna visível
- [ ] Badge de risco (LOW/MEDIUM/HIGH/CRITICAL) no card
- [ ] Badge de SLA quando em risco ou vencido (B3)
- [ ] Clique no card navega para o detalhe do caso
- [ ] Toggle lista ↔ Kanban funciona e persiste preferência
- [ ] Filtros aplicados ao Kanban (mesmo comportamento da lista)
- [ ] Responsivo: em mobile exibe uma coluna por vez com navegação
- [ ] Tenant-scoped: não vaza casos de outros tenants

---

## 5. Dependências

- B3 (SLA) para os badges de SLA nos cards (opcional — Kanban funciona sem)

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| API Route (`/cases/kanban`) | 1h |
| Componentes `KanbanBoard` + `KanbanCard` | 3h |
| Toggle lista/Kanban na página | 1h |
| Responsividade mobile | 1.5h |
| Integração nos 2 painéis | 45 min |
| **Total** | **~7h (1.5 dias)** |
