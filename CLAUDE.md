# CLAUDE.md — Plataforma SaaS ART/RRT
# Reformas em Unidades Autônomas de Condomínios

> Fonte de verdade do projeto. Leia inteiro antes de qualquer ação.
> Em caso de conflito entre este arquivo e qualquer outro prompt, este arquivo vence.

---

## 1. VISÃO DO PRODUTO

**Nome provisório:** ReformAI (white-label — configurável por tenant)

Plataforma SaaS B2B2C multi-tenant para triagem técnica, análise documental, liberação operacional e encaminhamento para responsável técnico parceiro em reformas de unidades autônomas de condomínios.

**Restrição fundamental:** O sistema não emite ART/RRT. A emissão formal é responsabilidade exclusiva do profissional habilitado parceiro. Todo documento gerado por IA carrega disclaimer explícito sobre isso.

**Posição:** Assistente técnico-operacional de reformas prediais. Orientado por IA, governado por regras determinísticas, auditável em cada decisão.

---

## 2. PRINCÍPIOS DE ENGENHARIA

1. **State-driven.** O caso tem estados explícitos, transições validadas e histórico completo.
2. **IA assistiva, não soberana.** IA interpreta, normaliza, sugere, extrai e gera texto. Não altera estado crítico sem regra determinística ou revisão humana.
3. **Auditabilidade total.** Toda decisão operacional relevante — automática ou humana — é registrada com contexto.
4. **Multi-tenant como fundação.** Não como feature. Isolamento por tenant em toda a modelagem desde o primeiro commit.
5. **DDD com separação de camadas.** `domain` → `application` → `infrastructure` → `interfaces`. Regra de negócio nunca fica em controller, componente UI ou prompt.
6. **Bounded contexts com fronteiras.** Módulos não conhecem os internos uns dos outros. Comunicação por interfaces e eventos de domínio.
7. **Simples, robusto, evolutivo.** Sem overengineering. Sem débito estrutural grave.

---

## 3. STACK TÉCNICA

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend / BFF | Next.js API Routes (MVP) → Fastify standalone (pós-MVP) |
| ORM | Prisma |
| Banco principal | PostgreSQL 16 |
| Fila | BullMQ + Redis |
| Auth | NextAuth.js (JWT, RBAC) |
| Storage | Abstrato via adapter — MinIO local, S3/Supabase em produção |
| IA / LLM | Anthropic Claude API — acesso exclusivo via `LLMProvider` abstrato |
| OCR | Tesseract.js (MVP) → AWS Textract (pós-MVP) |
| RAG | pgvector (extensão PostgreSQL) |
| Validação | Zod em todas as bordas do sistema |
| Testes | Vitest (unitários), Playwright (E2E nas telas críticas) |
| Runtime / Package Manager | **Bun 1.3.6** — usado em todo o monorepo (bun install, bun run, bun test) |

---

## 4. BOUNDED CONTEXTS E MÓDULOS

