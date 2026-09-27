# PLAN.md — ReformAI (versão simples)

> Plano para refazer a plataforma do zero, num diretório novo, com o mínimo de
> arquitetura possível. O repositório antigo (`kafune/reformai`) serve só como
> **referência de regras de negócio e telas** — não como referência de código.

---

## 1. O que o produto faz (em uma frase)

O morador de um condomínio pede autorização para reformar a sua unidade, anexa
os documentos exigidos, o síndico (com apoio de um responsável técnico parceiro
quando a obra é arriscada) analisa e libera, e a obra é acompanhada por vistorias
até a conclusão.

**A plataforma não emite ART/RRT.** Quem emite é o profissional habilitado.
Todo documento gerado pela plataforma traz esse aviso.

---

## 2. O que muda em relação ao projeto atual

| Hoje | Na versão simples |
|---|---|
| Monorepo Turborepo (`apps/`, `packages/`) | **Um único app Next.js** |
| DDD: 12 bounded contexts, domain/application/infrastructure, repositórios, use cases | Pastas planas: `app/`, `lib/`, `components/`. Sem repositórios, sem use cases, sem interfaces com implementação única |
| API REST `/api/v1/**` para tudo | **Server Actions** para mutações, Server Components para leitura. Route handler só onde precisa (download de arquivo) |
| Multi-tenant (Tenant, white-label, superadmin, impersonation) | **Um só "dono"** (a sua empresa). Isolamento por condomínio. Multi-organização fica para depois |
| 18 status + `CaseStateMachine` + `CaseTransitionLog` + `AuditLog` | **8 status**, um mapa de transições num arquivo e **uma tabela `CaseEvent`** que é histórico + auditoria |
| Rule Engine com políticas/regras editáveis no banco (Policy, Rule, CondominiumPolicy, overrides) | **Uma tabela de serviços em código** (`lib/rules/services.ts`) + funções puras de risco e checklist |
| Triagem por **chat com IA** (tool-use, SSE) decidindo o escopo | **Formulário** com checkboxes de serviços. IA só *sugere* os checkboxes a partir de um texto livre |
| Pipeline documental: BullMQ + Redis + worker + Tesseract OCR + extração + análise cruzada por IA que muda status | **Humano aprova/reprova cada documento.** IA opcional dá "observações" num botão, sem mudar nada |
| 5 agentes de IA, `LLMProvider` abstrato, modelos por etapa | **Um arquivo `lib/ai.ts`** com 2 funções. Sem chave de API, o app funciona igual (só esconde os botões) |
| Relatórios via templates + IA + Agent Skills + PDFKit | **Página HTML imprimível** (termo de liberação / parecer) → "Salvar como PDF" do navegador |
| Proposta comercial com agente de IA, CommercialPlan, pagamento | Fora do MVP (ver §11). Se entrar: valor + texto digitados pelo parceiro, aceite do morador |
| RAG de normas (pgvector), PWA, Web Push, rate-limit Redis, Sentry | Fora. Nenhum desses é necessário para o fluxo principal |
| Design system próprio "Concreto Verde" | **Tailwind + shadcn/ui** padrão, com uma cor primária |

---

## 3. Princípios (curtos, para colar no CLAUDE.md)

1. **Código chato ganha.** Função simples > classe > padrão de projeto.
2. **Sem abstração antes do segundo uso.** Uma implementação = nenhuma interface.
3. **Regras de negócio em funções puras** dentro de `lib/rules/`, com teste unitário. É o único lugar com teste obrigatório.
4. **IA nunca decide.** Ela preenche sugestões que um humano confirma. Nenhuma função de IA muda status, aprova documento ou calcula risco.
5. **Permissão sempre no servidor.** Toda leitura/ação de obra passa por um helper que confere se o usuário pode ver/fazer aquilo.
6. **Tudo que muda uma obra gera um `CaseEvent`.** Sem exceção.
7. **Arquivos nunca são públicos.** Download sempre por URL assinada de curta duração.

---

## 4. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime / pacotes | Bun | já é o padrão do time |
| App | Next.js (versão estável atual, App Router) + TypeScript strict | um app só, front + back |
| UI | Tailwind + shadcn/ui | componentes prontos, sem design system próprio |
| Banco | PostgreSQL + Prisma | igual ao atual, sem extensões |
| Auth | Auth.js (NextAuth) com login por e-mail e senha | simples; senha com `scrypt` do `node:crypto` |
| Arquivos | S3-compatível via `@aws-sdk/client-s3` (MinIO local, S3/R2 em produção) | um só código para dev e prod |
| Validação | Zod nos formulários/server actions e na saída da IA | |
| IA | `@anthropic-ai/sdk`, modelo em `ANTHROPIC_MODEL` | usada em 2 pontos opcionais |
| Testes | Vitest só para `lib/rules/` (+ 1 smoke E2E no fim, opcional) | |
| Dev local | `docker-compose` com Postgres + MinIO | sem Redis |

