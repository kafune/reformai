# PLAN.md — ReformAI (versão simples)

> Plano para refazer a plataforma do zero, num diretório novo, com o mínimo de
> arquitetura possível. O repositório antigo (`kafune/reformai`) serve só como
> **referência de regras de negócio e telas** — não como referência de código.

---

## 1. O que o produto faz (em uma frase)

A administradora controla as reformas das unidades dos condomínios que administra:
o morador cadastra a obra, o sistema diz **se ela exige ART/RRT, de que tipo de
profissional e quais documentos**, o morador anexa os documentos, e o síndico ou a
administradora confere e libera a obra.

**A plataforma não emite ART/RRT.** Quem emite é o profissional habilitado
contratado pelo morador. Todo documento gerado pela plataforma traz esse aviso.

---

## 2. Decisões tomadas

| # | Decisão | Consequência no plano |
|---|---|---|
| 1 | **Uma administradora só** no começo | Sem `Tenant`/`Organization`. O perfil `ADMIN` é a equipe da administradora e vê todos os condomínios |
| 2 | **Sem parceiro técnico** no começo | Sem perfil `PARTNER`, sem parecer técnico de parceiro, sem vistorias. O morador traz o próprio profissional; a plataforma só registra e confere a ART/RRT dele |
| 3 | **Sem comercial/pagamento** | Sem proposta, plano comercial ou cobrança |
| 4 | **Nenhum dado em produção** | Sem migração de dados. Começa com banco vazio + seed |
| 5 | Foco do MVP | **Saber quais obras precisam de ART/RRT, orientar como conseguir e controlar se ela foi entregue e conferida** |

---

## 3. O que muda em relação ao projeto atual

| Hoje | Na versão simples |
|---|---|
| Monorepo Turborepo (`apps/`, `packages/`) | **Um único app Next.js** |
| DDD: 12 bounded contexts, domain/application/infrastructure, repositórios, use cases | Pastas planas: `app/`, `lib/`, `components/`. Sem repositórios, sem use cases, sem interfaces com implementação única |
| API REST `/api/v1/**` para tudo | **Server Actions** para mutações, Server Components para leitura. Route handler só onde precisa (download de arquivo) |
| Multi-tenant (Tenant, white-label, superadmin, impersonation) | **Uma administradora.** Isolamento por condomínio |
| 18 status + `CaseStateMachine` + `CaseTransitionLog` + `AuditLog` | **7 status**, um mapa de transições num arquivo e **uma tabela `CaseEvent`** que é histórico + auditoria |
| Rule Engine com políticas/regras editáveis no banco | **Uma tabela de serviços em código** (`lib/rules/services.ts`) + funções puras de risco e checklist |
| Triagem por **chat com IA** decidindo o escopo | **Formulário** com checkboxes de serviços. IA só *sugere* os checkboxes a partir de um texto livre |
| Pipeline documental: BullMQ + Redis + worker + OCR + análise por IA que muda status | **Humano aprova/reprova cada documento.** IA opcional dá "observações" num botão, sem mudar nada |
| 5 agentes de IA, `LLMProvider` abstrato | **Um arquivo `lib/ai.ts`** com 2 funções. Sem chave de API, o app funciona igual |
| Rede de parceiros, matcher, vistorias, proposta comercial, pagamento | **Fora.** O profissional é do morador; a plataforma guarda nome, registro e número da ART/RRT |
| Relatórios via templates + IA + Agent Skills + PDFKit | **Página HTML imprimível** (termo de liberação) → "Salvar como PDF" do navegador |
| RAG de normas, PWA, Web Push, rate-limit Redis, Sentry | Fora |
| Design system próprio "Concreto Verde" | **Tailwind + shadcn/ui** padrão, com uma cor primária |

---

## 4. Princípios (curtos, para colar no CLAUDE.md)

1. **Código chato ganha.** Função simples > classe > padrão de projeto.
2. **Sem abstração antes do segundo uso.** Uma implementação = nenhuma interface.
3. **Regras de negócio em funções puras** dentro de `lib/rules/`, com teste unitário. É o único lugar com teste obrigatório.
4. **IA nunca decide.** Ela preenche sugestões que um humano confirma. Nenhuma função de IA muda status, aprova documento ou calcula risco.
5. **Permissão sempre no servidor.** Toda leitura/ação de obra passa por um helper que confere se o usuário pode ver/fazer aquilo.
6. **Tudo que muda uma obra gera um `CaseEvent`.** Sem exceção.
7. **Arquivos nunca são públicos.** Download sempre por URL assinada de curta duração.