```
┌─────────────────────────────────────────────────────────────────┐
│                         PLATAFORMA                              │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Identity &  │  │   Tenancy    │  │    Case Intake       │  │
│  │   Access     │  │              │  │  (Triagem via chat)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Work      │  │    Rule      │  │    Document          │  │
│  │Classification│  │    Engine    │  │    Management        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Document    │  │  Document    │  │    Commercial        │  │
│  │Intelligence  │  │ Generation   │  │      Offers          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Partner    │  │  Inspection  │  │  Audit &             │  │
│  │   Network    │  │  Scheduling  │  │  Observability       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Regra:** Nenhum módulo importa internals de outro. Comunicação via interfaces públicas e eventos de domínio.

---

## 5. ESTRUTURA DE PASTAS

```
/
├── apps/
│   └── web/
│       ├── app/                        # Next.js App Router
│       │   ├── (auth)/
│       │   ├── (client)/               # Área do morador
│       │   ├── (partner)/              # Área do parceiro
│       │   ├── (condominium)/          # Painel do condomínio
│       │   └── (admin)/                # Painel administrativo
│       └── src/
│           ├── modules/
│           │   ├── identity/
│           │   │   ├── domain/
│           │   │   ├── application/
│           │   │   └── infrastructure/
│           │   ├── tenancy/
│           │   │   ├── domain/
│           │   │   ├── application/
│           │   │   └── infrastructure/
│           │   ├── case-intake/
│           │   │   ├── domain/
│           │   │   │   ├── entities/
│           │   │   │   │   ├── ReformCase.ts
│           │   │   │   │   ├── CaseStateMachine.ts
│           │   │   │   │   └── ReformScope.ts
│           │   │   │   ├── value-objects/
│           │   │   │   ├── events/
│           │   │   │   └── repositories/    # interfaces apenas
│           │   │   ├── application/
│           │   │   │   └── use-cases/
│           │   │   └── infrastructure/
│           │   │       └── repositories/    # implementações Prisma
│           │   ├── work-classification/
│           │   ├── rule-engine/
│           │   │   ├── domain/
│           │   │   │   ├── entities/
│           │   │   │   │   ├── Policy.ts
│           │   │   │   │   ├── Rule.ts
│           │   │   │   │   └── PolicyEvaluationResult.ts
│           │   │   │   └── evaluator/
│           │   │   │       └── DeterministicEvaluator.ts
│           │   │   ├── application/
│           │   │   └── infrastructure/
│           │   ├── document-management/
│           │   ├── document-intelligence/
│           │   │   ├── domain/
│           │   │   │   └── LLMProvider.ts   # interface — nunca importa SDK
│           │   │   └── infrastructure/
│           │   │       └── llm/
│           │   │           └── AnthropicProvider.ts
│           │   ├── document-generation/
│           │   ├── commercial-offers/
│           │   ├── partner-network/
│           │   ├── inspection-scheduling/
│           │   └── audit/
│           ├── shared/
│           │   ├── types/
│           │   ├── schemas/                 # Zod schemas compartilhados
│           │   ├── events/                  # Event bus
│           │   └── errors/
│           └── infrastructure/
│               ├── database/               # Prisma client singleton
│               ├── storage/
│               │   ├── StorageAdapter.ts   # interface
│               │   ├── MinIOAdapter.ts
│               │   └── S3Adapter.ts
│               ├── queue/
│               │   └── workers/
│               │       └── document.worker.ts
│               └── auth/
├── packages/
│   ├── database/                           # schema.prisma + migrations + seed
│   └── templates/                          # Templates em Markdown
│       ├── relatorio-analise.md
│       ├── memorial-descritivo.md
│       ├── cronograma-basico.md
│       ├── parecer-pendencias.md
│       ├── proposta-comercial.md
│       └── ordem-servico.md
├── docs/
├── CLAUDE.md
├── SYSTEM-PROMPT.md
└── docker-compose.yml
```

---

## 6. STATE MACHINE DO CASO

### Estados

```typescript
enum CaseStatus {
  DRAFT                    = 'draft',
  AWAITING_SCOPE_DETAILS   = 'awaiting_scope_details',
  SCOPE_CLASSIFIED         = 'scope_classified',
  AWAITING_DOCUMENTS       = 'awaiting_documents',
  DOCUMENTS_UNDER_REVIEW   = 'documents_under_review',
  PENDING_CORRECTIONS      = 'pending_corrections',
  ELIGIBLE_FOR_RELEASE     = 'eligible_for_release',
  RELEASED_WITH_CONDITIONS = 'released_with_conditions',
  HUMAN_REVIEW_REQUIRED    = 'human_review_required',
  COMMERCIAL_OFFER_SENT    = 'commercial_offer_sent',
  AWAITING_PAYMENT         = 'awaiting_payment',
  ASSIGNED_TO_PARTNER      = 'assigned_to_partner',
  ART_RRT_PENDING          = 'art_rrt_pending',
  INSPECTIONS_SCHEDULED    = 'inspections_scheduled',
  IN_EXECUTION             = 'in_execution',
  CONCLUDED                = 'concluded',
  ARCHIVED                 = 'archived',
}
```

### Mapa de transições válidas

```
DRAFT
  → AWAITING_SCOPE_DETAILS

