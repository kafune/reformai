# APP-STATE.md — Estado Atual da Aplicação
# Plataforma SaaS ART/RRT — "ReformAI"

> Snapshot do estado real do código em **2026-05-19** (branch `main`, commit `c3e10d6`).
> Documento descritivo do que **está implementado** — não é especificação.
> A especificação/fonte-de-verdade é o `CLAUDE.md`. Onde os dois divergem, este
> arquivo registra a divergência explicitamente (ver §20).

---

## 1. RESUMO EXECUTIVO

A plataforma está em estado **coeso e quase completo para MVP**. O fluxo central
— triagem por chat → classificação determinística → documentos → revisão humana
→ proposta comercial → atribuição a parceiro → vistorias → conclusão — está todo
implementado de ponta a ponta, com painéis para os 4 perfis de usuário
(morador, síndico, parceiro, admin) e um painel adicional de superadmin.

**O que funciona:**
- Monorepo Bun + Turborepo, Next.js 14 App Router, Prisma + PostgreSQL 16, BullMQ + Redis, MinIO/S3.
- DDD com 10 bounded contexts; camadas `domain`/`application`/`infrastructure` respeitadas na maior parte.
- `CaseStateMachine` determinística, `DeterministicEvaluator` puro, 5 agentes de IA com saída validada por Zod.
- Pipeline documental completo: 6 passos idempotentes em BullMQ (OCR → extração → validação → status → checklist → evento).
- 4 migrations aplicadas, seed essencial + seed demo (13 casos pelo ciclo de vida).
- Design system "Concreto Verde" (18 componentes UI, white-label via CSS vars).
- 12 arquivos de teste unitário (Vitest) + 5 specs E2E (Playwright).
- Dockerfiles para web e worker; deploy em produção via Dokploy/Swarm.

**O que falta / está frágil:**
- Sem fluxo de recuperação de senha; botões mortos na tela de login.
- Sem `middleware.ts` global — autorização reimplementada rota a rota; alguns POSTs só checam "existe sessão".
- Bug funcional: matching de parceiro por especialidade (gás/estrutural) nunca dispara (campo `servicesNeeded` inexistente).
- `CLAUDE.md` está **defasado** vs o schema e as rotas reais (ver §20).
- Débito transitório: branch legado SHA-256 de senha; drift de versão do Bun.

---

## 2. STACK E ESTRUTURA

| Camada | Implementado |
|--------|--------------|
| Runtime / PM | **Bun 1.3.10** (`packageManager` no `package.json` e Dockerfiles — CLAUDE.md diz 1.3.6) |
| Monorepo | Turborepo (`turbo.json`); workspaces `apps/*`, `packages/*` |
| Frontend / BFF | Next.js 14.2.18 (App Router), React 18.3, TypeScript 5.6 strict |
| Estilo | Tailwind CSS 3.4 + design system "Concreto Verde" (tokens `--rai-*`) |
| ORM / Banco | Prisma 6.6 + PostgreSQL 16 (`pgvector/pgvector:pg16`) |
| Fila | BullMQ 5.76 + Redis 7 (ioredis) |
| Auth | NextAuth.js 4.24 (JWT, CredentialsProvider) |
| Storage | Adapter abstrato — MinIO 8 / AWS S3 (`@aws-sdk/client-s3`) |
| IA / LLM | `@anthropic-ai/sdk` 0.32 — modelo fixo `claude-sonnet-4-20250514` |
| OCR | `pdf-parse` 2.4 (PDF) + `tesseract.js` 7 (imagens, idioma `por`) |
| Validação | Zod 3.23 nas bordas |
| QR Code | `qrcode.react` 4.2 |
| Testes | Vitest 2.1 (unit), Playwright 1.60 (E2E, Chromium) |

**Estrutura real (resumida):**

