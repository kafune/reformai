# Relatório de Exploração — App Antigo de Gestão de Reformas em Condomínios

> **Escopo:** análise somente-leitura do código existente em `E:\app-art\referencia-pai`.
> **Data da análise:** 2026-05-17.
> **Versão analisada:** branch `main`, commits `fc3d194` (first commit) e `3be3f6a` (everything).
> Nenhum arquivo foi alterado.

> **Aviso de método:** este relatório descreve **o que o código faz hoje**, que nem sempre
> coincide com o que o `CLAUDE.md` do projeto especifica. Onde o código diverge da
> especificação ou está incompleto, isso está sinalizado explicitamente. Quando algo não
> ficou claro no código, está marcado como tal — nada foi inventado.

---

## 1. Stack e arquitetura

### 1.1 Tecnologias

| Camada | Tecnologia | Evidência |
|---|---|---|
| Monorepo | Bun workspaces + Turborepo | `package.json:5-8`, `turbo.json` |
| Frontend / Backend | Next.js **16.2.4** (App Router) + React **19.2.4** | `apps/web/package.json:20-24` |
| Linguagem | TypeScript 5 | `apps/web/package.json:35` |
| Estilo | Tailwind CSS v4 | `apps/web/package.json:29,34` |
| ORM | Prisma (client gerado em `packages/database/generated/client`) | `packages/database/prisma/schema.prisma:1-5` |
| Banco | PostgreSQL 16 + extensão `pgvector` | `docker-compose.yml:2`, `schema.prisma:7-11` |
| Fila | BullMQ + Redis (ioredis) | `apps/web/package.json:17-18`, `src/infrastructure/queue/queues.ts` |
| Auth | NextAuth 4.24.11 (estratégia JWT, provider Credentials) | `apps/web/package.json:21`, `src/infrastructure/auth/nextauth.ts` |
| Storage | Abstração via adapter; **só MinIO implementado** | `src/infrastructure/storage/` |
| IA / LLM | Anthropic SDK `@anthropic-ai/sdk ^0.90.0` | `apps/web/package.json:15` |
| OCR | Tesseract.js 7 (idioma `por`) | `apps/web/package.json:25`, `document.worker.ts:21-29` |
| Parsing PDF | `pdf-parse` | `apps/web/package.json:22`, `document.worker.ts:9` |
| Validação | Zod 3 | usado nas bordas (rotas, use-cases, schemas) |
| Testes | Vitest 4 | `apps/web/package.json:36`, `vitest.config.ts` |

> **Observação:** o `CLAUDE.md` fala em Next.js 14, Tesseract→Textract, Playwright para E2E.
> O código real usa **Next.js 16**, tem só Tesseract, e **não há testes E2E** (só dois testes
> unitários Vitest — ver §7). O `apps/web/AGENTS.md` avisa que "este não é o Next.js que você
> conhece" — o middleware, por exemplo, vive em `apps/web/proxy.ts` (Next.js 16 renomeou
> `middleware.ts` → `proxy.ts`).

### 1.2 Organização de pastas

```
referencia-pai/
├── apps/web/                          # única aplicação
│   ├── app/                           # Next.js App Router
│   │   ├── (auth)/login, register     # telas públicas
│   │   ├── (client)/cases             # área do morador  → URL /cases
│   │   ├── (partner)/cases            # área do parceiro → URL /cases  ⚠ ver §2.4
│   │   ├── (admin)/  (condominium)/   # grupos de rota VAZIOS (sem páginas)
│   │   ├── admin/                     # painel admin     → URL /admin/*
│   │   ├── superadmin/                # painel superadmin → URL /superadmin/*
│   │   ├── dashboard/                 # rota-pivô de redirecionamento
│   │   └── api/                       # API routes (auth + /api/v1/*)
│   ├── src/
│   │   ├── modules/                   # DDD: bounded contexts
│   │   │   ├── case-intake/           # casos, chat de triagem, state machine
│   │   │   ├── rule-engine/           # avaliador determinístico
│   │   │   ├── document-management/   # upload/listagem de documentos
│   │   │   ├── document-intelligence/ # abstração LLM + AnthropicProvider
│   │   │   ├── document-generation/   # ReportAgent + SkillProvider
│   │   │   ├── commercial-offers/     # envio de proposta
│   │   │   ├── partner-network/       # atribuição de parceiro
│   │   │   ├── inspection-scheduling/ # criação de vistorias
│   │   │   ├── identity/ tenancy/ audit/  # pastas existem, praticamente vazias
│   │   ├── shared/                    # types, errors, events, utils
│   │   └── infrastructure/            # auth, database, queue, storage
│   └── proxy.ts                       # middleware (guarda de rotas por papel)
├── packages/
│   ├── database/                      # schema.prisma, migrations, seed
│   └── templates/                     # 6 templates .md  ⚠ não usados pelo código atual
├── docs/                              # vazio
├── CLAUDE.md / SYSTEM-PROMPT.md       # especificação do projeto
└── docker-compose.yml                 # postgres + redis + minio
```

Cada módulo segue, em maior ou menor grau, a separação DDD `domain → application →
infrastructure`. A regra de negócio crítica (state machine, avaliador de regras) está
de fato em `domain/`. Camadas vazias/incompletas: `identity/`, `tenancy/`, `audit/`
contêm pastas mas quase nenhum código relevante.

### 1.3 Padrões de arquitetura observados

- **Multi-tenant por extensão do Prisma Client.** `createTenantClient(tenantId)`
  (`src/infrastructure/database/tenant-client.ts`) intercepta todas as operações e injeta
  `tenantId` no `where`/`data` para um conjunto fixo de modelos
  (`tenant-client.ts:9-20`). Modelos sem `tenantId` (ex.: `ChatMessage`, `Rule`,
  `CaseTransitionLog`) são acessados via relacionamento.
  ⚠ **`findUnique` não é escopado** — o próprio comentário no código admite isso
  (`tenant-client.ts:74`); várias rotas usam `findUnique` direto.
- **State machine como entidade de domínio pura** — `CaseStateMachine`
  (`src/modules/case-intake/domain/entities/CaseStateMachine.ts`).
- **Rule Engine determinístico e separado da IA** — `DeterministicEvaluator`
  (`src/modules/rule-engine/domain/evaluator/DeterministicEvaluator.ts`).
- **LLM atrás de interface** — `LLMProvider` (domínio) / `AnthropicProvider`
  (infraestrutura). Mas há vazamento: o SDK Anthropic também é importado direto em
  `SkillProvider.ts` (infra de `document-generation`).
- **Use-cases** orquestram repositórios + agentes; **rotas** (`app/api/v1/...`) são finas.
- ⚠ Há **duplicação de lógica**: o fluxo de triagem existe tanto em `SendMessageUseCase`
  quanto reimplementado inline na rota SSE `messages/stream/route.ts` (ver §5.4).

---

## 2. Papéis de usuário (roles) e autenticação

### 2.1 Papéis existentes

O enum do banco (`schema.prisma:92-99`) define **6 papéis**:

| Papel (`UserRole`) | Rótulo na UI | Descrição |
|---|---|---|
| `SUPER_ADMIN` | Super Admin | Operador da plataforma; vê todos os tenants. |
| `ADMIN` | Administrador | Administrador dentro de um tenant. |
| `MANAGER` | Gestor / Gestor de Tenant | Tratado como admin pelo middleware. |
| `CONDOMINIUM` | Síndico | Papel do síndico do condomínio; tratado como admin. |
| `CLIENT` | Morador | Usuário final que abre os casos de reforma. |
| `PARTNER` | Parceiro | Responsável técnico (engenheiro/arquiteto). |

> ⚠ **Inconsistência de tipos:** o tipo TypeScript `UserRole` em
> `src/shared/types/index.ts:22` lista apenas **5 papéis** — **`MANAGER` está ausente**.
> O `MANAGER` existe no enum Prisma, é tratado no `proxy.ts`, aparece no formulário de
> criação de usuário do superadmin e nos rótulos da `AdminSidebar`, mas não no tipo
> compartilhado. Isso é um defeito latente de tipagem.