AWAITING_SCOPE_DETAILS
  → SCOPE_CLASSIFIED
  → HUMAN_REVIEW_REQUIRED

SCOPE_CLASSIFIED
  → AWAITING_DOCUMENTS
  → COMMERCIAL_OFFER_SENT
  → ELIGIBLE_FOR_RELEASE
  → HUMAN_REVIEW_REQUIRED

AWAITING_DOCUMENTS
  → DOCUMENTS_UNDER_REVIEW

DOCUMENTS_UNDER_REVIEW
  → ELIGIBLE_FOR_RELEASE
  → RELEASED_WITH_CONDITIONS
  → PENDING_CORRECTIONS
  → HUMAN_REVIEW_REQUIRED

PENDING_CORRECTIONS
  → DOCUMENTS_UNDER_REVIEW
  → HUMAN_REVIEW_REQUIRED

ELIGIBLE_FOR_RELEASE
  → CONCLUDED
  → ASSIGNED_TO_PARTNER

RELEASED_WITH_CONDITIONS
  → ASSIGNED_TO_PARTNER

HUMAN_REVIEW_REQUIRED
  → ELIGIBLE_FOR_RELEASE
  → RELEASED_WITH_CONDITIONS
  → PENDING_CORRECTIONS
  → ARCHIVED

COMMERCIAL_OFFER_SENT
  → AWAITING_PAYMENT
  → ARCHIVED

AWAITING_PAYMENT
  → ASSIGNED_TO_PARTNER

ASSIGNED_TO_PARTNER
  → ART_RRT_PENDING
  → COMMERCIAL_OFFER_SENT

ART_RRT_PENDING
  → INSPECTIONS_SCHEDULED

INSPECTIONS_SCHEDULED
  → IN_EXECUTION

IN_EXECUTION
  → CONCLUDED
```

### Regras obrigatórias de transição

1. Toda transição é registrada em `CaseTransitionLog` com `fromStatus`, `toStatus`, `triggeredBy`, `reason` e `timestamp`.
2. Transição inválida lança `InvalidTransitionError`. Nunca silenciosa.
3. **Casos HIGH ou CRITICAL nunca vão para `ELIGIBLE_FOR_RELEASE` sem passar por `HUMAN_REVIEW_REQUIRED`.**
4. `CaseStateMachine` é entidade de domínio pura — não existe em controller, route ou componente.

```typescript
// case-intake/domain/entities/CaseStateMachine.ts
class CaseStateMachine {
  private static readonly VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = { /* mapa acima */ }

  constructor(private current: CaseStatus, private riskLevel: RiskLevel | null) {}

  transition(to: CaseStatus, context: TransitionContext): CaseStatus {
    if (!this.isValid(this.current, to)) {
      throw new InvalidTransitionError(this.current, to)
    }
    this.assertBusinessRules(to, context)
    return to
  }

  private assertBusinessRules(to: CaseStatus, ctx: TransitionContext) {
    if (
      to === CaseStatus.ELIGIBLE_FOR_RELEASE &&
      (this.riskLevel === 'HIGH' || this.riskLevel === 'CRITICAL') &&
      ctx.previousStatus !== CaseStatus.HUMAN_REVIEW_REQUIRED
    ) {
      throw new BusinessRuleViolationError('HIGH/CRITICAL cases require human review before release')
    }
  }
}
```

---

## 7. MOTOR DE REGRAS (Rule Engine)

### Princípio

Módulo de domínio independente. Avalia políticas contra o escopo da obra. Retorna resultado determinístico e explicável. Nenhuma lógica de classificação fica em prompt de IA.

**Fluxo:**
```
ReformScope + Policy → DeterministicEvaluator → PolicyEvaluationResult
```

### Entidades de domínio

```typescript
// rule-engine/domain/entities/Policy.ts
interface Policy {
  id: string
  tenantId: string | null       // null = política global
  condominiumId: string | null
  name: string
  rules: Rule[]
  version: number
  effectiveFrom: Date
  active: boolean
}