---

## 5. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Runtime / pacotes | Bun | já é o padrão do time |
| App | Next.js (versão estável atual, App Router) + TypeScript strict | um app só, front + back |
| UI | Tailwind + shadcn/ui | componentes prontos |
| Banco | PostgreSQL + Prisma | sem extensões |
| Auth | Auth.js (NextAuth) com login por e-mail e senha | senha com `scrypt` do `node:crypto` |
| Arquivos | S3-compatível via `@aws-sdk/client-s3` (MinIO local, S3/R2 em produção) | um só código para dev e prod |
| Validação | Zod nos formulários/server actions e na saída da IA | |
| IA | `@anthropic-ai/sdk`, modelo em `ANTHROPIC_MODEL` | usada em 2 pontos opcionais |
| Testes | Vitest só para `lib/rules/` (+ 1 smoke E2E no fim, opcional) | |
| Dev local | `docker-compose` com Postgres + MinIO | sem Redis |

---

## 6. Perfis e jornada

| Perfil | O que faz |
|---|---|
| `RESIDENT` (morador) | Se cadastra pelo link/QR do condomínio, cria a obra, vê se precisa de ART/RRT e como conseguir, anexa documentos, informa o profissional e a ART/RRT, corrige pendências, informa início e conclusão |
| `SYNDIC` (síndico) | Vê as obras do seu condomínio, confere documentos, pede correção, libera ou recusa |
| `ADMIN` (equipe da administradora) | Cadastra condomínios, unidades e síndicos; vê e age em todas as obras; acompanha o **painel de ART/RRT** de todos os condomínios |

Jornada feliz:

```
Morador cria obra (formulário)
  → sistema calcula risco, diz se exige ART/RRT, que profissional procurar e quais documentos
  → morador contrata o profissional (fora da plataforma), anexa ART/RRT e demais documentos,
    informa nome, registro (CREA/CAU) e número da ART/RRT
  → envia para análise
  → síndico/administradora confere documentos → libera (com ou sem condições)
  → morador informa início → morador informa conclusão → síndico/administradora confirma
```

---

## 7. Status da obra

| Status | Rótulo na tela | Quem leva para cá |
|---|---|---|
| `DRAFT` | Rascunho | criação |
| `UNDER_REVIEW` | Em análise | morador (enviar) |
| `CHANGES_REQUESTED` | Correção solicitada | síndico/admin |
| `APPROVED` | Liberada | síndico/admin |
| `REJECTED` | Recusada | síndico/admin |
| `IN_PROGRESS` | Em execução | morador (informar início) |
| `COMPLETED` | Concluída | síndico/admin (confirmar conclusão informada pelo morador) |
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

Guardas (funções puras, com teste):

- **Enviar para análise** (`DRAFT|CHANGES_REQUESTED → UNDER_REVIEW`): todos os documentos obrigatórios do checklist foram anexados **e**, se a obra exige ART/RRT, nome do profissional, registro e número da ART/RRT estão preenchidos.
- **Liberar** (`→ APPROVED`): todos os documentos obrigatórios estão `APPROVED` **e**, se a obra exige ART/RRT, quem libera marca a confirmação *"Conferi que a ART/RRT cobre todos os serviços declarados"* (fica registrada no `CaseEvent`). Para risco `HIGH`/`CRITICAL`, essa é a revisão humana obrigatória.
- **Concluir** (`IN_PROGRESS → COMPLETED`): morador informou a conclusão.
- Transição inválida lança erro — nunca é ignorada em silêncio.

---

## 8. Regras de negócio (o coração — `lib/rules/`)

### 8.1 Tabela de serviços (`services.ts`)

Cada serviço tem pontos de risco, se exige ART/RRT e **uma orientação** (qual
profissional procurar e o que a ART/RRT precisa cobrir), mostrada ao morador.

| Serviço | Pontos | Exige ART/RRT | Profissional (orientação) |
|---|---|---|---|
| Pintura simples | 5 | não | — |
| Troca de piso sem demolição | 10 | não | — |
| Troca de piso com demolição | 25 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Elétrica | 30 | sim | Engenheiro eletricista/civil (CREA) ou arquiteto (CAU) |
| Hidráulica | 30 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Gás | 40 | sim | Engenheiro (CREA) com atribuição para instalações de gás |
| Impermeabilização | 35 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Ar-condicionado (split) | 15 | não | — |
| Mudança de layout | 20 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Demolição de alvenaria | 40 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Impacto estrutural/prumadas | 60 | sim | Engenheiro civil (CREA) |
| Fachada | 45 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Esquadrias externas | 20 | sim | Engenheiro civil (CREA) ou arquiteto (CAU) |
| Equipamentos fixos pesados | 25 | sim | Engenheiro civil (CREA) |

