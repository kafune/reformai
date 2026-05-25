# C14 — Precificação Dinâmica por Parceiro

**Grupo:** C — Features novas  
**Prioridade:** 🟢 Estratégico, esforço maior  
**Estimativa:** 2-3 dias  

---

## 1. Contexto

O `CommercialPlan` atual é um plano fixo por tenant: `basePrice + extraInspectionPrice`.
Todos os casos de um tenant recebem o mesmo preço base, independentemente do tipo
de serviço ou do parceiro envolvido.

Na prática, um engenheiro civil cobra diferente de um arquiteto para o mesmo serviço,
e elétrica tem custo completamente diferente de pintura. Sem precificação granular,
as propostas são imprecisas e podem afastar moradores ou subvalorizar o trabalho
do parceiro.

---

## 2. User Stories

- **Como administrador**, quero configurar uma tabela de preços por tipo de serviço,
  para que as propostas reflitam o custo real de cada tipo de obra.

- **Como parceiro**, quero definir minha própria tabela de preços por serviço,
  para que as propostas geradas pela plataforma reflitam minha remuneração correta.

- **Como morador**, quero receber uma proposta com o detalhamento por serviço
  (elétrica: R$ X, hidráulica: R$ Y), para entender o que estou pagando.

---

## 3. Design Técnico

### 3.1 Novo modelo — `ServiceRateCard`

```prisma
model ServiceRateCard {
  id          String      @id @default(cuid())
  tenantId    String
  partnerId   String?     // null = tabela global do tenant
  serviceType ServiceType // enum dos tipos de serviço
  basePrice   Decimal
  priceUnit   PriceUnit   // FIXED | PER_SQM | PER_ROOM
  minPrice    Decimal?
  maxPrice    Decimal?
  active      Boolean     @default(true)
  updatedAt   DateTime    @updatedAt

  tenant  Tenant   @relation(fields: [tenantId], references: [id])
  partner Partner? @relation(fields: [partnerId], references: [id])

  @@unique([tenantId, partnerId, serviceType])  // uma regra por combinação
}

enum ServiceType {
  PAINTING           // Pintura
  FLOORING_NO_DEMO   // Troca de piso sem demolição
  FLOORING_WITH_DEMO // Troca de piso com demolição
  ELECTRICAL         // Elétrica
  PLUMBING           // Hidráulica
  GAS                // Gás
  WATERPROOFING      // Impermeabilização
  AC_SPLIT           // Ar-condicionado
  LAYOUT_CHANGE      // Mudança de layout
  MASONRY_DEMO       // Demolição de alvenaria
  STRUCTURAL         // Impacto estrutural
  FACADE             // Fachada
  WINDOWS_EXTERNAL   // Esquadrias externas
  HEAVY_EQUIPMENT    // Equipamentos pesados
}

enum PriceUnit {
  FIXED     // preço fixo por serviço
  PER_SQM   // por m²
  PER_ROOM  // por cômodo
}
```

### 3.2 Lógica de resolução de preço

Hierarquia de resolução (do mais específico para o mais genérico):

```typescript
// commercial-offers/domain/PriceResolver.ts
export class PriceResolver {
  resolve(
    services: ServiceType[],
    partnerId: string,
    tenantId: string,
    rateCards: ServiceRateCard[]
  ): PriceBreakdown {
    const breakdown: PriceLineItem[] = []

    for (const service of services) {
      // 1. Procura tabela do parceiro específico
      let rate = rateCards.find(r => r.partnerId === partnerId && r.serviceType === service)

      // 2. Fallback para tabela global do tenant
      if (!rate) {
        rate = rateCards.find(r => r.partnerId === null && r.serviceType === service)
      }

      // 3. Fallback para preço base do CommercialPlan
      const price = rate?.basePrice ?? this.defaultPrice

      breakdown.push({ service, price, unit: rate?.priceUnit ?? 'FIXED', rate })
    }

    return {
      items: breakdown,
      subtotal: sum(breakdown.map(i => i.price)),
      // ...riskMultiplier (A2)
    }
  }
}
```

### 3.3 Atualizar `CommercialAgent`