### 2.2 Como funciona o login

- **Provider:** NextAuth `CredentialsProvider` (e-mail + senha), estratégia de sessão `jwt`
  (`src/infrastructure/auth/nextauth.ts:36-71`).
- **Verificação de senha:** `authorize()` busca o usuário por e-mail, rejeita se inativo,
  e chama `verifyPassword` (`nextauth.ts:50-69`).
- ⚠ **Hash de senha fraco:** `src/infrastructure/auth/password.ts` usa
  `SHA-256(password + "reformai_salt")` — sal **fixo e global**, hash rápido, sem
  bcrypt/argon2. Inadequado para produção (vulnerável a rainbow tables / brute-force).
- **JWT enriquecido:** o callback `jwt` injeta `id`, `tenantId`, `role`, `tenantSlug`;
  o callback `session` espelha isso na sessão (`nextauth.ts:72-89`).
- **Telas:** `/login` (`app/(auth)/login/page.tsx`) e `/register`
  (`app/(auth)/register/page.tsx`). A raiz `/` redireciona para `/login`
  (`app/page.tsx`).
- **Cadastro:** só cria usuários com papel **`CLIENT`** (`api/v1/auth/register/route.ts:50`);
  exige condomínio + unidade existentes; registra `lgpdConsentAt`; notifica os síndicos
  do condomínio. Os demais papéis só podem ser criados pelo Super Admin.

### 2.3 Como funcionam as permissões

Há **duas camadas de autorização**:

**(a) Middleware de páginas — `apps/web/proxy.ts`**
- Rotas públicas: `/login`, `/register`, `/api/auth`, `/api/v1/auth/register`,
  `/api/v1/public/` (`proxy.ts:4-10`).
- **`/api/v1/*` não passa pela guarda do middleware** — sai com `NextResponse.next()`
  (`proxy.ts:21-23`); a autorização da API é feita só pelo `withApiAuth`.
- Sem token → redireciona para `/login` com `callbackUrl`.
- `/dashboard` é uma rota-pivô: redireciona conforme o papel
  (`proxy.ts:36-41`): `SUPER_ADMIN`→`/superadmin/dashboard`,
  `ADMIN`/`CONDOMINIUM`/`MANAGER`→`/admin/dashboard`, `PARTNER`→`/partner/cases`,
  demais→`/cases`.
- Guardas por área (`proxy.ts:44-66`): `/superadmin` só `SUPER_ADMIN`; `/admin` só
  `ADMIN`/`CONDOMINIUM`/`MANAGER`; `/partner` só `PARTNER`; `/cases` só `CLIENT`.

**(b) Autorização da API — `withApiAuth`** (`src/infrastructure/auth/api-auth.ts`)
- Lê o JWT, devolve `401` se não autenticado.
- Recebe opcionalmente `allowedRoles`; devolve `403` se o papel não estiver na lista.
- Monta o `AuthContext` com `db = createTenantClient(tenantId)` — **toda query passa a ser
  escopada por tenant** automaticamente.
- ⚠ **Várias rotas não passam `allowedRoles`** (ex.: `GET /cases/:id`, `GET/POST
  /cases/:id/messages`, `GET/POST /cases/:id/documents`) — qualquer usuário autenticado
  do tenant acessa. A restrição fina (ex.: "CLIENT só vê o próprio caso") é feita
  manualmente dentro do handler comparando `clientId === userId`.

### 2.4 ⚠ Inconsistência grave na área do Parceiro

A área do parceiro está configurada de forma **inconsistente / provavelmente quebrada**:

- As páginas do parceiro estão em `app/(partner)/cases/...`. Os parênteses fazem de
  `(partner)` um **route group** — ele **não aparece na URL**. Logo as páginas resolvem
  para **`/cases`** e **`/cases/[id]`**.
- Isso **colide** com as páginas do morador em `app/(client)/cases/...`, que resolvem
  para os **mesmos caminhos** `/cases` e `/cases/[id]`.
- Ao mesmo tempo, o `proxy.ts` e a própria UI do parceiro esperam **`/partner/cases`**:
  `PartnerSidebar.tsx:8` aponta para `/partner/cases`, a página de listagem navega para
  `/partner/cases/${id}` (`(partner)/cases/page.tsx:107`), e o `proxy.ts` redireciona
  `PARTNER`→`/partner/cases` e guarda `pathname.startsWith("/partner")`.
- Nenhum route group produz a URL `/partner/cases`. Além disso, o `proxy.ts` redireciona
  `/cases` (onde as páginas do parceiro de fato resolvem) para fora quando
  `role !== "CLIENT"`.

**Conclusão:** o roteamento da área do parceiro está incoerente — para funcionar, a pasta
deveria se chamar `partner/` (sem parênteses) em vez de `(partner)/`. Como está, o
parceiro não tem uma rota de UI consistente. As **APIs** do parceiro (`/api/v1/partner/*`),
porém, existem e estão corretas. Tratei isso como "implementado mas com bug de roteamento".

Os route groups `(admin)/` e `(condominium)/` existem mas estão **vazios** (sem
`page.tsx`); o painel admin real vive em `app/admin/` (pasta normal).

### 2.5 Usuários de teste (seed)

`packages/database/prisma/seed.ts:156-182` cria 4 usuários no tenant `demo`
(senha `senha123` para todos):

| E-mail | Papel | Observação |
|---|---|---|
| `admin@demo.com` | `SUPER_ADMIN` | ⚠ chama-se "Admin Demo" mas é Super Admin. |
| `sindico@demo.com` | `CONDOMINIUM` | Síndico. |
| `morador@demo.com` | `CLIENT` | João da Silva, unidade 101. |
| `parceiro@demo.com` | `PARTNER` | Eng. Carlos Oliveira (CREA-SP, registro `Partner`). |

Não há usuário `ADMIN` nem `MANAGER` no seed.

---

## 3. Telas e funcionalidades por papel de usuário

### 3.0 Telas públicas (sem login)

| Tela | Arquivo | O que faz |
|---|---|---|
| Login | `app/(auth)/login/page.tsx` | Form e-mail/senha; `signIn("credentials")`; mensagem de "conta criada"; link p/ cadastro. |
| Cadastro | `app/(auth)/register/page.tsx` | Cria conta de **morador**: nome, e-mail, senha, condomínio (select carregado de `/api/v1/public/condominiums`) e unidade (`/api/v1/public/condominiums/:id/units`). Sempre papel `CLIENT`. |

---

### 3.1 SUPER_ADMIN — Operador da plataforma

Área: `/superadmin/*`. Layout `app/superadmin/layout.tsx` + `SuperAdminSidebar.tsx`
(menu: Dashboard, Tenants, Usuários, Políticas Globais, Skills de Relatório).

#### Dashboard global — `/superadmin/dashboard`
Arquivo: `app/superadmin/dashboard/page.tsx` · API: `GET /api/v1/superadmin/dashboard`.
- KPIs consolidados de **toda a plataforma** (sem filtro de tenant): nº de tenants
  (total/ativos), total de usuários, total de casos, casos em revisão humana.
- Gráfico de barras de casos por status; distribuição de risco; tabela dos 10 casos mais
  recentes com o tenant de origem.
- Apenas leitura.

#### Tenants — `/superadmin/tenants`
Arquivo: `app/superadmin/tenants/page.tsx` · API: `GET/POST /api/v1/superadmin/tenants`,
`PATCH /api/v1/superadmin/tenants/:id`.
- Tabela de tenants com contagem de condomínios, usuários e casos.
- **Criar tenant** (botão "+ Novo Tenant"): nome, slug (auto-gerado via `slugify`, único),
  tipo (`STANDALONE`/`ADMINISTRADORA`/`ADMIN`).
- **Ativar/Desativar** tenant (`PATCH` faz toggle do campo `active`).