---

## 5. Perfis e jornada

| Perfil | O que faz |
|---|---|
| `RESIDENT` (morador) | Se cadastra pelo link/QR do condomínio, cria a obra, anexa documentos, corrige pendências, inicia e acompanha a obra |
| `SYNDIC` (síndico) | Vê as obras do seu condomínio, aprova/reprova documentos, pede correção, libera ou recusa a obra |
| `PARTNER` (responsável técnico parceiro) | É o parceiro fixo de um ou mais condomínios. Dá o **parecer técnico** em obras de risco alto/crítico e faz as **vistorias** |
| `ADMIN` (sua empresa) | Cadastra condomínios, unidades, síndicos e parceiros; vê tudo; pode agir como síndico em qualquer condomínio |

Jornada feliz:

```
Morador cria obra (formulário) → sistema calcula risco + checklist de documentos
  → morador anexa documentos → envia para análise
  → [risco ALTO/CRÍTICO] parceiro escreve parecer técnico
  → síndico revisa documentos → libera (com ou sem condições)
  → morador inicia a obra → parceiro agenda/conclui vistorias
  → vistoria final concluída → obra concluída
```

---

## 6. Status da obra

| Status | Rótulo na tela | Quem leva para cá |
|---|---|---|
| `DRAFT` | Rascunho | criação |
| `UNDER_REVIEW` | Em análise | morador (enviar) |
| `CHANGES_REQUESTED` | Correção solicitada | síndico |
| `APPROVED` | Liberada | síndico |
| `REJECTED` | Recusada | síndico |
| `IN_PROGRESS` | Em execução | morador (iniciar obra) |
| `COMPLETED` | Concluída | sistema, ao concluir a vistoria final (ou síndico, se a obra não exige vistoria) |
| `CANCELLED` | Cancelada | morador (enquanto não iniciada) ou admin |

Transições válidas (`lib/rules/status.ts`, um objeto simples):

```
DRAFT             → UNDER_REVIEW, CANCELLED
UNDER_REVIEW      → CHANGES_REQUESTED, APPROVED, REJECTED, CANCELLED
CHANGES_REQUESTED → UNDER_REVIEW, CANCELLED
APPROVED          → IN_PROGRESS, CANCELLED
IN_PROGRESS       → COMPLETED
REJECTED, COMPLETED, CANCELLED → (fim)
```

Guardas (também funções puras, com teste):

- **Enviar para análise** (`DRAFT|CHANGES_REQUESTED → UNDER_REVIEW`): todos os documentos obrigatórios do checklist foram anexados.
- **Liberar** (`→ APPROVED`): todos os documentos obrigatórios estão `APPROVED` **e**, se risco `HIGH` ou `CRITICAL`, existe parecer técnico do parceiro favorável.
- **Concluir** (`→ COMPLETED`): se a obra exige vistorias, a vistoria `FINAL` está concluída.
- Transição inválida lança erro — nunca é ignorada em silêncio.

---

## 7. Regras de negócio (o coração — `lib/rules/`)

### 7.1 Tabela de serviços (`services.ts`)

Mesma tabela do projeto atual, agora em código:

| Serviço | Pontos | Exige ART/RRT | Exige parecer técnico | Exige vistoria de sistema crítico |
|---|---|---|---|---|
| Pintura simples | 5 | não | não | não |
| Troca de piso sem demolição | 10 | não | não | não |
| Troca de piso com demolição | 25 | sim | não | não |
| Elétrica | 30 | sim | não | não |
| Hidráulica | 30 | sim | não | não |
| Gás | 40 | sim | não | sim |
| Impermeabilização | 35 | sim | não | sim |
| Ar-condicionado (split) | 15 | não | não | não |
| Mudança de layout | 20 | sim | não | não |
| Demolição de alvenaria | 40 | sim | sim | não |
| Impacto estrutural/prumadas | 60 | sim | sim | sim |
| Fachada | 45 | sim | sim | não |
| Esquadrias externas | 20 | sim | não | não |
| Equipamentos fixos pesados | 25 | sim | não | não |