// rule-engine/domain/entities/Rule.ts
interface Rule {
  id: string
  policyId: string
  name: string
  description: string           // explicação em linguagem simples (exibida no resultado)
  condition: RuleCondition      // { field: keyof ReformScope, operator, value }
  action: RuleAction            // { riskDelta, requiresART, requiresHumanReview, mandatoryInspection }
  priority: number
  active: boolean
  version: number
}

// rule-engine/domain/entities/PolicyEvaluationResult.ts
interface PolicyEvaluationResult {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  triageScore: number
  requiresART: boolean | 'uncertain'
  requiresHumanReview: boolean
  mandatoryInspection: boolean
  recommendedStatus: CaseStatus
  triggeredRules: Array<{ ruleId: string; ruleName: string; reason: string }>
}
```

### Avaliador determinístico

```typescript
// rule-engine/domain/evaluator/DeterministicEvaluator.ts
class DeterministicEvaluator {
  evaluate(scope: ReformScope, policy: Policy): PolicyEvaluationResult {
    let score = 0
    const triggered: TriggeredRule[] = []

    const sorted = policy.rules
      .filter(r => r.active)
      .sort((a, b) => a.priority - b.priority)

    for (const rule of sorted) {
      if (this.matches(rule.condition, scope)) {
        score += rule.action.riskDelta ?? 0
        triggered.push(rule)
      }
    }

    const riskLevel = this.scoreToRisk(Math.min(score, 100))
    return {
      riskLevel,
      triageScore: Math.min(score, 100),
      requiresART: triggered.some(r => r.action.requiresART),
      requiresHumanReview: triggered.some(r => r.action.requiresHumanReview),
      mandatoryInspection: triggered.some(r => r.action.mandatoryInspection),
      recommendedStatus: this.resolveStatus(riskLevel, triggered),
      triggeredRules: triggered.map(r => ({ ruleId: r.id, ruleName: r.name, reason: r.description })),
    }
  }