```
/
├── apps/web/
│   ├── app/                      # App Router (páginas + API)
│   │   ├── login/  register/     # auth pública + autocadastro
│   │   ├── cases/                # área do morador (sem route-group "(client)")
│   │   ├── (admin)/              # dashboard, condominiums, partners, policies,
│   │   │                         #   review-queue, skills, tenants, users
│   │   ├── (condominium)/sindico # dashboard, cases, cadastro (QR)
│   │   ├── (partner)/partner     # dashboard, cases, inspections
│   │   └── api/                  # /api/auth/[...nextauth], /api/health,
│   │                             #   /api/v1/** (ver §9)
│   ├── src/
│   │   ├── modules/              # 10 bounded contexts (domain/app/infra)
│   │   ├── infrastructure/       # auth, database, queue, storage
│   │   ├── interfaces/           # components/ui (design system), http/respond
│   │   ├── shared/               # errors, events (só tipos), schemas, logger, cn
│   │   └── workers/              # document-worker.ts (entrypoint standalone)
│   └── tests/e2e/                # specs Playwright + helpers
├── packages/
│   ├── database/                 # schema.prisma, 4 migrations, seed, policies
│   └── templates/                # engine.ts + 6 templates .md
├── docs/agent-teams/             # planejamento de squads (m2/m3)
├── CLAUDE.md  SYSTEM-PROMPT.md  APP-STATE.md
├── AUDIT-RESPONSIVIDADE.md  RELATORIO-APP-ANTIGO.md
└── docker-compose.yml  Dockerfile.web  Dockerfile.worker
```

---

## 3. MODELO DE DADOS (Prisma — estado real)

Schema em `packages/database/prisma/schema.prisma`. **4 migrations aplicadas:**
`20260419033213_init`, `..._add_user_condominium_notifications_reportskill`,
`..._add_reporttype_values`, `20260518022819_add_unit_block`.

**Modelos:** `Tenant`, `Condominium`, `Unit`, `User`, `ReformCase`,
`CaseTransitionLog`, `ChatMessage`, `Document`, `Report`, `ReportSkill`,
`Policy`, `Rule`, `CondominiumPolicy`, `Partner`, `Inspection`,
`CommercialPlan`, `AuditLog`, `Notification`.

**Diferenças do schema real vs CLAUDE.md §8 (o CLAUDE.md está defasado):**

| Item | CLAUDE.md §8 | Schema real |
|------|--------------|-------------|
| `User.passwordHash` | ausente | **existe** (hash scrypt) |
| `User.condominiumId` | ausente | **existe** (relação `CondominiumUsers`) |
| `UserRole` | 5 valores | **6** — inclui `MANAGER` |
| `Unit.floor` / `Unit.block` | só `floor` | tem `floor` **e** `block` |
| `Notification` (modelo) | ausente | **existe** (in-app, índice `[userId, read]`) |
| `ReportSkill` (modelo) | ausente | **existe** (`type ReportType @unique`, `skillId`) |
| `ReportType` | 6 valores | **8** — `+ MEMORIAL_DESCRITIVO`, `+ CRONOGRAMA` |
| `Report.skillFileId` | ausente | **existe** |
| `Tenant.cases` (back-relation) | ausente | **existe** |

`generator client` tem `output = "../generated/client"` (cliente gerado em
`packages/database/generated/client/`, versionado no repo).

---

## 4. BOUNDED CONTEXTS — ESTADO POR MÓDULO

Todos em `apps/web/src/modules/`. Resumo do estado real:

### case-intake — ✅ implementado
- `domain/entities/CaseStateMachine.ts` — entidade pura; `VALID_TRANSITIONS` bate com CLAUDE.md §6; `assertBusinessRules()` aplica a trava HIGH/CRITICAL → `ELIGIBLE_FOR_RELEASE`.
- `application/TriageAgent.ts` — **único agente com tool-use nativo da Anthropic** (`submit_scope`).
- `application/ClassifyScopeUseCase.ts` — orquestra `ReformScopeSchema` → `PrismaPolicyRepository` → `DeterministicEvaluator` → `CaseStateMachine`.
- `application/CreateCaseUseCase.ts` — ⚠️ faz a transição `DRAFT → AWAITING_SCOPE_DETAILS` direto no Prisma, **sem passar pela `CaseStateMachine`** (única violação do §17).
- Testes: `CaseStateMachine.test.ts`, `TriageAgent.test.ts`.