#### Usuários — `/superadmin/users`
Arquivo: `app/superadmin/users/page.tsx` · API: `GET/POST /api/v1/superadmin/users`,
`PATCH /api/v1/superadmin/users/:id`.
- Lista global de usuários; filtro por tenant.
- **Criar usuário** com qualquer papel (incluindo `SUPER_ADMIN`, `PARTNER`, `MANAGER`) e
  qualquer tenant. Senha mínima 6 caracteres.
  ⚠ Ao criar um `PARTNER` por aqui, **não se cria o registro `Partner`** correspondente
  (CREA, especialidades, preço). Sem isso, as rotas do parceiro retornam "Parceiro não
  encontrado" — só o parceiro do seed funciona de fato.
- **Ativar/Desativar** usuário (toggle de `active`).

#### Políticas Globais — `/superadmin/policies`
Arquivo: `app/superadmin/policies/page.tsx` · API: `GET/POST /api/v1/superadmin/policies`,
`DELETE /api/v1/superadmin/policies/:id`, `POST .../rules`, `PATCH/DELETE .../rules/:ruleId`.
- Lista as políticas globais (`tenantId = null`) com suas regras.
- **Criar política** (só nome).
- **Excluir política** (com confirmação; apaga as regras junto).
- Por política, gerenciar **regras**:
  - **Editar regra** inline: nome, descrição, `+Score` (riskDelta), e toggles `Exige ART`,
    `Rev. Humana`, `Vistoria obrigatória`, `Regra ativa`. (`version` é incrementada.)
  - **Adicionar regra**: nome, descrição, serviço-condição (lista canônica de 14 serviços),
    score, prioridade e toggles. A condição é sempre fixada como
    `{field:"services", operator:"contains", value:<serviço>}` (`.../rules/route.ts:34`).
  - **Remover regra** (com confirmação).

#### Skills de Relatório — `/superadmin/skills`
Arquivo: `app/superadmin/skills/page.tsx` · API: `GET /api/v1/superadmin/report-skills`,
`PUT /api/v1/superadmin/report-skills/:type`.
- Configura qual **Anthropic Agent Skill** gera cada tipo de relatório. Tipos suportados:
  `MEMORIAL_DESCRITIVO` e `CRONOGRAMA`.
- Para cada tipo: informar o `skillId` (criado em
  `platform.claude.com/.../skills`) e um nome de exibição; **ativar/desativar**.
- O `PUT` faz `upsert` na tabela `ReportSkill`.

---

### 3.2 ADMIN / CONDOMINIUM (Síndico) / MANAGER — Painel administrativo

Área: `/admin/*`. Layout `app/admin/layout.tsx` + `AdminSidebar.tsx`. Os três papéis
compartilham **a mesma UI** (o `proxy.ts` agrupa os três). O `AdminSidebar` mostra o
rótulo do papel ("Administrador" / "Síndico" / "Gestor"). Menu: Dashboard, Casos, Fila de
Revisão, Políticas.

A sidebar inclui um **sino de notificações** (`AdminSidebar.tsx:99-157`): faz polling de
`GET /api/v1/notifications` a cada 30 s, mostra contador de não-lidas e marca como lida
via `PATCH /api/v1/notifications/:id`.

#### Dashboard — `/admin/dashboard`
Arquivo: `app/admin/dashboard/page.tsx` · API: `GET /api/v1/admin/dashboard`.
- KPIs do tenant: total de casos, casos em revisão humana, concluídos (com %).
- Gráfico de casos por status, distribuição de risco, tabela das últimas 10 atualizações.
- ⚠ Os links da tabela apontam para `/cases/:id` (área do morador) — provável engano de
  navegação para um admin.

#### Casos — `/admin/cases`
Arquivo: `app/admin/cases/page.tsx` · API: `GET /api/v1/admin/cases`.
- Tabela de **todos os casos do tenant** (até 100), com morador, condomínio/unidade,
  status, risco, score.
- Busca textual no cliente (protocolo, morador, condomínio) e filtro por status.
- Cada linha leva para `/admin/review-queue/:id` (a tela de detalhe/decisão).

#### Fila de Revisão — `/admin/review-queue`
Arquivo: `app/admin/review-queue/page.tsx` · API: `GET /api/v1/admin/review-queue`.
- Lista apenas os casos em status `HUMAN_REVIEW_REQUIRED`, ordenados pelo mais antigo.
- Mostra protocolo, há quanto tempo aguarda, risco, score, "Exige ART", serviços do
  escopo e regras disparadas.

#### Detalhe do caso / Tela de decisão — `/admin/review-queue/[id]`
Arquivo: `app/admin/review-queue/[id]/page.tsx`. **É a tela operacional mais rica do app.**
APIs que consome: `GET /api/v1/cases/:id`, `.../messages`, `.../documents`,
`.../inspections`, `/api/v1/admin/partners`, `/api/v1/admin/commercial-plans`,
`POST /api/v1/admin/review/:caseId`, `.../commercial/quote`,
`.../commercial/confirm-payment`, `.../inspections`,
`/api/v1/admin/cases/:id/assign-partner`.

Painel esquerdo — abas (apenas leitura):
- **Detalhes:** escopo da obra, resultado da triagem automática (score, ART, vistoria,
  regras aplicadas).
- **Documentos:** tabela de documentos; botão "Abrir" gera signed URL e abre em nova aba.
- **Triagem:** histórico completo do chat de triagem.
- **Inspeções:** lista de vistorias; e, se há parceiro atribuído e o caso não está
  encerrado, **formulário para agendar vistoria** (tipo, data/hora opcional, observações).

Painel direito — **muda conforme o status do caso**:
- `HUMAN_REVIEW_REQUIRED` → **painel de decisão do revisor**: escolher uma de 4 ações —
  Liberar (`ELIGIBLE_FOR_RELEASE`), Liberar c/ ressalvas (`RELEASED_WITH_CONDITIONS`),
  Solicitar correções (`PENDING_CORRECTIONS`), Arquivar (`ARCHIVED`) — com **motivo
  obrigatório**.
- `ELIGIBLE_FOR_RELEASE` / `RELEASED_WITH_CONDITIONS` → **painel de atribuição de
  parceiro**: lista parceiros ativos, filtro por nome/cidade/especialidade, confirma a
  atribuição.
- `SCOPE_CLASSIFIED` / `ASSIGNED_TO_PARTNER` → **painel de proposta comercial**: escolher
  um plano e enviar a proposta.
- `AWAITING_PAYMENT` → **painel de confirmar pagamento**.
- Outros status → painel "Status do Caso" sem ações.

#### Políticas — `/admin/policies`
Arquivo: `app/admin/policies/page.tsx` · API: `GET /api/v1/admin/policies`.
- Lista políticas **globais e do tenant**, expansíveis, com a tabela de regras
  (condição, +score, ART, revisão, vistoria).
- ⚠ **Somente leitura** — o admin **não edita políticas** (a edição de regras é
  exclusiva do Super Admin). Não há endpoint `PATCH/POST` de políticas no nível admin.

> **Resumo de poder do papel admin (qualquer dos três):** revisar e decidir casos,
> atribuir parceiros, enviar propostas comerciais, confirmar pagamentos, agendar
> vistorias, ver dashboard/casos e consultar políticas. O código **não diferencia
> `ADMIN` de `CONDOMINIUM` de `MANAGER`** em nenhuma funcionalidade — eles têm
> exatamente as mesmas permissões na prática.

---

### 3.3 PARTNER — Parceiro técnico (engenheiro/arquiteto)

Área: páginas em `app/(partner)/cases/...` ⚠ (com o problema de roteamento da §2.4).
Layout `app/(partner)/layout.tsx` + `PartnerSidebar.tsx` (menu único: "Meus Casos").
As **APIs** (`/api/v1/partner/*`) estão íntegras e restritas a `["PARTNER"]`.

#### Meus Casos — (intenção: `/partner/cases`)
Arquivo: `app/(partner)/cases/page.tsx` · API: `GET /api/v1/partner/cases`.
- Lista os casos onde o usuário é o parceiro atribuído. Filtros por status
  (`ASSIGNED_TO_PARTNER`, `ART_RRT_PENDING`, `INSPECTIONS_SCHEDULED`, `IN_EXECUTION`,
  `CONCLUDED`).