  private scoreToRisk(score: number): RiskLevel {
    if (score <= 20) return 'LOW'
    if (score <= 45) return 'MEDIUM'
    if (score <= 70) return 'HIGH'
    return 'CRITICAL'
  }
}
```

### Regras padrão (seed)

| Serviço | riskDelta | requiresART | requiresHumanReview | mandatoryInspection |
|---------|-----------|-------------|----------------------|---------------------|
| Pintura simples | +5 | false | false | false |
| Troca de piso sem demolição | +10 | false | false | false |
| Troca de piso com demolição | +25 | true | false | false |
| Elétrica | +30 | true | false | false |
| Hidráulica | +30 | true | false | false |
| Gás | +40 | true | false | true |
| Impermeabilização | +35 | true | false | true |
| Ar-condicionado (split) | +15 | false | false | false |
| Mudança de layout | +20 | true | false | false |
| Demolição de alvenaria | +40 | true | true | false |
| Impacto estrutural/prumadas | +60 | true | true | true |
| Fachada | +45 | true | true | false |
| Esquadrias externas | +20 | true | false | false |
| Equipamentos fixos pesados | +25 | true | false | false |

---

## 8. MODELAGEM DE DADOS (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ─── TENANCY ──────────────────────────────────────────────────

model Tenant {
  id           String     @id @default(cuid())
  name         String
  slug         String     @unique
  type         TenantType
  logoUrl      String?
  primaryColor String?
  active       Boolean    @default(true)
  createdAt    DateTime   @default(now())

  condominiums Condominium[]
  users        User[]
  policies     Policy[]
  partners     Partner[]
  plans        CommercialPlan[]
}

enum TenantType { ADMIN ADMINISTRADORA STANDALONE }

model Condominium {
  id        String   @id @default(cuid())
  tenantId  String
  name      String
  cnpj      String?
  address   String
  city      String
  state     String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  tenant       Tenant             @relation(fields: [tenantId], references: [id])
  units        Unit[]
  cases        ReformCase[]
  policyLinks  CondominiumPolicy[]
}

model Unit {
  id            String  @id @default(cuid())
  condominiumId String
  identifier    String
  floor         String?
  ownerName     String?
  ownerEmail    String?
  ownerPhone    String?

  condominium Condominium  @relation(fields: [condominiumId], references: [id])
  cases       ReformCase[]
}

// ─── IDENTITY ─────────────────────────────────────────────────

model User {
  id             String    @id @default(cuid())
  tenantId       String
  email          String    @unique
  name           String
  role           UserRole
  active         Boolean   @default(true)
  lgpdConsentAt  DateTime?
  createdAt      DateTime  @default(now())

  tenant    Tenant       @relation(fields: [tenantId], references: [id])
  cases     ReformCase[] @relation("ClientCases")
  auditLogs AuditLog[]
}

enum UserRole { SUPER_ADMIN ADMIN CONDOMINIUM CLIENT PARTNER }

// ─── CASE ─────────────────────────────────────────────────────

model ReformCase {
  id               String     @id @default(cuid())
  protocol         String     @unique
  tenantId         String
  condominiumId    String
  unitId           String
  clientId         String
  status           CaseStatus @default(DRAFT)
  riskLevel        RiskLevel?
  requiresART      Boolean?
  triageScore      Int?
  reformScope      Json?      // ReformScope estruturado
  evaluationResult Json?      // PolicyEvaluationResult completo
  partnerId        String?
  commercialPlanId String?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  condominium Condominium @relation(fields: [condominiumId], references: [id])
  unit        Unit        @relation(fields: [unitId], references: [id])
  client      User        @relation("ClientCases", fields: [clientId], references: [id])
  partner     Partner?    @relation(fields: [partnerId], references: [id])

  messages    ChatMessage[]
  documents   Document[]
  reports     Report[]
  inspections Inspection[]
  transitions CaseTransitionLog[]
  auditLogs   AuditLog[]
}

enum CaseStatus {
  DRAFT AWAITING_SCOPE_DETAILS SCOPE_CLASSIFIED
  AWAITING_DOCUMENTS DOCUMENTS_UNDER_REVIEW PENDING_CORRECTIONS
  ELIGIBLE_FOR_RELEASE RELEASED_WITH_CONDITIONS HUMAN_REVIEW_REQUIRED
  COMMERCIAL_OFFER_SENT AWAITING_PAYMENT ASSIGNED_TO_PARTNER
  ART_RRT_PENDING INSPECTIONS_SCHEDULED IN_EXECUTION
  CONCLUDED ARCHIVED
}

enum RiskLevel { LOW MEDIUM HIGH CRITICAL }

model CaseTransitionLog {
  id          String     @id @default(cuid())
  caseId      String
  fromStatus  CaseStatus
  toStatus    CaseStatus
  triggeredBy String     // "user:{id}" | "system" | "ai" | "reviewer:{id}"
  reason      String?
  metadata    Json?
  createdAt   DateTime   @default(now())

  case ReformCase @relation(fields: [caseId], references: [id])
}

// ─── CHAT ─────────────────────────────────────────────────────

model ChatMessage {
  id        String      @id @default(cuid())
  caseId    String
  role      MessageRole
  content   String
  metadata  Json?
  createdAt DateTime    @default(now())

  case ReformCase @relation(fields: [caseId], references: [id])
}

enum MessageRole { USER ASSISTANT SYSTEM }

// ─── DOCUMENTS ────────────────────────────────────────────────

model Document {
  id              String       @id @default(cuid())
  caseId          String
  tenantId        String
  type            DocumentType
  version         Int          @default(1)
  fileName        String
  storageKey      String       // Chave no storage — nunca URL pública direta
  mimeType        String
  status          DocStatus    @default(PENDING)
  origin          DocOrigin
  extractedText   String?
  extractedData   Json?
  inconsistencies Json?
  pendencies      Json?
  uploadedAt      DateTime     @default(now())

  case ReformCase @relation(fields: [caseId], references: [id])
}

enum DocumentType {
  ART_RRT MEMORIAL PROJECT SCHEDULE WORKFORCE
  WORKER_DOCS AUTHORIZATION PHOTOS INSPECTION_REPORT ART_RRT_FINAL OTHER
}

enum DocStatus { PENDING PROCESSING VALID VALID_WITH_CAVEATS INVALID MISSING }
enum DocOrigin { CLIENT PARTNER SYSTEM }

// ─── REPORTS ──────────────────────────────────────────────────

model Report {
  id          String     @id @default(cuid())
  caseId      String
  tenantId    String
  type        ReportType
  content     String
  version     Int        @default(1)
  generatedAt DateTime   @default(now())

  case ReformCase @relation(fields: [caseId], references: [id])
}

enum ReportType {
  ANALYSIS TECHNICAL_OPINION COMMERCIAL_PROPOSAL
  SERVICE_ORDER INSPECTION_SUMMARY RELEASE_OPINION
}

// ─── RULE ENGINE ──────────────────────────────────────────────

model Policy {
  id            String   @id @default(cuid())
  tenantId      String?
  name          String
  description   String?
  version       Int      @default(1)
  effectiveFrom DateTime @default(now())
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  tenant       Tenant?            @relation(fields: [tenantId], references: [id])
  rules        Rule[]
  condominiums CondominiumPolicy[]
}

model Rule {
  id          String  @id @default(cuid())
  policyId    String
  name        String
  description String
  condition   Json
  action      Json
  priority    Int
  active      Boolean @default(true)
  version     Int     @default(1)

  policy Policy @relation(fields: [policyId], references: [id])
}

model CondominiumPolicy {
  condominiumId String
  policyId      String
  overrides     Json?

  condominium Condominium @relation(fields: [condominiumId], references: [id])
  policy      Policy      @relation(fields: [policyId], references: [id])

  @@id([condominiumId, policyId])
}

// ─── PARTNERS ─────────────────────────────────────────────────

model Partner {
  id          String      @id @default(cuid())
  tenantId    String
  userId      String      @unique
  creaNumber  String
  type        PartnerType
  specialties String[]
  cities      String[]
  states      String[]
  basePrice   Decimal
  rating      Decimal?
  slaHours    Int?
  active      Boolean     @default(true)
  createdAt   DateTime    @default(now())

  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  cases       ReformCase[]
  inspections Inspection[]
}

enum PartnerType { ENGINEER ARCHITECT }

// ─── INSPECTIONS ──────────────────────────────────────────────

model Inspection {
  id          String           @id @default(cuid())
  caseId      String
  partnerId   String
  tenantId    String
  type        InspectionType
  scheduledAt DateTime?
  completedAt DateTime?
  status      InspectionStatus @default(SCHEDULED)
  notes       String?
  photoKeys   String[]
  reportId    String?
  extraCharge Decimal?

  case    ReformCase @relation(fields: [caseId], references: [id])
  partner Partner    @relation(fields: [partnerId], references: [id])
}

enum InspectionType   { INITIAL INTERMEDIATE FINAL EXTRA CRITICAL_SYSTEM }
enum InspectionStatus { SCHEDULED COMPLETED CANCELLED RESCHEDULED }

// ─── COMMERCIAL ───────────────────────────────────────────────

model CommercialPlan {
  id                   String  @id @default(cuid())
  tenantId             String
  name                 String
  description          String
  basePrice            Decimal
  extraInspectionPrice Decimal
  includes             Json
  active               Boolean @default(true)

  tenant Tenant @relation(fields: [tenantId], references: [id])
}

// ─── AUDIT ────────────────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  tenantId    String
  caseId      String?
  userId      String?
  action      String   // "case.status.changed" | "document.uploaded" | "ai.classification"
  triggeredBy String   // "user:{id}" | "system" | "ai"
  details     Json?
  aiReasoning Json?
  createdAt   DateTime @default(now())

  case ReformCase? @relation(fields: [caseId], references: [id])
  user User?       @relation(fields: [userId], references: [id])
}
```