### rule-engine — ✅ implementado
- `domain/DeterministicEvaluator.ts` — puro, sem IA; soma `riskDelta`, faz OR dos flags, teto 100. Thresholds: ≤20 LOW, ≤45 MEDIUM, ≤70 HIGH, senão CRITICAL.
- `domain/types.ts` — interfaces (não há classes `Policy`/`Rule` como esboçado no CLAUDE.md §7).
- `infrastructure/PrismaPolicyRepository.ts` — `resolveForCondominium()` com fallback para política de tenant ou global.
- ⚠️ `CondominiumPolicy.overrides` é lido mas **nunca aplicado**.
- Teste: `DeterministicEvaluator.test.ts` (só 3 casos — leve para um módulo crítico).

### commercial-offers — ✅ implementado
- `domain/PriceCalculator.ts` — `calculatePrice()` puro; garante mínimo 3 vistorias (`Math.max(3, ...)`).
- ⚠️ recebe `riskLevel` e `mandatoryInspection` mas **não os usa** — preço = `basePrice + extras × unitPrice`.
- `application/CommercialAgent.ts` — Claude (texto, sem tool-use), `temp 0.3`; JSON em `<offer>`; fallback determinístico, nunca lança.
- ⚠️ `QuoteCaseUseCase` tem try/catch redundante (o agente já nunca lança).
- Testes: `PriceCalculator.test.ts`, `QuoteCaseUseCase.test.ts`.

### document-generation — ✅ implementado
- `application/ClaudeReportAgent.ts` — renderiza template + enriquecimento opcional por IA (`enrichWithAI`).
- `application/GenerateReportUseCase.ts` — mapeia `ReportType → TemplateId`, persiste `Report`, faz upload `.md` no storage.
- ⚠️ `buildBaseVariables` deixa muitas variáveis de template como `undefined` — relatórios saem esqueléticos para esses tipos.
- ✅ `ReportContentSchema` **força o disclaimer** (`refine`/`includes`) — lança se ausente (CLAUDE.md §13.10).
- Teste: `GenerateReportUseCase.test.ts`.

### document-intelligence — ✅ implementado
- `domain/LLMProvider.ts` — interface (`complete`, `stream`, `completeWithTools`, `streamComplete`).
- `infrastructure/llm/AnthropicProvider.ts` — **único arquivo que importa o SDK**; modelo fixo `claude-sonnet-4-20250514`.
- `application/ClaudeDocumentAgent.ts` — extração por tipo de documento; JSON em `<extraction>`; em falha retorna `failure()` (confiança 0), **não lança**.
- `application/ClaudeAnalysisAgent.ts` — coerência cross-document; JSON em `<analysis>`; ⚠️ em falha **lança `ValidationError`** (inconsistente com os outros agentes).
- Teste: `ClaudeDocumentAgent.test.ts`.

### document-management — ✅ implementado
- `application/UploadDocumentUseCase.ts` — valida MIME (`pdf/jpeg/png/webp`), sobe ao storage, cria `Document`, enfileira job OCR.
- `domain/DocumentChecklist.ts` — `evaluate()` por risco: LOW nada; MEDIUM `AUTHORIZATION`; HIGH `+ ART_RRT, MEMORIAL`; CRITICAL `+ PROJECT, SCHEDULE, WORKFORCE`.
- `application/GetDocumentUrlUseCase.ts` — signed URL, TTL 3600s.
- Teste: `UploadDocumentUseCase.test.ts`.

### identity — ⚠️ implementado, fino
- Só `application/RegisterClientUseCase.ts` (autocadastro de morador). Sem entidade `User`, sem repositório, usa `prisma` direto. Sem testes.
- Cria/acha `Unit` por `block + identifier`; grava `lgpdConsentAt = now()`; hash de senha.
- ⚠️ Não usa transação — create de unit + create de user separados (falha parcial deixa unit órfã).

### inspection-scheduling — ✅ implementado
- `domain/InspectionRules.ts` — sequência `INITIAL → INTERMEDIATE? → CRITICAL_SYSTEM? → FINAL`; aplica a regra "Impermeabilização exige INTERMEDIATE concluída antes da FINAL" (CLAUDE.md §13.5, não bypassável).
- Use cases: `Schedule`, `Complete`, `GetCaseInspections` — calculam `extraCharge`, transicionam via `CaseStateMachine`, tudo em `$transaction`.
- ⚠️ Os use cases chamam `prisma.inspection` direto; métodos `create/updateScheduled/complete` do repositório viraram código morto.
- Teste: `InspectionRules.test.ts` (maior suíte — 353 linhas).