Flags extras do formulário somam pontos: afeta área comum (+10), afeta fachada (+20), afeta estrutura (+30). *(valores iniciais — ajuste à vontade, é só editar o arquivo)*

### 7.2 Risco (`risk.ts`)

`calculateRisk(services, flags) → { score, level, requiresArt, requiresTechnicalOpinion, requiresInspections }`

- `score` = soma dos pontos, teto 100.
- `level`: ≤20 `LOW`, ≤45 `MEDIUM`, ≤70 `HIGH`, senão `CRITICAL`.
- `requiresArt` = algum serviço exige.
- `requiresTechnicalOpinion` = algum serviço exige **ou** nível `HIGH`/`CRITICAL`.
- `requiresInspections` = nível ≥ `MEDIUM` ou algum serviço exige vistoria de sistema crítico.

O risco é calculado **no servidor** ao salvar a obra e gravado na obra (não confie no cliente).

### 7.3 Checklist de documentos (`checklist.ts`)

`requiredDocuments(risk) → DocumentType[]`

| Nível | Documentos obrigatórios |
|---|---|
| LOW | nenhum (termo de responsabilidade opcional) |
| MEDIUM | Termo de responsabilidade |
| HIGH | + ART/RRT, Memorial descritivo |
| CRITICAL | + Projeto, Cronograma, Relação da equipe |

E sempre que `requiresArt` for verdadeiro, ART/RRT entra, mesmo em nível baixo.

### 7.4 Vistorias (`inspections.ts`)

- Sequência: `INITIAL` → `INTERMEDIATE` (se houver) → `CRITICAL_SYSTEM` (se gás/impermeabilização/estrutural) → `FINAL`.
- **Impermeabilização exige vistoria `INTERMEDIATE` concluída antes da `FINAL`.** Não é configurável.
- Só se agenda vistoria com a obra em `IN_PROGRESS`.
- `nextAllowedInspections(obra, vistorias) → InspectionType[]` + `canComplete(obra, vistorias)`.

### 7.5 Outras regras

- A plataforma não emite ART/RRT; toda página imprimível tem o aviso de responsabilidade técnica.
- Morador só vê as próprias obras; síndico só as do seu condomínio; parceiro só as dos condomínios em que é parceiro; admin vê tudo.
- LGPD: consentimento registrado no cadastro; exclusão de conta = anonimização (nome/e-mail/telefone trocados), obras e histórico preservados.

---

## 8. Modelo de dados (esboço Prisma)

Nomes de código em inglês, textos de tela em português.

```prisma
model User {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  phone            String?
  passwordHash     String
  role             Role
  condominiumId    String?   // RESIDENT e SYNDIC
  professionalType String?   // PARTNER: "ENGINEER" | "ARCHITECT"
  professionalId   String?   // PARTNER: número CREA/CAU
  lgpdConsentAt    DateTime?
  active           Boolean   @default(true)
  createdAt        DateTime  @default(now())
}
enum Role { ADMIN SYNDIC RESIDENT PARTNER }

model Condominium {
  id        String  @id @default(cuid())
  name      String
  address   String
  city      String
  state     String
  partnerId String?          // parceiro técnico fixo
  signupCode String @unique  // usado no link/QR de cadastro
  active    Boolean @default(true)
  units     Unit[]
}

model Unit {
  id            String  @id @default(cuid())
  condominiumId String
  block         String?
  number        String
  residentId    String?
  @@unique([condominiumId, block, number])
}

model Case {
  id                String     @id @default(cuid())
  protocol          String     @unique   // ex: RF-2026-000123
  condominiumId     String
  unitId            String
  residentId        String
  status            CaseStatus @default(DRAFT)
  services          String[]
  affectsCommonArea Boolean    @default(false)
  affectsFacade     Boolean    @default(false)
  affectsStructure  Boolean    @default(false)
  description       String
  plannedStart      DateTime?
  plannedEnd        DateTime?
  contractorName    String?    // quem executa
  // calculado no servidor por lib/rules/risk.ts
  riskScore         Int
  riskLevel         RiskLevel
  requiresArt       Boolean
  requiresTechnicalOpinion Boolean
  requiresInspections      Boolean
  // parecer do parceiro
  technicalOpinion       String?
  technicalOpinionResult OpinionResult?   // FAVORABLE | FAVORABLE_WITH_CONDITIONS | UNFAVORABLE
  technicalOpinionAt     DateTime?
  // decisão do síndico
  approvalConditions String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Document {
  id           String    @id @default(cuid())
  caseId       String
  type         DocumentType
  fileName     String
  storageKey   String
  mimeType     String
  sizeBytes    Int
  status       DocStatus @default(PENDING)  // PENDING | APPROVED | REJECTED
  reviewNote   String?
  aiNotes      Json?     // observações da IA (só informativas)
  uploadedById String
  createdAt    DateTime  @default(now())
}

model Inspection {
  id          String   @id @default(cuid())
  caseId      String
  type        InspectionType   // INITIAL | INTERMEDIATE | CRITICAL_SYSTEM | FINAL
  scheduledAt DateTime
  completedAt DateTime?
  result      String?          // OK | WITH_ISSUES
  notes       String?
  photoKeys   String[]
}

// Histórico + auditoria + base das notificações. Uma tabela só.
model CaseEvent {
  id         String   @id @default(cuid())
  caseId     String
  userId     String?  // null = sistema
  type       String   // "status_changed" | "document_uploaded" | "document_reviewed"
                      // | "opinion_submitted" | "inspection_scheduled" | "inspection_completed"
                      // | "comment" | "ai_suggestion"
  fromStatus CaseStatus?
  toStatus   CaseStatus?
  message    String?
  data       Json?
  createdAt  DateTime @default(now())
}
```