---

## 9. CAMADA DE IA

### Regra fundamental

```
IA sugere → Rule Engine valida → CaseStateMachine executa
```

A IA nunca chama `stateMachine.transition()`. Ela retorna sugestão. O application service decide.

### Abstração LLM

```typescript
// document-intelligence/domain/LLMProvider.ts
interface LLMProvider {
  complete(prompt: string, options?: CompletionOptions): Promise<string>
  stream(prompt: string, options?: CompletionOptions): AsyncIterable<string>
}
// AnthropicProvider.ts fica em infrastructure/llm/ — único lugar que importa a SDK
```

### Agentes (Application Services)

| Agente | Responsabilidade | Output validado por Zod |
|--------|-----------------|--------------------------|
| `TriageAgent` | Conduz chat, coleta e normaliza `ReformScope` | `ReformScopeSchema` |
| `DocumentAgent` | Extrai dados dos documentos | `DocumentExtractionSchema` |
| `AnalysisAgent` | Valida coerência cross-documents | `DocumentAnalysisSchema` |
| `ReportAgent` | Gera texto de relatórios via template | `string` (Markdown) |
| `CommercialAgent` | Calcula preço e gera proposta | `CommercialQuoteSchema` |

**Modelo:** `claude-sonnet-4-20250514` — fixado em `AnthropicProvider`. Não usar outro sem decisão documentada.