### notifications — ✅ implementado, mínimo
- `NotifyUserUseCase`, `PrismaNotificationRepository`. `markRead` valida posse. Sem testes.
- ⚠️ Queries filtram só por `userId`, não por `tenantId` (isolamento se mantém transitivamente).

### partner-network — ✅ implementado, com 1 bug
- `domain/PartnerMatcher.ts` — filtra por ativo/estado/cidade (wildcard `*`) e especialidade gás/estrutural; ordena engenheiros primeiro p/ HIGH/CRITICAL.
- Use cases: `Assign`, `PartnerAccept`, `PartnerDecline` — transacionais com logs.
- 🐞 **Bug:** `AssignPartnerUseCase` lê `scope.servicesNeeded`, campo **inexistente** no `ReformScopeSchema` (o correto é `services`). Resultado: a filtragem por especialidade gás/estrutural **nunca dispara** com dados reais.
- Teste: `PartnerMatcher.test.ts`.

**Observações cross-cutting:**
- Vários use cases importam `prisma` direto (pragmático, mas fora do padrão de repositório estrito).
- `shared/events/` contém **só tipos** — não há event bus; o "bus" é um callback opcional injetado no worker.
- Tratamento de erro dos agentes IA é inconsistente: 4 degradam para fallback, `ClaudeAnalysisAgent` lança.

---

## 5. STATE MACHINE DO CASO

`CaseStateMachine` (`case-intake/domain/entities/`) é entidade pura. 17 estados,
mapa `VALID_TRANSITIONS` idêntico ao CLAUDE.md §6. `transition()` lança
`InvalidTransitionError`; `assertBusinessRules()` impede HIGH/CRITICAL irem para
`ELIGIBLE_FOR_RELEASE` sem `HUMAN_REVIEW_REQUIRED` antes. Toda transição grava
`CaseTransitionLog` + `AuditLog` em `$transaction`.

**Única exceção:** `CreateCaseUseCase` faz `DRAFT → AWAITING_SCOPE_DETAILS` sem a
máquina (transição válida, mas fora da entidade — viola CLAUDE.md §17).

---

## 6. CAMADA DE IA — AGENTES

| Agente | Arquivo | Uso do LLM | Validação |
|--------|---------|-----------|-----------|
| `TriageAgent` | case-intake/application | **tool-use nativo** (`submit_scope`), `temp 0`, stream SSE | `ReformScopeSchema.safeParse` |
| `ClaudeDocumentAgent` | document-intelligence | `complete`, `temp 0`, JSON em `<extraction>` | `DocumentExtractionResultSchema` |
| `ClaudeAnalysisAgent` | document-intelligence | `complete`, `temp 0`, JSON em `<analysis>` | `DocumentAnalysisResultSchema` |
| `ClaudeReportAgent` | document-generation | `complete`, `temp 0.2`, JSON em `<narrative>` | `NarrativeSchema` + `ReportContentSchema` |
| `CommercialAgent` | commercial-offers | `complete`, `temp 0.3`, JSON em `<offer>` | `CommercialOfferOutputSchema` |

- Modelo **fixo** `claude-sonnet-4-20250514` no `AnthropicProvider` (infra) — único lugar que importa o SDK.
- Toda saída de IA é validada por Zod (CLAUDE.md §9).
- Só o `TriageAgent` usa tool-use real; os outros 4 usam JSON delimitado por tags.
- A IA nunca chama `stateMachine.transition()` — sugere; o application service decide.

---

## 7. PIPELINE DOCUMENTAL (BullMQ Worker)

`infrastructure/queue/DocumentWorker.ts` — 6 passos idempotentes, fila
`document-processing`, `attempts: 3`, backoff exponencial 2000ms. Cada passo
checa se o documento ainda existe e re-enfileira o próximo:

1. **ocr** — baixa via signed URL 300s; PDF → `pdf-parse`, imagem → `tesseract.js` (`por`); salva `extractedText`.
2. **extraction** — `ClaudeDocumentAgent.extract()`; salva `extractedData` + `inconsistencies`.
3. **validation** — `ClaudeAnalysisAgent.analyze()` cross-document; mapeia recomendação → `DocStatus`; salva `pendencies`.
4. **status-update** — no-op explícito (status já gravado no passo 3); mantido por contrato.
5. **checklist** — `DocumentChecklist.evaluate()`; emite evento `checklist.updated`.
6. **emit-event** — emite `document.processed`; se caso em `AWAITING_DOCUMENTS` e todos os docs válidos → transiciona para `DOCUMENTS_UNDER_REVIEW` via `CaseStateMachine`.

Falha permanente (após 3 tentativas) → documento `INVALID` + `AuditLog`
`document.processing.failed`. Entrypoint standalone: `src/workers/document-worker.ts`
(wire das dependências reais + shutdown gracioso SIGTERM/SIGINT).

---

## 8. API ROUTES — ESTADO REAL

Prefixo `/api/v1/`. Todas implementadas salvo nota. Auth via `requireSessionUser()`;
sem `middleware.ts` global — autorização rota a rota.

### Autenticação / saúde / público
| Rota | Auth |
|------|------|
| `GET/POST /api/auth/[...nextauth]` | público (NextAuth) |
| `GET /api/health` | público (ping `SELECT 1`) |
| `GET /api/v1/public/condominiums` `/:id` | **público** (autocadastro) |
| `POST /api/v1/auth/register` | **público** (autocadastro de morador) |

### Casos
| Rota | Função |
|------|--------|
| `POST/GET /api/v1/cases` | criar / listar (CLIENT vê só os próprios) |
| `GET /api/v1/cases/:id` | detalhe (tenant-scoped) |
| `GET/POST /api/v1/cases/:id/messages` | chat de triagem (não-streaming) |
| `GET /api/v1/cases/:id/messages/stream` | chat de triagem **SSE** (usado pela UI) |
| `POST/GET /api/v1/cases/:id/documents` | upload (multipart, 20MB) / listar |
| `GET /api/v1/cases/:id/documents/:id/url` | signed URL |
| `POST /api/v1/cases/:id/documents/analyze` | enfileira OCR (ADMIN/SUPER_ADMIN/CONDOMINIUM) |
| `GET /api/v1/cases/:id/reports` `POST .../generate` `GET .../:id/url` | relatórios |
| `POST /api/v1/cases/:id/commercial/quote` `/accept` | proposta comercial |
| `GET/POST /api/v1/cases/:id/inspections` `PATCH/.../complete` | vistorias |

### Admin
`GET /admin/dashboard`, `GET /admin/review-queue`, `POST /admin/review/:caseId`,
`GET/POST /admin/policies` + `PATCH/DELETE /:id` + `PATCH /:id/rules`,
`GET/POST /admin/condominiums` + `PATCH/DELETE /:id` + `units` (CRUD),
`GET/POST /admin/partners` + `PATCH/DELETE /:id`. Roles: `ADMIN`, `SUPER_ADMIN`.

### Superadmin (só `SUPER_ADMIN`)
`GET/POST /superadmin/tenants` + `PATCH /:id`,
`GET/POST /superadmin/users` + `PATCH /:id`,
`GET /superadmin/report-skills` + `PUT /:type`.

### Parceiros / notificações / units
`GET /partners`, `GET /partners/:id/cases`, `POST /partners/:id/cases/:caseId/accept` `/decline`,
`GET /notifications` + `PATCH /:id`, `GET /units`.

**Pontos de atenção:** vários POSTs de mudança de estado (`commercial/*`,
`inspections`, `partners/.../accept|decline`) só exigem **uma sessão** — não
checam role nem posse do recurso. `documents` grava `origin` fixo em `CLIENT`.

---

## 9. PÁGINAS FRONTEND

Todas as páginas estão **construídas com UI real** — nenhum stub/placeholder.