Sem `Tenant`, `Policy`, `Rule`, `Report`, `ReportSkill`, `ChatMessage`,
`CommercialPlan`, `Notification`, `PushSubscription`, `NormChunk`.

---

## 9. Onde a IA entra (e onde não entra)

Tudo em `lib/ai.ts`. Se `ANTHROPIC_API_KEY` não estiver definida, as funções
não são chamadas e os botões não aparecem.

| # | Onde | O que faz | O que **não** faz |
|---|---|---|---|
| 1 | Formulário de nova obra — botão "Sugerir serviços a partir da descrição" | Lê o texto livre do morador e devolve quais serviços da tabela se aplicam + flags. Saída validada com Zod; serviços fora da lista são descartados. Marca os checkboxes; **o morador confirma** | Não calcula risco, não salva nada |
| 2 | Tela de análise do documento — botão "Observações da IA" | Manda o PDF/imagem direto para o Claude (leitura nativa de PDF e imagem — **sem OCR**) com o tipo esperado do documento e dados da obra; devolve uma lista curta de observações (ex.: "ART não menciona o endereço da unidade"). Grava em `Document.aiNotes` e um `CaseEvent` `ai_suggestion` | Não aprova nem reprova. Quem decide é o síndico |

Regras:
- Chamada síncrona dentro da server action, com timeout. Sem fila.
- Saída sempre validada com Zod; se falhar, mostra "IA indisponível" e segue.
- O prompt nunca contém regra de negócio (pontos, níveis, checklist) — isso está em `lib/rules/`.

---

## 10. Estrutura de pastas

```
/
├── app/
│   ├── (public)/
│   │   ├── login/
│   │   └── cadastro/[signupCode]/        # autocadastro do morador (link/QR)
│   ├── (app)/
│   │   ├── layout.tsx                    # exige login, menu por perfil
│   │   ├── obras/                        # lista (filtrada por perfil)
│   │   ├── obras/nova/                   # formulário (morador)
│   │   ├── obras/[id]/                   # detalhe: resumo, documentos, parecer, vistorias, histórico
│   │   ├── obras/[id]/imprimir/          # termo de liberação / parecer imprimível
│   │   └── admin/                        # condomínios, unidades, usuários
│   └── api/files/[documentId]/route.ts   # redireciona para URL assinada (após checar permissão)
├── lib/
│   ├── db.ts                             # Prisma client
│   ├── auth.ts                           # Auth.js + getCurrentUser()
│   ├── permissions.ts                    # canViewCase, canReviewCase, getCaseForUser...
│   ├── storage.ts                        # upload(), signedUrl() — S3 client direto
│   ├── ai.ts                             # suggestServices(), reviewDocument()
│   ├── events.ts                         # logEvent(tx, ...)
│   ├── rules/                            # PURO, sem Prisma, sem Next, com testes
│   │   ├── services.ts
│   │   ├── risk.ts        risk.test.ts
│   │   ├── checklist.ts   checklist.test.ts
│   │   ├── status.ts      status.test.ts
│   │   └── inspections.ts inspections.test.ts
│   └── actions/                          # server actions ("use server"), finas
│       ├── cases.ts  documents.ts  review.ts  inspections.ts  admin.ts
├── components/                           # shadcn/ui + componentes da tela
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker-compose.yml                    # postgres + minio
├── .env.example
├── CLAUDE.md
└── PLAN.md
```