---

## 10. PIPELINE DOCUMENTAL

```
upload
  → validar mime type
  → salvar no storage (storageKey no banco)
  → enfileirar no BullMQ
    → worker: extrair texto (OCR)
    → worker: extrair dados estruturados (LLM)
    → worker: validar coerência (LLM + regras)
    → worker: atualizar status do Document
    → worker: verificar checklist do caso
    → worker: emitir evento ChecklistUpdated
      → application: recalcular status do caso
```

Cada etapa é idempotente. Em falha, o worker reprocessa.

---

## 11. STORAGE

```typescript
// infrastructure/storage/StorageAdapter.ts
interface StorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}
```

**Estrutura de chaves:**
```
tenants/{tenantId}/condominiums/{condominiumId}/units/{unitId}/cases/{caseId}/
  incoming/{documentId}/{fileName}
  reports/{reportId}/{fileName}
  inspections/{inspectionId}/photos/{photoId}
  final/{documentId}/{fileName}
```

**Signed URLs expiram em 1 hora. Nenhuma URL permanente é exposta.**

---

## 12. APIs

**Convenções:** Prefixo `/api/v1/`. Bearer JWT obrigatório. Middleware injeta `tenantId` e `userId` validados. Toda query ao banco filtra por `tenantId`.

```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

POST   /api/v1/cases
GET    /api/v1/cases                          ?status=&condominiumId=
GET    /api/v1/cases/:id
PATCH  /api/v1/cases/:id/status              # apenas revisores humanos

POST   /api/v1/cases/:id/messages
GET    /api/v1/cases/:id/messages
GET    /api/v1/cases/:id/messages/stream     # SSE

POST   /api/v1/cases/:id/documents
GET    /api/v1/cases/:id/documents
GET    /api/v1/cases/:id/documents/:id/url  # signed URL
POST   /api/v1/cases/:id/documents/analyze

POST   /api/v1/cases/:id/reports/generate
GET    /api/v1/cases/:id/reports
GET    /api/v1/cases/:id/reports/:id/url

POST   /api/v1/cases/:id/commercial/quote
POST   /api/v1/cases/:id/commercial/accept

GET    /api/v1/partners
POST   /api/v1/partners
PATCH  /api/v1/partners/:id
GET    /api/v1/partners/:id/cases
POST   /api/v1/partners/:id/cases/:caseId/accept
POST   /api/v1/partners/:id/cases/:caseId/decline

GET    /api/v1/cases/:id/inspections
POST   /api/v1/cases/:id/inspections
PATCH  /api/v1/cases/:id/inspections/:id
POST   /api/v1/cases/:id/inspections/:id/complete

GET    /api/v1/admin/dashboard
GET    /api/v1/admin/review-queue
POST   /api/v1/admin/review/:caseId
GET    /api/v1/admin/policies
POST   /api/v1/admin/policies
PATCH  /api/v1/admin/policies/:id/rules
GET    /api/v1/admin/templates
PATCH  /api/v1/admin/templates/:id
```