O `CommercialAgent` passa a receber o breakdown itemizado e o inclui na narrativa:

```
## Detalhamento de Custos

| Serviço | Valor |
|---------|-------|
| Elétrica | R$ 2.800,00 |
| Hidráulica | R$ 1.500,00 |
| Troca de piso (com demolição) | R$ 800,00 |
| **Subtotal** | **R$ 5.100,00** |
| Ajuste por risco HIGH (+25%) | R$ 1.275,00 |
| Vistorias incluídas (3) | R$ 600,00 |
| **Total** | **R$ 6.975,00** |
```

### 3.4 Interface do parceiro — configurar tabela de preços

Em `/partner/dashboard` ou `/partner/rates`, nova página:

```
┌──────────────────────────────────────────────────┐
│  Minha Tabela de Preços                          │
│                                                  │
│  Serviço             Preço    Unidade  Ativo     │
│  ─────────────────────────────────────────────   │
│  Elétrica            R$ 2.800  Fixo    ✅ [Editar]│
│  Hidráulica          R$ 1.500  Fixo    ✅ [Editar]│
│  Pintura             —         —       ❌ [Adicionar]│
│  ...                                             │
│                                                  │
│  [+ Adicionar serviço]                           │
│                                                  │
│  ⓘ Serviços sem tabela usam o preço padrão       │
│    do plano: R$ 3.200,00 base                    │
└──────────────────────────────────────────────────┘
```

### 3.5 Interface do admin — tabela global do tenant

Em `/admin/condominiums` ou nova `/admin/pricing`, tabela global editável.

### 3.6 API Routes

```
# Tabela do tenant (admin)
GET  /api/v1/admin/pricing
POST /api/v1/admin/pricing
PATCH /api/v1/admin/pricing/:serviceType

# Tabela do parceiro (self-service)
GET  /api/v1/partners/:partnerId/rates
POST /api/v1/partners/:partnerId/rates
PATCH /api/v1/partners/:partnerId/rates/:serviceType

# Obter breakdown de proposta
GET  /api/v1/cases/:caseId/commercial/quote-preview
```

### 3.7 Seed de tabela padrão

Adicionar ao `seedEssential()` uma tabela de preços padrão baseada nos serviços
da política global (14 tipos de serviço).

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `ServiceRateCard` + enums |
| `commercial-offers/domain/PriceResolver.ts` | Criar |
| `commercial-offers/domain/PriceCalculator.ts` | Integrar `PriceResolver` |
| `commercial-offers/application/CommercialAgent.ts` | Incluir breakdown na narrativa |
| `commercial-offers/application/QuoteCaseUseCase.ts` | Buscar rate cards + usar `PriceResolver` |
| `app/api/v1/admin/pricing/route.ts` | CRUD tabela global |
| `app/api/v1/partners/[partnerId]/rates/route.ts` | CRUD tabela do parceiro |
| `app/(admin)/pricing/page.tsx` | Criar |
| `app/(partner)/partner/rates/page.tsx` | Criar |
| `packages/database/prisma/seed.ts` | Adicionar tabela de preços padrão |

---

## 4. Critérios de Aceite

- [ ] Proposta gerada usa tabela do parceiro (se definida) ou tabela global do tenant
- [ ] Proposta inclui detalhamento por serviço (tabela itemizada)
- [ ] Parceiro pode configurar preço para cada tipo de serviço
- [ ] Admin pode configurar tabela global do tenant
- [ ] Seed cria tabela padrão com os 14 tipos de serviço
- [ ] `PriceResolver` é puro e testável (sem efeitos colaterais)
- [ ] Testes cobrem a hierarquia de resolução (parceiro → global → fallback)
- [ ] Narrativa do `CommercialAgent` inclui o breakdown itemizado

---

## 5. Dependências

- A2 (PriceCalculator com riskLevel) — complementar
- Migration nova

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration + seed | 1.5h |
| `PriceResolver` + testes | 2h |
| Integrar no `QuoteCaseUseCase` e `CommercialAgent` | 1.5h |
| API Routes (admin + parceiro) | 2h |
| UI (tabela admin + tabela parceiro) | 3h |
| **Total** | **~10h (2.5 dias)** |