- Mostra contadores de casos ativos e vistorias pendentes.

#### Detalhe do caso — (intenção: `/partner/cases/[id]`)
Arquivo: `app/(partner)/cases/[id]/page.tsx` · API: `GET /api/v1/partner/cases/:id`.
Botão de cabeçalho **avança o status** do caso na sequência fixa
(`(partner)/cases/[id]/page.tsx:54-65`): `ASSIGNED_TO_PARTNER`→`ART_RRT_PENDING`→
`INSPECTIONS_SCHEDULED`→`IN_EXECUTION`→`CONCLUDED`, via `PATCH /api/v1/partner/cases/:id/status`.

Abas:
- **Visão Geral:** dados do imóvel, do morador, classificação, serviços e descrição.
- **Documentos:** lista; "Abrir" via signed URL.
- **Vistorias:** lista das vistorias do parceiro; nas que estão `SCHEDULED`, botão
  **"Registrar conclusão"** (com observações) → `PATCH .../inspections/:inspId`
  marca `COMPLETED` + `completedAt`.
- **Relatórios:** **gerar** Memorial Descritivo e Cronograma de Obra via
  `POST /api/v1/cases/:id/reports/generate` (só `PARTNER`). Lista as versões; quando há
  arquivo gerado pela skill (`skillFileId`), botão "Baixar arquivo"
  (`GET .../reports/:reportId/file`).

> **Resumo de poder do parceiro:** ver seus casos, avançar o ciclo de execução, registrar
> conclusão de vistorias e gerar Memorial Descritivo e Cronograma.
> O parceiro **não** agenda vistorias (quem agenda é o admin) nem decide casos.

---

### 3.4 CLIENT — Morador

Área: `/cases` e `/cases/[id]`. Layout `app/(client)/layout.tsx` + `ClientSidebar.tsx`
(menu único: "Meus Casos").

#### Meus Casos — `/cases`
Arquivo: `app/(client)/cases/page.tsx` · API: `GET /api/v1/cases` (filtra
automaticamente por `clientId` quando o papel é `CLIENT` — `cases/route.ts:28`).
- Lista os casos do morador com protocolo, data, status, risco e barra de score.
- **Novo Caso** (modal): seleciona condomínio e unidade → `POST /api/v1/cases` → cria o
  caso em status `DRAFT` e abre o detalhe.

#### Detalhe do caso — `/cases/[id]`
Arquivo: `app/(client)/cases/[id]/page.tsx`. Cabeçalho com status/risco/score e abas:

- **Triagem (chat):** chat com o assistente de IA. Envia mensagens via **SSE**
  (`EventSource` para `GET /api/v1/cases/:id/messages/stream`), recebe a resposta em
  streaming. Quando a IA registra o escopo, mostra o **banner de classificação**
  (score, exige ART, vistoria, regras aplicadas, aviso de revisão humana) e o campo de
  entrada é desabilitado.
- **Documentos:** **enviar documento** (tipo + arquivo PDF/JPEG/PNG/WebP, máx. 20 MB) via
  `POST /api/v1/cases/:id/documents`; listar; **baixar** via signed URL.
- **Proposta** (aba aparece só quando há proposta): mostra o plano comercial (preço,
  inclusos); se o status é `COMMERCIAL_OFFER_SENT`, botão **"Aceitar Proposta"** →
  `POST /api/v1/cases/:id/commercial/accept`.
- **Relatórios:** lista os relatórios do caso e permite **visualizar o conteúdo**
  (texto). (Esta aba consome `GET /api/v1/cases/:id/reports`, que devolve `content`.)
- **Detalhes:** tabela com protocolo, status, risco, score, ART, datas; escopo da
  reforma; regras aplicadas; **disclaimer** de que a plataforma não emite ART/RRT.

> **Resumo de poder do morador:** abrir casos, conduzir a triagem por chat, enviar e
> baixar documentos, aceitar proposta comercial, ver relatórios e detalhes.

---

## 4. Modelo de dados

Definido em `packages/database/prisma/schema.prisma`. Migração inicial:
`prisma/migrations/20260419033213_init/migration.sql`. Banco PostgreSQL com extensão
`pgvector` habilitada (não há uso de campos `vector` nos modelos atuais — RAG não
implementado).

### 4.1 Entidades e relacionamentos

```
Tenant 1───* Condominium 1───* Unit 1───* ReformCase
  │              │                          │
  │              *                          ├──* ChatMessage
  ├──* User ─────┘ (condominiumId opcional)  ├──* Document
  │     │                                    ├──* Report
  │     ├──1 Partner ──* Inspection ─────────┤
  │     └──* Notification / AuditLog         ├──* Inspection
  │                                          ├──* CaseTransitionLog
  ├──* Policy ──* Rule                       └──* AuditLog
  │     └──* CondominiumPolicy *── Condominium
  └──* CommercialPlan

ReportSkill  (global, 1 por ReportType — sem relação com Tenant)
```

### 4.2 Principais modelos

| Modelo | Papel | Campos-chave |
|---|---|---|
| `Tenant` | Raiz multi-tenant | `slug` único, `type` (`ADMIN`/`ADMINISTRADORA`/`STANDALONE`), `logoUrl`, `primaryColor` (white-label). |
| `Condominium` | Condomínio | `tenantId`, endereço, `cnpj`. |
| `Unit` | Unidade autônoma | `condominiumId`, `identifier`, dados do proprietário. |
| `User` | Usuário | `tenantId`, `condominiumId?`, `email` único, `passwordHash`, `role`, `lgpdConsentAt`. |
| `ReformCase` | **Agregado central** | `protocol` único, `status` (17 estados), `riskLevel`, `requiresART`, `triageScore`, `reformScope` (JSON), `evaluationResult` (JSON), `partnerId?`, `commercialPlanId?`. |
| `CaseTransitionLog` | Histórico de transições | `fromStatus`, `toStatus`, `triggeredBy`, `reason`. |
| `ChatMessage` | Mensagens da triagem | `role` (`USER`/`ASSISTANT`/`SYSTEM`), `content`, `metadata`. |
| `Document` | Documentos do caso | `type` (11 tipos), `storageKey`, `status` (6 estados), `origin`, `extractedText`, `extractedData`, `inconsistencies`, `pendencies`. |
| `Report` | Relatórios gerados | `type` (8 tipos), `content`, `skillFileId?`, `version`. |
| `ReportSkill` | Config de skill por tipo | `type` único, `skillId`, `active`. |
| `Policy` / `Rule` | Motor de regras | `Policy.tenantId` nulável (`null` = global); `Rule.condition`/`action` em JSON; `priority`, `version`. |
| `CondominiumPolicy` | Vínculo política↔condomínio | PK composta `(condominiumId, policyId)`, `overrides?`. |
| `Partner` | Responsável técnico | `userId` único, `creaNumber`, `type` (`ENGINEER`/`ARCHITECT`), `specialties[]`, `cities[]`, `states[]`, `basePrice`, `rating`, `slaHours`. |
| `Inspection` | Vistoria | `type` (5 tipos), `status` (4 estados), `scheduledAt`, `completedAt`, `photoKeys[]`, `extraCharge`. |
| `CommercialPlan` | Plano comercial | `basePrice`, `extraInspectionPrice`, `includes` (JSON). |
| `AuditLog` | Auditoria | `action`, `triggeredBy`, `details`, `aiReasoning`. |
| `Notification` | Notificações in-app | `userId`, `title`, `body`, `read`. |

> O modelo do `schema.prisma` real é **mais completo** que o do `CLAUDE.md`: o `User`
> ganhou `condominiumId` e `passwordHash`; surgiram os modelos `ReportSkill` e
> `Notification`; `Report` ganhou `skillFileId`; `ReportType` ganhou `MEMORIAL_DESCRITIVO`
> e `CRONOGRAMA`; o enum `UserRole` ganhou `MANAGER`.

### 4.3 Enums relevantes