> ⚠️ Os pontos e os textos de orientação são **valores iniciais** — a administradora
> deve validar com um profissional antes de ir para produção. Mudar é só editar o arquivo.

Flags extras do formulário somam pontos: afeta área comum (+10), afeta fachada (+20), afeta estrutura (+30) — e afetar estrutura ou fachada força ART/RRT.

### 8.2 Risco (`risk.ts`)

`calculateRisk(services, flags) → { score, level, requiresArt, guidance[] }`

- `score` = soma dos pontos, teto 100.
- `level`: ≤20 `LOW`, ≤45 `MEDIUM`, ≤70 `HIGH`, senão `CRITICAL`.
- `requiresArt` = algum serviço exige, ou flag de estrutura/fachada marcada.
- `guidance` = orientações dos serviços selecionados, sem repetição.

O risco é calculado **no servidor** ao salvar a obra e gravado na obra (não confie no cliente). Se o morador editar os serviços, recalcula.

### 8.3 Checklist de documentos (`checklist.ts`)

`requiredDocuments(risk) → DocumentType[]`

| Nível | Documentos obrigatórios |
|---|---|
| LOW | nenhum (termo de responsabilidade opcional) |
| MEDIUM | Termo de responsabilidade |
| HIGH | + ART/RRT, Memorial descritivo |
| CRITICAL | + Projeto, Cronograma, Relação da equipe |

Sempre que `requiresArt` for verdadeiro, ART/RRT entra, mesmo em nível baixo.

### 8.4 Outras regras

- A plataforma não emite ART/RRT; a tela da obra e o termo imprimível trazem o aviso de responsabilidade técnica.
- Morador só vê as próprias obras; síndico só as do seu condomínio; admin vê tudo.
- LGPD: consentimento registrado no cadastro; exclusão de conta = anonimização (nome/e-mail/telefone trocados), obras e histórico preservados.

---

## 9. Modelo de dados (esboço Prisma)

Nomes de código em inglês, textos de tela em português.

```prisma
model User {
  id            String    @id @default(cuid())
  name          String
  email         String    @unique
  phone         String?
  passwordHash  String
  role          Role
  condominiumId String?   // RESIDENT e SYNDIC
  lgpdConsentAt DateTime?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
}
enum Role { ADMIN SYNDIC RESIDENT }

model Condominium {
  id         String  @id @default(cuid())
  name       String
  address    String
  city       String
  state      String
  signupCode String  @unique  // usado no link/QR de cadastro
  active     Boolean @default(true)
  units      Unit[]
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
  contractorName    String?    // quem executa a obra
  // calculado no servidor por lib/rules/risk.ts
  riskScore         Int
  riskLevel         RiskLevel
  requiresArt       Boolean
  // responsável técnico (contratado pelo morador)
  professionalName  String?
  professionalType  String?    // "ENGINEER" | "ARCHITECT"
  professionalReg   String?    // número CREA/CAU
  artNumber         String?    // número da ART/RRT
  // decisão
  approvalConditions String?
  startedAt          DateTime?
  completedAt        DateTime?
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

// Histórico + auditoria. Uma tabela só.
model CaseEvent {
  id         String   @id @default(cuid())
  caseId     String
  userId     String?  // null = sistema
  type       String   // "status_changed" | "document_uploaded" | "document_reviewed"
                      // | "professional_updated" | "art_confirmed" | "comment" | "ai_suggestion"
  fromStatus CaseStatus?
  toStatus   CaseStatus?
  message    String?
  data       Json?
  createdAt  DateTime @default(now())
}
```

Sem `Tenant`, `Partner`, `Inspection`, `Policy`, `Rule`, `Report`, `ReportSkill`,
`ChatMessage`, `CommercialPlan`, `Notification`, `PushSubscription`, `NormChunk`.

---

## 10. Onde a IA entra (e onde não entra)

Tudo em `lib/ai.ts`. Se `ANTHROPIC_API_KEY` não estiver definida, as funções
não são chamadas e os botões não aparecem.