Padrão de uma server action (todas seguem isso):

```ts
export async function approveCase(caseId: string, input: unknown) {
  const user = await getCurrentUser()                       // 1. quem é
  const data = ApproveSchema.parse(input)                   // 2. valida
  const c = await getCaseForUser(user, caseId)              // 3. pode ver?
  assertCan(user, "review", c)                              // 4. pode fazer?
  const docs = await db.document.findMany({ where: { caseId } })
  assertCanApprove(c, docs)                                 // 5. regra pura (lib/rules)
  await db.$transaction(async (tx) => {                     // 6. grava + evento
    await tx.case.update({ where: { id: caseId }, data: { status: "APPROVED", approvalConditions: data.conditions } })
    await logEvent(tx, { caseId, userId: user.id, type: "status_changed", fromStatus: c.status, toStatus: "APPROVED" })
  })
  revalidatePath(`/obras/${caseId}`)
}
```

---

## 11. Fases

Cada fase termina com: testes passando, `bun run lint` e `bun run typecheck` limpos,
um commit, e um resumo curto do que foi feito. **Não avançar de fase sem confirmação.**

### Fase 0 — Esqueleto
- [ ] `bun create next-app` (TypeScript, Tailwind, App Router, sem `src/`)
- [ ] shadcn/ui inicializado com poucos componentes (button, input, card, table, badge, dialog, form)
- [ ] Prisma + `docker-compose.yml` (Postgres + MinIO) + `.env.example`
- [ ] Vitest configurado; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`
- [ ] `CLAUDE.md` curto (≤ 80 linhas) com princípios da §3, comandos e pastas
- **Pronto quando:** `bun dev` abre uma página, `bun test` roda (0 testes ok).

### Fase 1 — Regras puras
- [ ] `lib/rules/services.ts`, `risk.ts`, `checklist.ts`, `status.ts`, `inspections.ts`
- [ ] Testes cobrindo: cada nível de risco nos limites (20/21, 45/46, 70/71), teto 100, flags; checklist por nível + ART forçada; todas as transições válidas e algumas inválidas; guardas de enviar/liberar/concluir; ordem das vistorias e a regra da impermeabilização
- **Pronto quando:** `bun test` verde, zero import de Prisma/Next em `lib/rules/`.

### Fase 2 — Banco, login e esqueleto de telas
- [ ] `schema.prisma` da §8 + primeira migration
- [ ] `seed.ts`: 1 condomínio (com parceiro fixo), 4 unidades, usuários `admin@demo.com`, `sindico@demo.com`, `morador@demo.com`, `parceiro@demo.com` (senha `senha123`)
- [ ] Auth.js com credenciais, hash `scrypt`; `getCurrentUser()`
- [ ] Layout logado com menu por perfil; redireciona para `/obras` após login
- [ ] `lib/permissions.ts` com testes simples (funções puras que recebem user + case)
- **Pronto quando:** cada usuário demo loga e vê o menu certo.

### Fase 3 — Morador cria e envia a obra
- [ ] `/cadastro/[signupCode]`: nome, e-mail, telefone, senha, bloco/unidade, aceite LGPD → cria usuário e vincula/cria a unidade (recusa se a unidade já tem outro morador)
- [ ] `/obras/nova`: checkboxes de serviços, flags, descrição, datas, executor → salva como `DRAFT` com risco calculado
- [ ] `/obras/[id]`: mostra risco, o que é exigido (ART, parecer, vistorias) e o checklist de documentos
- [ ] Upload de documento (PDF/JPG/PNG, até 20 MB) → storage → `Document` `PENDING` → `CaseEvent`
- [ ] Botão "Enviar para análise" (só habilita com checklist completo)
- [ ] Histórico (timeline de `CaseEvent`) na página da obra
- **Pronto quando:** morador demo cria uma obra de risco alto, anexa os docs e envia.

### Fase 4 — Síndico analisa e libera
- [ ] `/obras` do síndico: lista do condomínio com filtros por status
- [ ] Ver documento (URL assinada de 1h via `/api/files/[id]`)
- [ ] Aprovar/reprovar documento com nota
- [ ] Pedir correção (texto) → `CHANGES_REQUESTED`; morador reenvia documento e a obra volta para `UNDER_REVIEW`
- [ ] Liberar (com condições opcionais) ou recusar (motivo obrigatório); botão de liberar mostra o motivo quando bloqueado (ex.: "falta parecer técnico")
- **Pronto quando:** o ciclo enviar → corrigir → reenviar → liberar funciona com os usuários demo.

### Fase 5 — Parceiro: parecer e vistorias
- [ ] Parceiro vê as obras dos condomínios em que é fixo; destaque para "aguardando parecer"
- [ ] Formulário de parecer técnico (resultado + texto) → libera a guarda do síndico
- [ ] Morador clica "Iniciar obra" (`APPROVED → IN_PROGRESS`)
- [ ] Parceiro agenda vistorias (só os tipos que `nextAllowedInspections` permite), conclui com notas e fotos
- [ ] Concluir a `FINAL` leva a obra para `COMPLETED` automaticamente (se a obra não exige vistorias, o síndico conclui manualmente)
- **Pronto quando:** uma obra com impermeabilização só consegue concluir após a intermediária.

### Fase 6 — IA (opcional, 2 botões)
- [ ] `lib/ai.ts` com `suggestServices(description)` e `reviewDocument(file, docType, caseSummary)`
- [ ] Schemas Zod da saída; descartar serviços desconhecidos; timeout; fallback silencioso
- [ ] Botões escondidos se não houver `ANTHROPIC_API_KEY`
- **Pronto quando:** sem chave o app funciona igual; com chave os dois botões funcionam e nenhum deles altera status.

### Fase 7 — Documentos imprimíveis
- [ ] `/obras/[id]/imprimir?doc=liberacao` — termo de liberação (dados da obra, serviços, condições, parecer, assinatura do síndico, aviso de ART/RRT)
- [ ] `/obras/[id]/imprimir?doc=parecer` — parecer técnico do parceiro
- [ ] CSS de impressão (`@media print`); o usuário usa "Salvar como PDF"
- **Pronto quando:** os dois documentos imprimem em A4 sem quebrar layout.

### Fase 8 — Admin
- [ ] CRUD de condomínios (inclui parceiro fixo e `signupCode` + QR code do link de cadastro)
- [ ] CRUD de unidades (inclusive importação por colar lista "bloco;número")
- [ ] Criar síndico e parceiro (admin define senha provisória)
- [ ] Ativar/desativar usuário
- **Pronto quando:** dá para colocar um condomínio novo no ar sem mexer no banco.

### Fase 9 — Acabamento e produção
- [ ] E-mail nas mudanças de status importantes (Resend ou SMTP, opcional por env)
- [ ] LGPD: "Baixar meus dados" (JSON) e "Excluir minha conta" (anonimiza)
- [ ] 1 teste E2E do caminho feliz (Playwright), se valer o esforço
- [ ] `Dockerfile` único + instruções de deploy
- **Pronto quando:** o app sobe em produção com Postgres e bucket reais.

---

## 12. Fora do escopo (backlog, só se aparecer necessidade real)

- Multi-organização / white-label (administradoras com vários condomínios e marca própria)
- Proposta comercial e pagamento do parceiro dentro da plataforma
- Políticas de risco diferentes por condomínio (hoje: editar `services.ts`)
- Chat com IA, RAG de normas, OCR, fila de processamento
- Push/PWA, WhatsApp, assinatura digital, webhooks
- Dashboards de métricas, exportação CSV, kanban

---

## 13. Decisões em aberto (confirmar antes da Fase 2)

1. **Multi-organização:** o plano assume **uma só empresa** operando vários condomínios. Se você vai vender para várias administradoras desde o dia 1, adicionar `Organization` com `organizationId` em `Condominium` e `User` (e filtrar por ele) — custa pouco se entrar agora, muito se entrar depois.
2. **Comercial:** o parceiro vende o serviço de ART/acompanhamento pela plataforma? Se sim, adicionar uma fase entre 5 e 6: parceiro envia valor + descrição, morador aceita, pagamento fora da plataforma.
3. **Dados do sistema atual:** existe produção com dados reais que precisam migrar? Se sim, adicionar uma fase final com script de migração (casos, documentos, usuários).
4. **Quem é o parceiro:** um parceiro fixo por condomínio (como no plano) é suficiente, ou o morador pode trazer o próprio responsável técnico? (O plano já aceita a ART de qualquer profissional como documento; o parceiro fixo só dá parecer e faz vistorias.)