- **`CaseStatus`** (17): `DRAFT`, `AWAITING_SCOPE_DETAILS`, `SCOPE_CLASSIFIED`,
  `AWAITING_DOCUMENTS`, `DOCUMENTS_UNDER_REVIEW`, `PENDING_CORRECTIONS`,
  `ELIGIBLE_FOR_RELEASE`, `RELEASED_WITH_CONDITIONS`, `HUMAN_REVIEW_REQUIRED`,
  `COMMERCIAL_OFFER_SENT`, `AWAITING_PAYMENT`, `ASSIGNED_TO_PARTNER`, `ART_RRT_PENDING`,
  `INSPECTIONS_SCHEDULED`, `IN_EXECUTION`, `CONCLUDED`, `ARCHIVED`.
- **`RiskLevel`** (4): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **`DocStatus`** (6): `PENDING`, `PROCESSING`, `VALID`, `VALID_WITH_CAVEATS`, `INVALID`,
  `MISSING`.

---

## 5. Backend, endpoints e regras de negócio

### 5.1 Convenções da API

- Prefixo `/api/v1/`. Cada handler usa `withApiAuth` (exceto rotas públicas).
- `withApiAuth` injeta `AuthContext` (`userId`, `tenantId`, `role`, `tenantSlug`, `db`
  tenant-escopado) e opcionalmente restringe por papel.
- Respostas padronizadas: `apiOk(data, status)` / `apiError(message, status)`.

### 5.2 Inventário de endpoints

**Auth / público**
| Método | Rota | Papéis | Observação |
|---|---|---|---|
| `*` | `/api/auth/[...nextauth]` | público | NextAuth. |
| `POST` | `/api/v1/auth/register` | público | Cria morador. |
| `GET` | `/api/v1/auth/me` | autenticado | Dados do usuário logado. |
| `GET` | `/api/v1/public/condominiums` | público | Condomínios ativos (opcional `?tenant=slug`). |
| `GET` | `/api/v1/public/condominiums/:id/units` | público | Unidades do condomínio. |

**Casos / triagem / documentos / relatórios / comercial**
| Método | Rota | Papéis | Observação |
|---|---|---|---|
| `GET` | `/api/v1/cases` | autenticado | `CLIENT` só vê os próprios. |
| `POST` | `/api/v1/cases` | `CLIENT`,`ADMIN`,`SUPER_ADMIN` | Cria caso `DRAFT`. |
| `GET` | `/api/v1/cases/:id` | autenticado | `CLIENT` só o próprio. |
| `PATCH` | `/api/v1/cases/:id/status` | `ADMIN`,`SUPER_ADMIN`,`CONDOMINIUM` | Transição manual genérica. |
| `GET/POST` | `/api/v1/cases/:id/messages` | autenticado | Chat (POST não-streaming). |
| `GET` | `/api/v1/cases/:id/messages/stream` | autenticado | **SSE** — fluxo de triagem real. |
| `GET/POST` | `/api/v1/cases/:id/documents` | autenticado | Upload/listagem. |
| `GET` | `/api/v1/cases/:id/documents/:docId/url` | autenticado | Signed URL (TTL 1 h). |
| `GET` | `/api/v1/cases/:id/reports` | autenticado | Lista relatórios. |
| `POST` | `/api/v1/cases/:id/reports/generate` | `PARTNER` | Gera Memorial/Cronograma. |
| `GET` | `/api/v1/cases/:id/reports/:reportId/file` | autenticado | Baixa arquivo da skill. |
| `GET/POST` | `/api/v1/cases/:id/inspections` | GET autenticado / POST `SUPER_ADMIN`,`ADMIN`,`CONDOMINIUM`,`MANAGER` | Lista/cria vistoria. |
| `GET` | `/api/v1/cases/:id/commercial` | autenticado | Proposta do caso. |
| `POST` | `/api/v1/cases/:id/commercial/quote` | `SUPER_ADMIN`,`ADMIN`,`CONDOMINIUM`,`MANAGER` | Envia proposta. |
| `POST` | `/api/v1/cases/:id/commercial/accept` | autenticado | Morador aceita. |
| `POST` | `/api/v1/cases/:id/commercial/confirm-payment` | `SUPER_ADMIN`,`ADMIN`,`CONDOMINIUM`,`MANAGER` | Confirma pagamento. |
| `GET` | `/api/v1/condominiums` + `.../:id/units` | autenticado | Condomínios/unidades do tenant. |
| `GET` | `/api/v1/notifications` · `PATCH .../:id` | autenticado | Notificações in-app. |

**Admin** (`/api/v1/admin/*`, restrito a `SUPER_ADMIN`/`ADMIN`/`CONDOMINIUM`, alguns +`MANAGER`)
`GET /admin/cases`, `GET /admin/dashboard`, `GET /admin/review-queue`,
`POST /admin/review/:caseId`, `GET /admin/partners`, `GET /admin/policies`,
`GET /admin/commercial-plans`, `POST /admin/cases/:id/assign-partner`.

**Partner** (`/api/v1/partner/*`, restrito a `PARTNER`)
`GET /partner/cases`, `GET /partner/cases/:id`, `PATCH /partner/cases/:id/status`,
`PATCH /partner/cases/:id/inspections/:inspId`.

**Superadmin** (`/api/v1/superadmin/*`, restrito a `SUPER_ADMIN`)
`GET /superadmin/dashboard`; `GET/POST /superadmin/tenants` + `PATCH .../:id`;
`GET/POST /superadmin/users` + `PATCH .../:id`; `GET/POST /superadmin/policies` +
`DELETE .../:id` + `POST .../:id/rules` + `PATCH/DELETE .../:id/rules/:ruleId`;
`GET /superadmin/report-skills` + `PUT .../:type`.

### 5.3 State Machine do caso

`src/modules/case-intake/domain/entities/CaseStateMachine.ts` — entidade de domínio pura.

- Mapa fixo de transições válidas (`CaseStateMachine.ts:4-37`). Transição inválida lança
  `InvalidTransitionError` (`shared/errors`).
- **Regra de negócio crítica** (`CaseStateMachine.ts:70-80`): caso `HIGH` ou `CRITICAL`
  só pode ir para `ELIGIBLE_FOR_RELEASE` se o status anterior foi
  `HUMAN_REVIEW_REQUIRED`; senão lança `BusinessRuleViolationError`.
- `TransitionCaseStatusUseCase` usa a máquina, persiste o status, grava
  `CaseTransitionLog` e `AuditLog`.
- Cobertura de teste: `CaseStateMachine.test.ts` (Vitest).

### 5.4 Fluxo de triagem por IA (o coração do app)

Dois caminhos para a mesma lógica:
1. `SendMessageUseCase` (`src/modules/case-intake/application/use-cases/SendMessageUseCase.ts`)
   — usado pelo `POST /messages` (não-streaming).
2. **Reimplementação inline** na rota SSE `messages/stream/route.ts` — é a que a UI do
   morador realmente usa.

⚠ As duas versões duplicam a lógica e podem divergir com o tempo.

Sequência (versão SSE, `messages/stream/route.ts`):
1. Se o caso está `DRAFT` → transiciona para `AWAITING_SCOPE_DETAILS` e loga.
2. Salva a mensagem do usuário; emite evento SSE `user_message`.
3. `TriageAgent.processStream()` (`application/agents/TriageAgent.ts`) chama o LLM em
   streaming com um **system prompt** detalhado (lista de 14 serviços canônicos, guia de
   risco/ART, mapeamento de descrições populares→serviço) e uma **tool** `submit_scope`.
4. Quando a IA chama `submit_scope`, a entrada é validada por `ReformScopeSchema` (Zod).
5. Com o escopo válido: carrega a **política** (do condomínio via `CondominiumPolicy`,
   senão a política global ativa mais recente).
6. `DeterministicEvaluator.evaluate(scope, policy)` calcula score/risco — **lógica
   determinística, sem IA** (`rule-engine/domain/evaluator/DeterministicEvaluator.ts`):
   - Soma `riskDelta` de cada regra cuja condição casa; `score` é limitado a 100.
   - Faixas de risco: ≤20 `LOW`, ≤45 `MEDIUM`, ≤70 `HIGH`, >70 `CRITICAL`.
   - `requiresART` = `"uncertain"` se nenhuma regra disparou.
