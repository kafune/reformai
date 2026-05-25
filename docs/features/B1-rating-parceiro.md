# B1 — Rating do Parceiro pelo Morador

**Grupo:** B — Estrutura incompleta  
**Severidade:** Média  
**Estimativa:** 1 dia  

---

## 1. Contexto

O campo `Partner.rating` existe no banco e o método `updateRating()` existe no
repositório. O `PartnerMatcher` já ordena parceiros por rating. Falta:

1. Um formulário de avaliação que o **morador** preenche após a conclusão da obra
2. A lógica de cálculo de média incremental
3. Exibição do rating no painel de admin (seleção de parceiro) e no painel do parceiro

---

## 2. User Stories

- **Como morador**, após minha obra ser concluída, quero avaliar o parceiro com uma
  nota de 1 a 5 estrelas e um comentário opcional, para que outros moradores se
  beneficiem da minha experiência.

- **Como administrador**, quero ver a nota média dos parceiros ao atribuir um caso,
  para escolher o mais adequado.

- **Como parceiro**, quero acompanhar minha avaliação média para entender como
  estou me saindo.

---

## 3. Design Técnico

### 3.1 Modelo de dados

Criar modelo `PartnerReview` para armazenar cada avaliação individualmente (em vez
de só a média no `Partner`):

```prisma
model PartnerReview {
  id          String   @id @default(cuid())
  partnerId   String
  caseId      String   @unique  // uma avaliação por caso
  clientId    String
  tenantId    String
  score       Int      // 1 a 5
  comment     String?
  createdAt   DateTime @default(now())

  partner Partner    @relation(fields: [partnerId], references: [id])
  case    ReformCase @relation(fields: [caseId], references: [id])
  client  User       @relation(fields: [clientId], references: [id])

  @@index([partnerId])
}
```

### 3.2 Nova migration

```bash
bun run db:migrate -- --name add_partner_review
```

### 3.3 Use Case — `ReviewPartnerUseCase`

```typescript
// partner-network/application/ReviewPartnerUseCase.ts
export class ReviewPartnerUseCase {
  async execute(input: {
    caseId: string
    clientId: string
    tenantId: string
    score: number          // 1-5, validado por Zod
    comment?: string
  }): Promise<void> {
    // 1. Verificar que o caso está CONCLUDED
    // 2. Verificar que clientId é dono do caso
    // 3. Verificar que não existe avaliação para este caseId (PartnerReview.caseId unique)
    // 4. Criar PartnerReview
    // 5. Recalcular Partner.rating (média de todos os reviews do parceiro)
    // 6. Gravar AuditLog 'partner.reviewed'
  }
}
```

### 3.4 API Route

```
POST /api/v1/cases/:caseId/review
  Body: { score: number(1-5), comment?: string }
  Auth: CLIENT (dono do caso)
```

### 3.5 UI — Prompt pós-conclusão

Quando o caso entra em `CONCLUDED`, exibir um **drawer/modal** na tela do morador:

```
╔══════════════════════════════════════════╗
║  🏗️ Sua obra foi concluída!              ║
║                                          ║
║  Como foi sua experiência com            ║
║  [Nome do Parceiro]?                     ║
║                                          ║
║  ★ ★ ★ ★ ★  (clicável)                  ║
║                                          ║
║  Comentário (opcional)                   ║
║  ┌──────────────────────────────────┐    ║
║  │                                  │    ║
║  └──────────────────────────────────┘    ║
║                                          ║
║  [Avaliar]  [Depois]                     ║
╚══════════════════════════════════════════╝
```

### 3.6 Exibição no admin

Em `/admin/partners` e no componente de seleção de parceiro, exibir
`★ 4.7 (23 avaliações)`.

### 3.7 Exibição no painel do parceiro

Em `/partner/dashboard`, card com "Minha avaliação: ★ 4.7 — 23 avaliações".

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | Adicionar `PartnerReview` |
| `partner-network/application/ReviewPartnerUseCase.ts` | Criar |
| `partner-network/infrastructure/PrismaPartnerRepository.ts` | Adicionar `saveReview()`, `updateRating()` |
| `app/api/v1/cases/[caseId]/review/route.ts` | Criar endpoint |
| `app/cases/[caseId]/page.tsx` | Prompt pós-conclusão |
| `app/(admin)/partners/page.tsx` | Exibir rating |
| `app/(partner)/partner/dashboard/page.tsx` | Card de avaliação |
| `partner-network/application/ReviewPartnerUseCase.test.ts` | Testes |

---

## 4. Critérios de Aceite

- [ ] Morador vê prompt de avaliação quando caso entra em `CONCLUDED`
- [ ] Score de 1-5 validado pelo Zod; fora do range retorna 400
- [ ] Uma avaliação por caso — segunda tentativa retorna 409
- [ ] Apenas dono do caso pode avaliar — outra pessoa retorna 403
- [ ] `Partner.rating` é atualizado após cada review (média de todos os reviews)
- [ ] `AuditLog` registra a avaliação
- [ ] Rating aparece na listagem de parceiros no admin
- [ ] Rating aparece no painel do parceiro
- [ ] Testes unitários cobrem o use case

---

## 5. Dependências

- Migration nova (`PartnerReview`) precisa ser aplicada

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 30 min |
| `ReviewPartnerUseCase` + repositório | 1h |
| API Route | 30 min |
| UI (prompt morador + admin + parceiro) | 2h |
| Testes | 1h |
| **Total** | **~5h (1 dia)** |