| Perfil | Páginas |
|--------|---------|
| Público | `/` (landing), `/login`, `/register`, `/register/[condominiumId]` |
| Morador (CLIENT) | `/cases`, `/cases/[caseId]` (chat SSE), `/cases/[caseId]/documents` |
| Admin / Superadmin | `/dashboard`, `/review-queue` `+ /[caseId]`, `/condominiums`, `/partners`, `/policies` |
| Superadmin | `/skills`, `/tenants`, `/users` (nav extra no layout) |
| Síndico (CONDOMINIUM) | `/sindico/dashboard`, `/sindico/cases`, `/sindico/cadastro` (QR) |
| Parceiro (PARTNER) | `/partner/dashboard`, `/partner/cases` `+ /[caseId]`, `.../inspections` `+ /[id]/complete` |

Login faz redirect por role (CONDOMINIUM→sindico, PARTNER→partner, ADMIN→dashboard, senão→cases).
⚠️ `/login` tem "Esqueci a senha" (`href="#"`) e "Continuar com o condomínio" (sem `onClick`) **mortos**.
A área do morador é `app/cases/` simples — o route-group `(client)` do CLAUDE.md §5 não foi usado.

---

## 10. FEATURES ALÉM DO CLAUDE.md

### Autocadastro de morador + QR Code
- Síndico abre `/sindico/cadastro` → `RegistrationQrCard` gera QR do link `{host}/register/{condominiumId}`, com copiar-link e baixar-PNG.
- Morador escaneia → `/register/[condominiumId]` → `GET /api/v1/public/condominiums/:id` → form → `POST /api/v1/auth/register`.
- `/register` sem id é fallback (escolhe condomínio numa lista pública).
- Ao registrar, todos os síndicos (`CONDOMINIUM`) do condomínio são notificados (`NotifyUserUseCase`, não-fatal).

### Painel Superadmin
- `/tenants` e `/users` — dono da plataforma cria tenants e usuários de qualquer role/tenant.
- ⚠️ A rota `/superadmin/users` aceita role `MANAGER` — existe no enum real do schema, mas não no CLAUDE.md §8.

### Report Skills (modelo `ReportSkill`)
- `/skills` (SUPER_ADMIN) permite colar um **Anthropic Agent Skill ID** para dirigir a geração de relatórios `MEMORIAL_DESCRITIVO` e `CRONOGRAMA`.
- Substitui a API `/admin/templates` do CLAUDE.md §12 — que **nunca foi construída**.
- `SKILL_TYPES` está hardcoded nesses 2 tipos; seed cria 1 `ReportSkill` ("Memorial Descritivo NBR 16280").

### Notificações in-app
- `NotificationBell` na sidebar — auto-fetch ao montar, badge de não-lidas, marca lida ao clicar.

---

## 11. AUTH / STORAGE / FILA

**Auth** (`src/infrastructure/auth/`): NextAuth v4, sessão **JWT** (sem tabela de
sessão), `CredentialsProvider` único. `verifyPassword` aceita 2 formatos —
moderno `scrypt$salt$hash` (node:crypto, `timingSafeEqual`) e **branch legado
SHA-256** (`sha256(senha + "reformai_salt")`) mantido para janela de transição.
JWT carrega `uid/tenantId/role/condominiumId`. `getSessionUser()` /
`requireSessionUser()` para server components e rotas.

**Storage** (`src/infrastructure/storage/`): `createStorageAdapter()` escolhe por
`STORAGE_ADAPTER` (`minio`|`s3`). `MinIOAdapter` auto-cria o bucket e usa um
`signingClient` separado (endpoint público opcional `MINIO_PUBLIC_ENDPOINT`).
`S3Adapter` não cria bucket (assume IaC). `SIGNED_URL_TTL_SECONDS = 3600`.
Chaves: `tenants/{t}/condominiums/{c}/units/{u}/cases/{case}/{area}/{sub}/{file}`.

**Fila** (`src/infrastructure/queue/`): `QueueManager` é singleton BullMQ (1
`Queue` + 1 `Worker` por nome), conexão de `REDIS_URL`, `concurrency: 1`. Única
fila: `document-processing` (ver §7).

---

## 12. SEED / USUÁRIOS DE TESTE

`packages/database/prisma/seed.ts` — duas fases:

- **`seedEssential()`** — sempre roda (inclusive prod): cria a "Política Padrão Global" (`tenantId: null`) com **14 regras** de `data/policies.ts` (idênticas ao CLAUDE.md §7), e faz upsert de 1 `ReportSkill`.
- **`seedDemo()`** — só com `SEED_DEMO=true`: tenant `Demo Administradora`, 1 condomínio, 3 units, **13 ReformCases** (`RF-DEMO-*`) cobrindo o ciclo de vida, 1 Partner, 1 CommercialPlan, 4 Inspections.