7. Persiste `reformScope`, `evaluationResult`, `riskLevel`, `triageScore`, `requiresART`.
8. Transiciona: `HUMAN_REVIEW_REQUIRED` se `requiresHumanReview`, senão `SCOPE_CLASSIFIED`.
9. Emite evento SSE `done` com o `evaluationResult`.

Isso respeita o princípio do `CLAUDE.md`: **IA sugere → Rule Engine valida → State Machine
executa**. O resultado é determinístico e explicável (lista de regras disparadas).

### 5.5 Outras regras de negócio relevantes

- **Proposta comercial** (`SendCommercialOfferUseCase`): só permitida a partir de
  `SCOPE_CLASSIFIED` ou `ASSIGNED_TO_PARTNER`; transiciona para `COMMERCIAL_OFFER_SENT`.
- **Aceite da proposta**: só se o caso está `COMMERCIAL_OFFER_SENT` →
  `AWAITING_PAYMENT`.
- **Confirmar pagamento**: `AWAITING_PAYMENT` → `ASSIGNED_TO_PARTNER`.
  ⚠ **Lacuna lógica:** esse caminho leva a `ASSIGNED_TO_PARTNER` **sem nunca atribuir um
  parceiro** — o `partnerId` continua nulo, e a UI de atribuição de parceiro
  (`review-queue/[id]`) só aparece para `ELIGIBLE_FOR_RELEASE`/`RELEASED_WITH_CONDITIONS`,
  não para `ASSIGNED_TO_PARTNER`. Um caso que passa pelo fluxo comercial fica órfão de
  parceiro e bloqueia a geração de relatórios/vistorias.
- **Atribuição de parceiro** (`AssignPartnerUseCase`): `ELIGIBLE_FOR_RELEASE` ou
  `RELEASED_WITH_CONDITIONS` → `ASSIGNED_TO_PARTNER`, gravando `partnerId`.
- **Vistorias** (`CreateInspectionUseCase`): exige parceiro atribuído; só permitida nos
  status `ASSIGNED_TO_PARTNER`/`ART_RRT_PENDING`/`INSPECTIONS_SCHEDULED`/`IN_EXECUTION`.
- **Avanço de status pelo parceiro**: `partner/cases/:id/status` só aceita transições da
  tabela `PARTNER_ALLOWED` (ASSIGNED→ART_RRT_PENDING→INSPECTIONS_SCHEDULED→IN_EXECUTION→
  CONCLUDED).
- **Upload de documento** (`UploadDocumentUseCase`): valida MIME
  (PDF/JPEG/PNG/WebP), máx. 20 MB; salva no storage; enfileira job no BullMQ.
- **Signed URLs**: TTL de 3600 s (`GetDocumentUrlUseCase.ts:5`).
- **Auditoria**: `AuditLog` é gravado em criação de caso, classificação por IA,
  mudança de status, atribuição de parceiro, envio de proposta, agendamento de vistoria
  e geração de relatório. A classificação por IA grava `aiReasoning` com escopo +
  resultado + regras (`SendMessageUseCase.ts:114-125`).

### 5.6 Pipeline documental (worker)

`src/infrastructure/queue/workers/document.worker.ts` (executável via `bun run worker`):
- Consome a fila `document-processing` (BullMQ, 3 tentativas, backoff exponencial).
- Baixa o arquivo via signed URL; extrai texto: `pdf-parse` para PDF, **Tesseract.js
  (idioma `por`)** para imagens.
- Atualiza `Document.status` para `VALID` ou `INVALID` e grava `extractedText`.
- Emite o evento interno `DOCUMENT_PROCESSED`.

⚠ **O pipeline está incompleto** em relação ao `CLAUDE.md`: o worker faz **apenas OCR**.
As etapas previstas de extração estruturada por LLM, validação cross-document,
preenchimento de `extractedData`/`inconsistencies`/`pendencies`, atualização de checklist
e recálculo de status do caso **não estão implementadas**. Não existem `DocumentAgent`
nem `AnalysisAgent` (são citados no `CLAUDE.md`, mas não há arquivos). O `eventBus`
(`shared/events`) é definido e o evento é emitido, mas **nenhum handler o escuta**.

---

## 6. Integrações externas

| Integração | Como é usada | Onde | Estado |
|---|---|---|---|
| **Anthropic Claude API** (chat de triagem) | `AnthropicProvider` — modelo `claude-sonnet-4-6`; `messages.create` / `messages.stream`; tool `submit_scope`. | `document-intelligence/infrastructure/llm/AnthropicProvider.ts` | Funcional. ⚠ Modelo `claude-sonnet-4-6` diverge do `claude-sonnet-4-20250514` fixado no `CLAUDE.md`. |
| **Anthropic Agent Skills + Files API** (geração de relatórios) | `SkillProvider` — modelo `claude-sonnet-4-6`, betas `code-execution`/`skills`/`files-api`; executa uma skill, lida com `pause_turn`, extrai `file_id`, baixa o arquivo. | `document-generation/infrastructure/SkillProvider.ts` | Funcional, depende de `skillId` configurado pelo Super Admin. |
| **MinIO (S3-compatível)** | Adapter de storage: upload, signed URL, delete; cria o bucket se não existir. | `infrastructure/storage/MinIOAdapter.ts` | Funcional. ⚠ Só MinIO existe — não há `S3Adapter`; `getStorageAdapter` lança erro para qualquer outro valor. |
| **Redis + BullMQ** | Fila `document-processing` para o pipeline de OCR. | `infrastructure/queue/` | Funcional (worker roda como processo à parte). |
| **PostgreSQL + pgvector** | Banco principal; extensão `pgvector` habilitada. | `docker-compose.yml`, `schema.prisma` | Banco funcional; **`pgvector`/RAG não usado** por nenhum modelo. |
| **Tesseract.js** | OCR de imagens no worker. | `document.worker.ts` | Funcional. |
| **Pagamento** | — | — | **Não há integração de pagamento.** "Confirmar pagamento" é uma ação manual do admin que só muda o status; nenhum gateway. |
| **E-mail / SMS / push** | — | — | **Inexistente.** Notificações são apenas in-app (modelo `Notification` + polling). |

Variáveis de ambiente (`.env.example`): `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`,
`NEXTAUTH_URL`, `ANTHROPIC_API_KEY`, `STORAGE_ADAPTER`, `MINIO_*`, `NEXT_PUBLIC_APP_URL`.

> Os arquivos `.env` e `apps/web/.env.local` existem no repositório (versionados) e podem
> conter segredos reais — não foram inspecionados nem citados aqui. Vale revisar.

---

## 7. Inventário de funcionalidades — pronto vs. incompleto

### ✅ Funcionalidades implementadas e aparentemente completas

- Autenticação por credenciais (NextAuth, JWT) e cadastro de morador.
- Multi-tenancy via extensão do Prisma Client (isolamento automático por `tenantId`).
- Guarda de rotas por papel no middleware (`proxy.ts`) — exceto a área do parceiro (§2.4).
- CRUD de **tenants** e **usuários** (Super Admin).
- CRUD de **políticas e regras** globais (Super Admin); visualização (Admin).
- Configuração de **Report Skills** (Super Admin).
- Criação de casos pelo morador.
- **Chat de triagem por IA com streaming SSE** + tool `submit_scope`.
- **Motor de regras determinístico** com score, risco, ART, revisão, vistoria.
- **State machine** completa, com transições validadas e log.
- Upload/listagem/download de documentos (signed URLs, validação de MIME/tamanho).
- OCR de documentos via worker BullMQ.
- Fila de revisão humana e tela de decisão do revisor (4 ações com motivo).
- Atribuição de parceiro; envio de proposta comercial; aceite; confirmação de pagamento.
- Agendamento de vistorias (admin) e registro de conclusão (parceiro).
- Geração de relatórios (Memorial Descritivo, Cronograma) via Anthropic Skills + download.
- Dashboards de admin e de superadmin; notificações in-app.
- Auditoria (`AuditLog`) das decisões operacionais.