---

## 13. REGRAS DE NEGÓCIO CRÍTICAS

1. **ART/RRT nunca é emitida pela plataforma.**
2. **HIGH/CRITICAL nunca vão para `ELIGIBLE_FOR_RELEASE` sem `HUMAN_REVIEW_REQUIRED` antes.**
3. **Transição inválida lança exceção. Nunca silenciosa.**
4. **Toda decisão automática é logada em `AuditLog` com `aiReasoning`.**
5. **Impermeabilização exige vistoria antes de cobertura.** Não bypassável por config.
6. **Pacote comercial inclui mínimo 3 vistorias.** Extras são cobradas à parte.
7. **Upload sempre via backend.** Nunca direto ao storage pelo cliente.
8. **Signed URLs expiram em 1 hora.**
9. **Toda query ao banco tem `tenantId` como filtro obrigatório.**
10. **Todo relatório gerado por IA inclui disclaimer** de responsabilidade técnica.
11. **IA sugere → Rule Engine valida → StateMachine executa.** Essa ordem não é negociável.

---

## 14. VARIÁVEIS DE AMBIENTE

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/reformai
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=
STORAGE_ADAPTER=minio
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=reformai
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 15. USUÁRIOS DE TESTE (seed)

| Email | Senha | Role |
|-------|-------|------|
| admin@demo.com | senha123 | SUPER_ADMIN |
| sindico@demo.com | senha123 | CONDOMINIUM |
| morador@demo.com | senha123 | CLIENT |
| parceiro@demo.com | senha123 | PARTNER |

---

## 16. COMANDOS

```bash
docker-compose up -d        # PostgreSQL + Redis + MinIO
bun run db:migrate          # prisma migrate dev
bun run db:seed             # prisma db seed
bun run dev                 # Next.js dev server
bun run test                # Vitest
bun run test:e2e            # Playwright
```

---

## 17. NOTAS PARA O CLAUDE CODE

- **Runtime: Bun 1.3.6.** Usar `bun` em todos os comandos. Nunca `npm`, `npx` ou `yarn`.
- **Regra de negócio fica em `domain/`.** Nunca em controller, route handler, componente ou prompt.
- **`CaseStateMachine` é entidade de domínio pura.** Não é helper, não é enum solto.
- **`DeterministicEvaluator` não chama IA.** É puro, determinístico, testável.
- **`LLMProvider` é interface de domínio.** `AnthropicProvider` é infraestrutura. O domínio não conhece Anthropic.
- **Toda query ao banco filtra por `tenantId`.** Sem exceção.
- **Toda saída da IA é validada por Zod antes de ser usada.**
- **Antes de implementar qualquer coisa: proponha, liste hipóteses, aguarde confirmação.**