**Usuários demo (senha `senha123`, hash scrypt):**

| Email | Role |
|-------|------|
| admin@demo.com | SUPER_ADMIN |
| sindico@demo.com | CONDOMINIUM (vinculado ao condomínio) |
| morador@demo.com | CLIENT |
| parceiro@demo.com | PARTNER |

`create-admin.ts` (`bun run db:create-admin`) — script seguro para prod: cria
tenant `ADMIN` + usuário `SUPER_ADMIN` a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`
(senha ≥12 chars).

---

## 13. TEMPLATES & DESIGN SYSTEM

**Templates** (`packages/templates/`): `engine.ts` → `renderTemplate(id, vars)`
substitui `{{ var }}`, troca faltantes por `[CAMPO NÃO PREENCHIDO]`, valida o id
contra allow-list e **sempre anexa o disclaimer obrigatório**. 6 arquivos `.md`:
`relatorio-analise`, `memorial-descritivo`, `cronograma-basico`,
`parecer-pendencias`, `proposta-comercial`, `ordem-servico`.

**Design system "Concreto Verde"** (`src/interfaces/components/ui/`, 18
componentes, white-label via `--rai-*`): `Icon`, `Eyebrow`, `Logo`, `Button`,
`Input`, `Select`, `Checkbox`, `Switch`, `Badge`, `Card`, `Avatar`, `RiskBadge`,
`StatusChip`, `CaseCard`, `Timeline`, `ChatMessage`, `AppShell`, `TopBar`.
Outros: `AuthProvider`, `NotificationBell`, `RegistrationQrCard`, `SignOutButton`.

---

## 14. TESTES / COBERTURA

**Unit (Vitest)** — 12 arquivos: `DeterministicEvaluator` (só 3 casos),
`CaseStateMachine`, `TriageAgent`, `PriceCalculator`, `QuoteCaseUseCase`,
`GenerateReportUseCase`, `ClaudeDocumentAgent`, `UploadDocumentUseCase`,
`InspectionRules` (maior), `PartnerMatcher`, `DocumentWorker`, `MinIOAdapter`,
+ `engine.test.ts` (templates).

**E2E (Playwright, Chromium, `:3100`)** — 5 specs, 13 testes: `auth` (4),
`case-intake` (3), `document-upload` (3), `triage-chat` (1, pulado sem
`ANTHROPIC_API_KEY`), `admin-review` (2).

**Sem cobertura:** `S3Adapter`, `QueueManager`, `StorageFactory`, config
NextAuth (`auth.ts`/`getSessionUser`/`password.ts`), worker entrypoint,
`respond.ts`, componentes UI, scripts de seed, painéis síndico/parceiro (sem E2E).

---

## 15. BUILD / DEPLOY

- **`Dockerfile.web`** — multi-stage `oven/bun:1.3.10`; `runtime` roda `prisma migrate deploy` + `next start`. Não usa output `standalone` do Next (imagem maior que o necessário).
- **`Dockerfile.worker`** — mesmo padrão; `CMD` roda `src/workers/document-worker.ts`.
- **`docker-compose.yml`** — Postgres (porta `5433:5432`), Redis (`6379`), MinIO (`9000`/`9001`) com healthchecks.
- **Produção:** Dokploy/Swarm — o app de prod usa o banco do swarm; o `.env` do repo aponta para um banco dev diferente. Operar prod via `docker exec` no container web.

---

## 16. VARIÁVEIS DE AMBIENTE

`DATABASE_URL` (dev: porta `5433`), `REDIS_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `ANTHROPIC_API_KEY`, `STORAGE_ADAPTER` (`minio`|`s3`),
`MINIO_ENDPOINT` / `MINIO_PUBLIC_ENDPOINT` / `MINIO_ACCESS_KEY` /
`MINIO_SECRET_KEY` / `MINIO_BUCKET`, `NEXT_PUBLIC_APP_URL`. S3 exige
`AWS_REGION`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_S3_BUCKET`.
`SEED_DEMO=true` ativa o seed demo.

---

## 17. COMANDOS

```bash
docker-compose up -d        # Postgres + Redis + MinIO
bun install                 # dependências do monorepo
bun run db:migrate          # prisma migrate dev
bun run db:generate         # prisma generate
bun run db:seed             # seed (SEED_DEMO=true para dados demo)
bun run db:create-admin     # cria SUPER_ADMIN de produção
bun run dev                 # Next.js dev (turbo)
bun run test                # Vitest (unit)
bun run test:e2e            # Playwright (E2E)
bun run --cwd apps/web src/workers/document-worker.ts   # worker standalone
```

---

## 18. DIVERGÊNCIAS DO CLAUDE.md (resumo)

O `CLAUDE.md` é a fonte-de-verdade da **especificação**, mas está **defasado** vs
o código atual. Divergências conhecidas:

1. **Schema** — `User.passwordHash`/`condominiumId`, `UserRole.MANAGER`, `Unit.block`, modelos `Notification` e `ReportSkill`, `ReportType` com 8 valores, `Report.skillFileId` (ver §3).
2. **API** — não existem `/auth/login`, `/auth/refresh`, `/cases/:id/status`, `/admin/templates`. Existem (não documentados): toda a árvore `/superadmin/*`, `/notifications`, `/public/condominiums`, `/auth/register`, `/units`, `/admin/condominiums/*`.
3. **Bun** — CLAUDE.md diz 1.3.6; manifests/Dockerfiles usam 1.3.10.
4. **Event bus** — CLAUDE.md §5 lista `shared/events/` como event bus; na prática só há tipos + callback no worker.
5. **Route group `(client)`** — não usado; a área do morador é `app/cases/`.

---

## 19. BUGS E PENDÊNCIAS CONHECIDAS

| # | Item | Severidade |
|---|------|-----------|
| ~~1~~ | ~~`AssignPartnerUseCase` lê `scope.servicesNeeded` — campo inexistente; correto é `services`~~ | ✅ corrigido |
| 2 | `/login`: "Esqueci a senha" e "Continuar com o condomínio" são botões mortos; não há fluxo de reset de senha | Média |
| ~~3~~ | ~~POSTs de mudança de estado só checavam "existe sessão", sem role nem posse~~ | ✅ corrigido |
| ~~4~~ | ~~`CreateCaseUseCase` transicionava o caso sem `CaseStateMachine`~~ | ✅ corrigido |
| 5 | `ClaudeAnalysisAgent` lança em falha (os outros agentes degradam) — pode derrubar o job do worker | Média |
| 6 | `PriceCalculator` ignora `riskLevel`/`mandatoryInspection` — risco não afeta preço | Baixa (decisão de produto?) |
| 7 | `RegisterClientUseCase` não usa transação — falha parcial deixa `Unit` órfã | Baixa |
| 8 | `CondominiumPolicy.overrides` lido mas nunca aplicado | Baixa |
| 9 | `GenerateReportUseCase` deixa muitas variáveis de template como `undefined` — relatórios esqueléticos | Média |
| 10 | Branch legado SHA-256 de senha — remover após re-seed global | Débito transitório |
| 11 | `documents` grava `origin` fixo em `CLIENT` — sem rota de upload para parceiro/admin | Baixa |
| 12 | Métodos de repositório virando código morto (Inspection/Partner) por uso direto de `prisma` | Baixa (limpeza) |
| 13 | `DeterministicEvaluator` (módulo crítico) só tem 3 casos de teste | Baixa (cobertura) |

---

## 20. PRÓXIMOS PASSOS SUGERIDOS

1. Corrigir o bug `servicesNeeded` → `services` no `AssignPartnerUseCase` (#19.1).
2. Implementar fluxo de recuperação de senha ou remover os botões mortos do login (#19.2).
3. Adicionar `middleware.ts` ou padronizar checagem de role/posse nos POSTs de estado (#19.3).
4. Atualizar o `CLAUDE.md` para refletir schema, rotas e versão do Bun atuais (§18).
5. Decidir o destino do branch legado SHA-256 (re-seed global → remover).
6. Popular as variáveis de template ausentes para relatórios completos (#19.9).
```