### ⚠ Incompleto, parcial ou com problema

| Item | Situação |
|---|---|
| **Roteamento da área do Parceiro** | Pasta `(partner)/` é route group → URLs colidem com `/cases` do morador; `proxy.ts` e UI esperam `/partner/cases`, que não existe. Provável bug — ver §2.4. |
| **Pipeline documental** | Worker faz **só OCR**. Sem extração estruturada por LLM, sem validação cross-document, sem `DocumentAgent`/`AnalysisAgent`, sem checklist, sem recálculo de status. |
| **`eventBus`** | Definido e o evento `DOCUMENT_PROCESSED` é emitido, mas **nenhum handler escuta** nada. |
| **Fluxo `AWAITING_PAYMENT → ASSIGNED_TO_PARTNER`** | Leva a `ASSIGNED_TO_PARTNER` **sem atribuir parceiro**; não há UI para atribuir parceiro nesse estado (lacuna lógica — §5.5). |
| **Transições `AWAITING_DOCUMENTS`/`DOCUMENTS_UNDER_REVIEW`/`PENDING_CORRECTIONS`** | Existem na state machine, mas **nenhum fluxo automático as aciona**; só dá para chegar via `PATCH /cases/:id/status` manual. |
| **Criação de `PARTNER` pelo Super Admin** | Cria o `User` mas **não cria o registro `Partner`** (CREA, preço, especialidades). Sem `Partner`, as rotas do parceiro falham. Só o parceiro do seed funciona. |
| **Lógica duplicada de triagem** | `SendMessageUseCase` vs. reimplementação inline em `messages/stream/route.ts`. |
| **`UserRole` no TypeScript** | Falta `MANAGER` em `src/shared/types/index.ts` (presente no enum Prisma). |
| **Templates Markdown** | `packages/templates/*.md` (6 arquivos) **não são usados** — a geração de relatórios usa Anthropic Skills, não esses templates. |
| **`pgvector` / RAG** | Extensão habilitada, nenhum modelo `vector`, nenhuma busca semântica. |
| **Hash de senha** | SHA-256 com sal fixo global — fraco para produção (§2.2). |
| **Testes** | Apenas 2 testes unitários Vitest (`CaseStateMachine.test.ts`, `DeterministicEvaluator.test.ts`). **Sem testes E2E** apesar de `test:e2e`/Playwright estarem configurados. |
| **`S3Adapter`** | Mencionado na arquitetura, **não existe** — só MinIO. |
| **Pagamento real / e-mail / push** | Inexistentes — ver §6. |
| **Dashboard do admin** | Links da tabela apontam para `/cases/:id` (área do morador) em vez de `/admin/review-queue/:id`. |
| **`docs/`** | Pasta vazia. |
| **Arquivo solto** | `skill-memorial-descritivo-nbr16280.zip` na raiz do repo (provável pacote da skill subido manualmente). |

---

## 8. Reaproveitamento e adaptação para Next.js 14 + Prisma + Tailwind

O código atual roda em **Next.js 16 + React 19 + Tailwind v4 + Prisma 6 + Bun**. O alvo é
**Next.js 14 + Prisma + Tailwind**. A boa notícia: a maior parte do código é **portável**,
porque toda a lógica de negócio vive em camadas de domínio/aplicação **sem nenhum import
de `next/*`**. Migrar 16 → 14 é, em essência, um **downgrade mecânico** concentrado em
poucos pontos transversais. Prisma continua Prisma (sem mudança estrutural).

> Sobre a versão do Tailwind: o projeto usa hoje a **v4** (sintaxe `@import "tailwindcss"`
> + `@theme inline`). O Tailwind v4 é agnóstico de framework e **roda também no Next 14** —
> se a equipe optar por manter a v4, o item 7 da §8.1 desaparece. Abaixo considero a
> hipótese mais comum no ecossistema Next 14, que é **Tailwind v3**.

### 8.1 Adaptações transversais (afetam quase tudo)

| # | Mudança | Motivo | Onde corrigir | Esforço |
|---|---|---|---|---|
| 1 | **`params` síncrono** | No Next 14, `params` (em route handlers e pages) é objeto simples; o Next 15+ o tornou `Promise`. | `src/infrastructure/auth/api-auth.ts:15,41` (tipo `RouteContext` e `await routeCtx.params`); `app/api/v1/public/condominiums/[id]/units/route.ts:4-5` (`await params`); `app/(partner)/cases/[id]/page.tsx:438-439` (`use(params)`). Remover `Promise<>`, `await`, `use()`. | **Baixo** — como `withApiAuth` centraliza o tratamento, corrigir 1 arquivo conserta as ~40 rotas que o usam. |
| 2 | **`cookies()` síncrono** | `cookies()` de `next/headers` virou assíncrono só no Next 15. | `src/infrastructure/auth/session.ts:17` — remover o `await`. (Obs.: `getAppSession` não parece ser usado por nenhuma rota/página — pode até ser removido.) | Baixo |
| 3 | **Middleware** | O Next 16 renomeou `middleware.ts`→`proxy.ts` e o export `middleware`→`proxy`. | Renomear `apps/web/proxy.ts` → `apps/web/middleware.ts` e `export function proxy` → `export function middleware`. `config.matcher` e toda a lógica permanecem idênticos. | Baixo |
| 4 | **`next.config.ts` → `.js`/`.mjs`** | Config em TypeScript só passou a ser suportada no Next 15. | `apps/web/next.config.ts` (está praticamente vazio — conversão trivial). | Baixo |
| 5 | **React 19 → 18** | Next 14 pareia com React 18. | `apps/web/package.json`: `react`/`react-dom` `19.2.4`→`18.3.x`; `@types/react`/`@types/react-dom` 19→18. Único uso de API exclusiva do React 19 encontrado é o `use(params)` (item 1) — o resto usa só `useState`/`useEffect`/`useRef`/`useCallback`. | Baixo |
| 6 | **`next` 16.2.4 → 14.x** | — | `apps/web/package.json`. | Médio (resolver versões de dependências). |
| 7 | **Tailwind v4 → v3** (se o alvo for v3) | Hoje: `globals.css` usa `@import "tailwindcss"` + bloco `@theme inline`; `postcss.config.mjs` usa `@tailwindcss/postcss`; **não há `tailwind.config.js`**. | (a) trocar o plugin PostCSS por `tailwindcss` + `autoprefixer`; (b) criar `tailwind.config.js` com `content` apontando para `app/**` e `src/**`; (c) em `app/globals.css`, trocar `@import "tailwindcss"` por `@tailwind base; @tailwind components; @tailwind utilities;` e mover o `@theme inline` (cores/fontes) para `theme.extend`. **As classes utilitárias das ~30 telas são compatíveis com a v3 — não há reescrita de markup.** | Médio (config, não telas). |
| 8 | **(Opcional) Bun → Node** | O alvo cita "Next 14 + Prisma + Tailwind", não menciona runtime. | Se sair do Bun: o worker roda via `bun src/.../worker.ts` e o seed via `bun run prisma/seed.ts` (TS direto) — em Node precisam de `tsx`/`ts-node` ou build; `bun.lock`→`package-lock.json`; remover `@types/bun`. Se mantiver o Bun, nada muda. | Médio |

### 8.2 O que NÃO precisa mudar

- **Prisma** — o alvo já é Prisma. `schema.prisma`, migrations, a extensão `$extends` do
  `tenant-client.ts` (API estável desde o Prisma 5) e o client gerado em
  `generated/client` são **100% portáveis**.
- **NextAuth 4.24.11** — funciona bem no Next 14 (App Router); tende a dar **menos**
  atrito que no Next 16. Sem adaptação.
- **Anthropic SDK, BullMQ/ioredis, MinIO SDK, Tesseract, pdf-parse, Zod** — independentes
  do Next. Sem adaptação.
- **`tsconfig.json`** — `moduleResolution: "bundler"`, plugin `next` e aliases de path são
  compatíveis com Next 14. Sem mudança.