| # | Onde | O que faz | O que **não** faz |
|---|---|---|---|
| 1 | Formulário de nova obra — botão "Sugerir serviços a partir da descrição" | Lê o texto livre do morador e devolve quais serviços da tabela se aplicam + flags. Saída validada com Zod; serviços fora da lista são descartados. Marca os checkboxes; **o morador confirma** | Não calcula risco, não decide se exige ART, não salva nada |
| 2 | Conferência de documento — botão "Observações da IA" | Manda o PDF/imagem direto para o Claude (leitura nativa de PDF e imagem — **sem OCR**) com o tipo esperado e os dados da obra; devolve observações curtas (ex.: "ART não menciona o endereço da unidade", "número da ART diferente do informado", "serviço de gás não aparece na ART"). Grava em `Document.aiNotes` e um `CaseEvent` `ai_suggestion` | Não aprova nem reprova. Quem decide é o síndico/admin |

Regras:
- Chamada síncrona dentro da server action, com timeout. Sem fila.
- Saída sempre validada com Zod; se falhar, mostra "IA indisponível" e segue.
- O prompt nunca contém regra de negócio (pontos, níveis, checklist) — isso está em `lib/rules/`.

---

## 11. Estrutura de pastas

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
│   │   ├── obras/[id]/                   # detalhe: resumo, ART/RRT, documentos, histórico
│   │   ├── obras/[id]/imprimir/          # termo de liberação imprimível
│   │   ├── art/                          # painel de ART/RRT (síndico: seu condomínio; admin: todos)
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
│   │   └── status.ts      status.test.ts
│   └── actions/                          # server actions ("use server"), finas
│       ├── cases.ts  documents.ts  review.ts  admin.ts
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
  assertCanApprove(c, docs, data.artConfirmed)              // 5. regra pura (lib/rules)
  await db.$transaction(async (tx) => {                     // 6. grava + evento
    await tx.case.update({ where: { id: caseId }, data: { status: "APPROVED", approvalConditions: data.conditions } })
    await logEvent(tx, { caseId, userId: user.id, type: "status_changed", fromStatus: c.status, toStatus: "APPROVED",
                         data: { artConfirmed: data.artConfirmed } })
  })
  revalidatePath(`/obras/${caseId}`)
}
```

---

## 12. Fases

Cada fase termina com: testes passando, `bun run lint` e `bun run typecheck` limpos,
um commit, e um resumo curto do que foi feito. **Não avançar de fase sem confirmação.**

### Fase 0 — Esqueleto
- [ ] `bun create next-app` (TypeScript, Tailwind, App Router, sem `src/`)
- [ ] shadcn/ui inicializado com poucos componentes (button, input, card, table, badge, dialog, form)
- [ ] Prisma + `docker-compose.yml` (Postgres + MinIO) + `.env.example`
- [ ] Vitest configurado; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `db:seed`
- [ ] `CLAUDE.md` curto (≤ 80 linhas) com as decisões da §2, os princípios da §4, comandos e pastas
- **Pronto quando:** `bun dev` abre uma página, `bun test` roda (0 testes ok).

### Fase 1 — Regras puras
- [ ] `lib/rules/services.ts`, `risk.ts`, `checklist.ts`, `status.ts`
- [ ] Testes cobrindo: cada nível de risco nos limites (20/21, 45/46, 70/71), teto 100, flags; `requiresArt` por serviço e por flag; orientações sem repetição; checklist por nível + ART forçada; todas as transições válidas e algumas inválidas; guardas de enviar (docs + dados do profissional) e liberar (docs aprovados + confirmação da ART)
- **Pronto quando:** `bun test` verde, zero import de Prisma/Next em `lib/rules/`.

### Fase 2 — Banco, login e esqueleto de telas
- [ ] `schema.prisma` da §9 + primeira migration
- [ ] `seed.ts`: 2 condomínios, algumas unidades, usuários `admin@demo.com`, `sindico@demo.com`, `morador@demo.com` (senha `senha123`) e algumas obras em status variados (com e sem ART)
- [ ] Auth.js com credenciais, hash `scrypt`; `getCurrentUser()`
- [ ] Layout logado com menu por perfil; redireciona para `/obras` após login
- [ ] `lib/permissions.ts` com testes simples (funções puras que recebem user + case)
- **Pronto quando:** cada usuário demo loga e vê o menu certo.

### Fase 3 — Morador cria e envia a obra
- [ ] `/cadastro/[signupCode]`: nome, e-mail, telefone, senha, bloco/unidade, aceite LGPD → cria usuário e vincula/cria a unidade (recusa se a unidade já tem outro morador)
- [ ] `/obras/nova`: checkboxes de serviços, flags, descrição, datas, executor → salva como `DRAFT` com risco calculado
- [ ] `/obras/[id]`: bloco de destaque **"Esta obra exige ART/RRT"** (ou "não exige") com as orientações de profissional, o checklist de documentos e o aviso de que a plataforma não emite ART/RRT
- [ ] Formulário do responsável técnico (nome, engenheiro/arquiteto, CREA/CAU, número da ART/RRT)
- [ ] Upload de documento (PDF/JPG/PNG, até 20 MB) → storage → `Document` `PENDING` → `CaseEvent`
- [ ] Botão "Enviar para análise" (só habilita com a guarda satisfeita; mostra o que falta)
- [ ] Histórico (timeline de `CaseEvent`) na página da obra
- **Pronto quando:** morador demo cria uma obra com elétrica + demolição, vê que exige ART, preenche o profissional, anexa os docs e envia.

### Fase 4 — Síndico/administradora conferem e liberam
- [ ] `/obras` do síndico: lista do condomínio com filtros por status e "exige ART"
- [ ] Ver documento (URL assinada de 1h via `/api/files/[id]`)
- [ ] Aprovar/reprovar documento com nota
- [ ] Pedir correção (texto) → `CHANGES_REQUESTED`; morador corrige e reenvia → `UNDER_REVIEW`
- [ ] Liberar (com condições opcionais + checkbox de conferência da ART quando exigida) ou recusar (motivo obrigatório); o botão de liberar mostra o motivo quando bloqueado
- [ ] Morador informa início e conclusão; síndico/admin confirma a conclusão
- **Pronto quando:** o ciclo enviar → corrigir → reenviar → liberar → iniciar → concluir funciona com os usuários demo.

### Fase 5 — Painel de ART/RRT
- [ ] `/art`: tabela das obras que exigem ART/RRT com colunas condomínio, unidade, serviços, profissional, registro, nº ART/RRT, situação da ART (`faltando` / `enviada` / `aprovada` / `reprovada`) e status da obra
- [ ] Filtros: condomínio, situação da ART, status da obra; destaque para **obras em execução sem ART aprovada** (não deveria acontecer — é o alarme)
- [ ] Contadores no topo (exigem ART / faltando / aguardando conferência / ok)
- [ ] Síndico vê só o seu condomínio; admin vê todos
- **Pronto quando:** a administradora consegue responder "quais obras precisam de ART e em que pé estão" numa tela só.

### Fase 6 — IA (opcional, 2 botões)
- [ ] `lib/ai.ts` com `suggestServices(description)` e `reviewDocument(file, docType, caseSummary)`
- [ ] Schemas Zod da saída; descartar serviços desconhecidos; timeout; fallback silencioso
- [ ] Botões escondidos se não houver `ANTHROPIC_API_KEY`
- **Pronto quando:** sem chave o app funciona igual; com chave os dois botões funcionam e nenhum deles altera status.

### Fase 7 — Termo de liberação imprimível
- [ ] `/obras/[id]/imprimir` — termo de liberação (condomínio, unidade, serviços, responsável técnico e nº ART/RRT, condições, quem liberou e quando, aviso de responsabilidade técnica)
- [ ] CSS de impressão (`@media print`); o usuário usa "Salvar como PDF"
- **Pronto quando:** o termo imprime em A4 sem quebrar layout.

### Fase 8 — Admin
- [ ] CRUD de condomínios (inclui `signupCode` + QR code do link de cadastro)
- [ ] CRUD de unidades (inclusive importação por colar lista "bloco;número")
- [ ] Criar síndico (admin define senha provisória); ativar/desativar usuário
- **Pronto quando:** dá para colocar um condomínio novo no ar sem mexer no banco.

### Fase 9 — Acabamento e produção
- [ ] E-mail nas mudanças de status importantes (Resend ou SMTP, opcional por env)
- [ ] LGPD: "Baixar meus dados" (JSON) e "Excluir minha conta" (anonimiza)
- [ ] 1 teste E2E do caminho feliz (Playwright), se valer o esforço
- [ ] `Dockerfile` único + instruções de deploy
- **Pronto quando:** o app sobe em produção com Postgres e bucket reais.

---

## 13. Fora do escopo (backlog, só se aparecer necessidade real)

- **Parceiro técnico da plataforma** (profissional indicado pela administradora, parecer técnico, vistorias INITIAL/INTERMEDIATE/FINAL, regra "impermeabilização exige vistoria intermediária antes da final")
- **Comercial**: proposta, plano, pagamento
- Multi-administradora / white-label
- Regras de risco diferentes por condomínio (hoje: editar `services.ts`)
- Chat com IA, RAG de normas, OCR, fila de processamento
- Push/PWA, WhatsApp, assinatura digital, webhooks
- Dashboards de métricas, exportação CSV, kanban
