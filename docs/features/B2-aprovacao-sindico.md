# B2 — Aprovação Explícita pelo Síndico

**Grupo:** B — Estrutura incompleta  
**Severidade:** Média  
**Estimativa:** 1.5 dias  

---

## 1. Contexto

Hoje o síndico visualiza casos no painel `/sindico/cases` mas não tem ação formal
de "aprovar" ou "rejeitar" uma reforma antes de ela prosseguir para análise técnica.
A triagem pelo IA classifica e o admin faz a revisão humana para casos HIGH/CRITICAL,
mas o síndico — que conhece o condomínio e a unidade — está fora desse fluxo de
aprovação.

Condomínios maiores precisam que o síndico formalize um "aceite" da reforma antes
de envolver parceiros e gerar custos.

---

## 2. User Stories

- **Como síndico**, quero revisar os detalhes de uma reforma solicitada e aprovar
  ou recusar antes que ela avance para análise técnica, para exercer minha
  responsabilidade de governança do condomínio.

- **Como administrador**, quero configurar se a aprovação do síndico é obrigatória
  ou opcional por condomínio, para não impor fricção desnecessária em condomínios
  menores.

- **Como morador**, quero ser notificado quando minha solicitação for aprovada ou
  recusada pelo síndico, para saber o status sem precisar ligar.

---

## 3. Design Técnico

### 3.1 Novo estado na máquina

Adicionar estado `AWAITING_SYNDIC_APPROVAL` entre `SCOPE_CLASSIFIED` e
`AWAITING_DOCUMENTS`:

```
SCOPE_CLASSIFIED
  → AWAITING_SYNDIC_APPROVAL  ← novo (quando condomínio exige aprovação do síndico)
  → AWAITING_DOCUMENTS        ← mantido (quando aprovação automática)
  → COMMERCIAL_OFFER_SENT
  → ELIGIBLE_FOR_RELEASE
  → HUMAN_REVIEW_REQUIRED

AWAITING_SYNDIC_APPROVAL    ← novo
  → AWAITING_DOCUMENTS      (síndico aprova)
  → ARCHIVED                (síndico recusa)
```

### 3.2 Flag de configuração no `Condominium`

```prisma
model Condominium {
  // ...campos existentes...
  requiresSyndicApproval Boolean @default(false)  // novo campo
}
```

### 3.3 Lógica no `ClassifyScopeUseCase`

```typescript
// Após classificar o escopo:
const condominium = await prisma.condominium.findUnique(...)
const nextStatus = condominium.requiresSyndicApproval
  ? CaseStatus.AWAITING_SYNDIC_APPROVAL
  : resolveNextStatus(evaluationResult)

stateMachine.transition(nextStatus, context)
```

### 3.4 Use Case — `SyndicReviewUseCase`

```typescript
// case-intake/application/SyndicReviewUseCase.ts
export class SyndicReviewUseCase {
  async approve(caseId: string, syndicId: string, comment?: string): Promise<void>
  async reject(caseId: string, syndicId: string, reason: string): Promise<void>
}
```

Regras:
- `syndicId` deve ter `role = CONDOMINIUM` e `condominiumId` igual ao do caso
- `approve` → transição para `AWAITING_DOCUMENTS`
- `reject` → transição para `ARCHIVED` com `reason` obrigatório
- Ambos gravam `CaseTransitionLog` + `AuditLog` + disparam notificação ao morador

### 3.5 API Routes

```
POST /api/v1/cases/:caseId/syndic-review/approve
  Body: { comment?: string }
  Auth: CONDOMINIUM (mesmo condominiumId do caso)

POST /api/v1/cases/:caseId/syndic-review/reject
  Body: { reason: string }
  Auth: CONDOMINIUM (mesmo condominiumId do caso)
```

### 3.6 UI — Painel do síndico

Em `/sindico/cases`, casos no status `AWAITING_SYNDIC_APPROVAL` aparecem no topo
com badge "⏳ Aguardando sua aprovação".

Ao abrir um caso, exibir:
- Resumo do escopo (serviços, nível de risco, `requiresART`)
- Resultado da avaliação do `DeterministicEvaluator` (regras disparadas)
- Botões "✅ Aprovar" e "❌ Recusar"
- Campo de motivo (obrigatório na recusa, opcional na aprovação)

### 3.7 Notificações

- Aprovação → notificação in-app + e-mail para o morador: "Sua reforma foi aprovada
  pelo síndico e seguirá para análise técnica."
- Rejeição → notificação in-app + e-mail com o motivo.

### 3.8 Configuração por condomínio

No painel admin em `/admin/condominiums/[id]`, adicionar toggle:
> "Exigir aprovação do síndico antes da análise técnica"

### 3.9 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `Condominium.requiresSyndicApproval` |
| `case-intake/domain/entities/CaseStateMachine.ts` | Novo estado + transições |
| `case-intake/application/ClassifyScopeUseCase.ts` | Checar flag do condomínio |
| `case-intake/application/SyndicReviewUseCase.ts` | Criar |
| `app/api/v1/cases/[caseId]/syndic-review/approve/route.ts` | Criar |
| `app/api/v1/cases/[caseId]/syndic-review/reject/route.ts` | Criar |
| `app/(condominium)/sindico/cases/page.tsx` | Badge + destaque casos pendentes |
| `app/(condominium)/sindico/cases/[caseId]/page.tsx` | Botões aprovar/recusar |
| `app/(admin)/condominiums/[id]/page.tsx` | Toggle de configuração |
| `case-intake/application/SyndicReviewUseCase.test.ts` | Testes |

---

## 4. Critérios de Aceite

- [ ] Condomínio com `requiresSyndicApproval=true` envia caso para `AWAITING_SYNDIC_APPROVAL` após classificação
- [ ] Condomínio com `requiresSyndicApproval=false` funciona como antes
- [ ] Síndico do condomínio correto pode aprovar ou recusar
- [ ] Síndico de outro condomínio recebe 403
- [ ] Aprovação transiciona para `AWAITING_DOCUMENTS` e notifica morador
- [ ] Rejeição transiciona para `ARCHIVED` com motivo obrigatório e notifica morador
- [ ] Admin consegue configurar o flag por condomínio
- [ ] Testes cobrem aprovação, rejeição e verificação de propriedade

---

## 5. Dependências

- Migration nova (`Condominium.requiresSyndicApproval`)
- `A1` concluído (não bloqueante, mas bom ter)

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 20 min |
| `CaseStateMachine` (novo estado) | 30 min |
| `SyndicReviewUseCase` | 1h |
| API Routes | 45 min |
| UI painel síndico | 2h |
| UI admin (toggle) | 30 min |
| Notificações | 30 min |
| Testes | 1h |
| **Total** | **~6.5h (1.5 dias)** |