- **Toda a camada de domínio/aplicação** (`src/modules/**`, `src/shared/**`) — TypeScript
  puro, sem import de `next/*`. **Reaproveitável integralmente.**

### 8.3 Avaliação por funcionalidade

**Legenda:** 🟢 reaproveitável quase integral (só as adaptações transversais da §8.1) ·
🟡 reaproveitável com ajustes pontuais · 🔴 exige retrabalho real.

| Funcionalidade | Reuso | O que adaptar (além da §8.1) |
|---|:---:|---|
| Login / NextAuth | 🟢 | `nextauth.ts` e `authorize()` portáveis. *Recomendado* (não exigido pela migração): trocar o hash SHA-256+sal fixo de `password.ts` por bcrypt/argon2. |
| Cadastro de morador | 🟢 | Rota + página portáveis. |
| Multi-tenancy (`tenant-client.ts`) | 🟢 | `$extends` do Prisma — puro. Zero mudança. |
| Middleware / guarda de rotas | 🟡 | Renomear `proxy.ts`→`middleware.ts` e o export (§8.1 item 3). Lógica intacta. |
| CRUD de tenants (superadmin) | 🟢 | Só §8.1. |
| CRUD de usuários (superadmin) | 🟢 | Só §8.1. Arrasta o defeito pré-existente "criar PARTNER não cria o registro `Partner`" (§7) — corrigir junto. |
| CRUD de políticas/regras (superadmin) | 🟢 | Só §8.1. |
| Config de Report Skills (superadmin) | 🟢 | Só §8.1. |
| Dashboard superadmin | 🟢 | Usa `prisma.groupBy`/`count` — portável. |
| Dashboard admin | 🟢 | Portável. Arrasta o defeito de links para `/cases/:id` (§7). |
| Lista de casos (admin) | 🟢 | Só §8.1. |
| Fila de revisão + tela de decisão `review-queue/[id]` | 🟢 | Página client com `useParams()` (funciona em ambas as versões). Só §8.1 + config Tailwind. |
| Atribuição de parceiro | 🟢 | `AssignPartnerUseCase` puro. |
| Proposta comercial (envio/aceite/pagamento) | 🟡 | Código portável (§8.1), mas arrasta a **lacuna lógica** do §5.5 (`AWAITING_PAYMENT→ASSIGNED_TO_PARTNER` sem parceiro). Corrigir no porte. |
| Agendamento de vistorias (admin) | 🟢 | Só §8.1. |
| Criação de caso (morador) | 🟢 | Só §8.1. |
| Chat de triagem por IA (SSE) | 🟡 | `TriageAgent`/`AnthropicProvider` 100% portáveis; a rota SSE usa `ReadableStream` + `text/event-stream` (funciona no Next 14). *Recomendado* consolidar a lógica duplicada entre `SendMessageUseCase` e a rota `messages/stream` (§5.4). |
| Motor de regras (`DeterministicEvaluator`) | 🟢 | TS puro, com teste. Zero mudança. |
| State machine (`CaseStateMachine`) | 🟢 | TS puro, com teste. Zero mudança. |
| Upload/listagem/download de documentos | 🟢 | `UploadDocumentUseCase`/`MinIOAdapter` portáveis; a rota usa `req.formData()` (suportado no Next 14). Só §8.1. |
| Worker de OCR (BullMQ) | 🟡 | Código portável; o ajuste é de **runtime** (Bun→Node, §8.1 item 8), independe do Next. Lembrar: o pipeline está incompleto (§5.6) — o porte não conserta isso. |
| Geração de relatórios (Anthropic Skills) | 🟡 | `ReportAgent`/`SkillProvider` portáveis; a rota de download usa `NextResponse` com headers binários (ok no Next 14). `SkillProvider` depende de *betas* do SDK Anthropic — manter a versão do SDK. |
| **Área do parceiro (páginas)** | 🔴 | Além da §8.1 (incl. `use(params)` no detalhe), é **obrigatório corrigir o bug de roteamento do §2.4**: renomear `app/(partner)/` → `app/partner/` para as URLs `/partner/cases` baterem com o middleware e a navegação da UI. Sem isso a área continua quebrada em qualquer versão do Next. As **APIs** do parceiro já estão corretas. |
| Avanço de status pelo parceiro (API) | 🟢 | Rota + use-case portáveis. |
| Registro de conclusão de vistoria (parceiro) | 🟢 | Só §8.1. |
| Notificações in-app | 🟢 | Rotas + polling na sidebar — portável. |
| Auditoria (`AuditLog`) | 🟢 | Gravação via repositórios Prisma — portável. |

### 8.4 Resumo do esforço

- **~90% do código é reaproveitável** apenas com as adaptações transversais mecânicas
  da §8.1. A camada de domínio/aplicação/infra é praticamente "copiar e colar".
- O esforço real concentra-se **fora** da troca de framework: (a) o **bug de roteamento
  do parceiro** (§2.4), (b) a reconfiguração **Tailwind v4 → v3** (se aplicável),
  (c) opcionalmente sair do **Bun**.
- As rotas de API quase não mudam: o ponto central é o `withApiAuth` (params síncronos)
  + 1 rota pública. A UI muda na config do Tailwind + 1 página (parceiro) + o renomeio
  de pasta `(partner)`→`partner`.
- **Recomendação:** tratar a migração e as correções de defeitos pré-existentes (§7)
  como um único trabalho — vários "ajustes" listados aqui são, na verdade, bugs que já
  existem hoje no Next 16 e não têm relação com a versão do framework.

---

## 9. Resumo executivo

Este é um **MVP funcional e razoavelmente bem estruturado** de uma plataforma SaaS
multi-tenant de triagem de reformas em condomínios. O núcleo — chat de triagem por IA,
motor de regras determinístico, state machine e fluxo operacional de revisão →
proposta → parceiro → vistorias → execução — está **implementado e coerente** com a
arquitetura DDD descrita no `CLAUDE.md`.

Os **pontos fortes**: separação de camadas limpa no núcleo (domínio puro para regras e
state machine), isolamento multi-tenant automático, IA contida atrás de interface e
sempre validada por Zod, auditoria das decisões.

Os **pontos fracos / pendências mais relevantes**:
1. **Roteamento da área do parceiro quebrado** (route group `(partner)` vs. `/partner`).
2. **Pipeline documental só faz OCR** — falta toda a inteligência documental prometida.
3. **Lacuna no fluxo comercial** que deixa casos `ASSIGNED_TO_PARTNER` sem parceiro.
4. **Criação de parceiro incompleta** (não cria o registro `Partner`).
5. **Segurança de senha fraca** e cobertura de testes mínima.

Para uma reescrita ou continuação, o núcleo de triagem/regras/estado é um bom ponto de
partida; o pipeline documental, a área do parceiro e o fluxo comercial precisam de
retrabalho.

---

### Apêndice — mapa rápido de arquivos-chave

| Tema | Arquivo |
|---|---|
| Middleware / guarda de rotas | `apps/web/proxy.ts` |
| Autenticação | `src/infrastructure/auth/{nextauth,api-auth,session,password}.ts` |
| Isolamento multi-tenant | `src/infrastructure/database/tenant-client.ts` |
| State machine | `src/modules/case-intake/domain/entities/CaseStateMachine.ts` |
| Avaliador de regras | `src/modules/rule-engine/domain/evaluator/DeterministicEvaluator.ts` |
| Agente de triagem (IA) | `src/modules/case-intake/application/agents/TriageAgent.ts` |
| Fluxo de triagem (SSE) | `app/api/v1/cases/[id]/messages/stream/route.ts` |
| Provider LLM | `src/modules/document-intelligence/infrastructure/llm/AnthropicProvider.ts` |
| Geração de relatórios | `src/modules/document-generation/{application/ReportAgent.ts,infrastructure/SkillProvider.ts}` |
| Worker documental | `src/infrastructure/queue/workers/document.worker.ts` |
| Schema do banco | `packages/database/prisma/schema.prisma` |
| Seed / dados de teste | `packages/database/prisma/seed.ts` |
