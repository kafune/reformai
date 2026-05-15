# M3-W3 — Painel do Parceiro e Testes E2E

**Tipo:** Agent Team (2 agentes em paralelo)  
**Pré-requisito:** M3-W2 mergeada em `main`  
**Duração estimada:** 90–120 min  

---

## PROMPT PARA O CLAUDE CODE

```
Crie uma equipe de 2 agentes para implementar o painel do parceiro e os testes
E2E do projeto ReformAI.

Leia o CLAUDE.md antes de coordenar os agentes.

Toda a plataforma está implementada: triagem, documentos, relatórios, comercial,
parceiros, vistorias e painel admin.

Spawn 2 teammates:

──────────────────────────────────────────────────────
Teammate 1 — partner-panel
──────────────────────────────────────────────────────
Você implementa o painel do parceiro técnico do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/app/(partner)/layout.tsx
- apps/web/app/(partner)/cases/page.tsx
- apps/web/app/(partner)/cases/[caseId]/page.tsx
- apps/web/app/(partner)/cases/[caseId]/inspections/page.tsx
- apps/web/app/(partner)/cases/[caseId]/inspections/[inspectionId]/complete/page.tsx
- apps/web/app/(partner)/dashboard/page.tsx
- apps/web/app/api/v1/partners/[partnerId]/cases/route.ts

As rotas POST /accept e POST /decline já existem em app/api/v1/partners/.
Leia-as antes de começar para entender o padrão.

COMPORTAMENTO ESPERADO:

API:
  GET /partners/:partnerId/cases
    - Verifica que o usuário autenticado é o parceiro (role PARTNER)
    - Verifica que partnerId corresponde ao Partner do userId da sessão
    - Lista ReformCase onde partnerId = partnerId e tenantId = tenantId
    - Inclui: status, risco, condomínio, unidade, próxima vistoria agendada
    - Query params: ?status= para filtrar

UI (Server Components onde possível):

layout.tsx:
  Sidebar com: Dashboard, Meus Casos
  Verifica role PARTNER — redireciona se não for parceiro

dashboard/page.tsx:
  Cards:
  - Casos ativos (status IN_EXECUTION ou INSPECTIONS_SCHEDULED)
  - Vistorias agendadas para hoje
  - Casos aguardando ART/RRT (ART_RRT_PENDING)
  - Casos concluídos este mês

cases/page.tsx:
  Lista de casos atribuídos ao parceiro
  Para cada caso: protocolo, condomínio, unidade, status, risco, próxima vistoria
  Tabs: "Ativos" | "Concluídos" | "Todos"
  Link para página de detalhe do caso

cases/[caseId]/page.tsx:
  Visão do parceiro sobre o caso:
  - Dados da obra (escopo, endereço, unidade)
  - Status atual com histórico de transições
  - Lista de documentos (somente visualização — links para URL assinada)
  - Relatórios gerados (somente visualização)
  - Lista de vistorias com status
  - Botões de ação contextuais:
    * Se ART_RRT_PENDING: botão "Confirmar ART/RRT registrada"
      → chama PATCH /cases/:id/status com status ART_RRT_PENDING → INSPECTIONS_SCHEDULED
      (requer endpoint PATCH /api/v1/cases/:id/status — verifique se existe, se não,
      crie apenas para essa transição específica com validação de role PARTNER)
    * Se status ASSIGNED_TO_PARTNER: botões "Aceitar Caso" | "Recusar Caso"

cases/[caseId]/inspections/page.tsx:
  Lista todas as vistorias do caso com status
  Botão "Registrar Conclusão" para vistorias SCHEDULED → abre página de conclusão
  Botão "Reagendar" → abre modal simples com novo datetime (PATCH /inspections/:id)

cases/[caseId]/inspections/[inspectionId]/complete/page.tsx:
  Formulário de conclusão de vistoria:
  - Campo de notas obrigatório (mínimo 50 caracteres)
  - Upload de até 10 fotos (JPEG/PNG)
    → fotos são enviadas para POST /cases/:id/documents com type=PHOTOS
  - Botão "Registrar Vistoria Concluída" → POST /inspections/:id/complete
  - Após sucesso: redireciona para /cases/:id/inspections

REGRAS DE UI:
  - Parceiro não vê dados de outros parceiros (tenantId + partnerId como filtros)
  - Não exibe storageKey — apenas fileName e URL assinada
  - Formulário de conclusão: bloqueia envio se notas < 50 caracteres
  - Mobile-first

NÃO TOQUE em:
- Módulos de domínio existentes
- app/(admin)/ ou app/(client)/
- Nenhuma API route fora de /partners/

Runtime: bun. Teste o fluxo:
  1. Login como parceiro@demo.com / senha123
  2. Acesse /partner/cases
  3. Aceite um caso atribuído
  4. Registre uma vistoria como concluída

──────────────────────────────────────────────────────
Teammate 2 — e2e-tests
──────────────────────────────────────────────────────
Você implementa os testes E2E do projeto ReformAI com Playwright.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- playwright.config.ts (na raiz do projeto, se não existir)
- apps/web/tests/e2e/auth.spec.ts
- apps/web/tests/e2e/case-intake.spec.ts
- apps/web/tests/e2e/triage-chat.spec.ts
- apps/web/tests/e2e/document-upload.spec.ts
- apps/web/tests/e2e/admin-review.spec.ts
- apps/web/tests/e2e/helpers/auth.ts
- apps/web/tests/e2e/helpers/fixtures.ts

INSTALAÇÃO:
  bun add -d @playwright/test
  bunx playwright install chromium

playwright.config.ts:
  - baseURL: http://localhost:3000
  - browser: chromium only (MVP)
  - timeout: 30000ms
  - retries: 1 em CI, 0 local
  - reporter: ['list', ['html', { outputFolder: 'playwright-report' }]]
  - globalSetup: script que faz bun run db:seed antes dos testes

helpers/auth.ts:
  Funções reutilizáveis:
  - loginAs(page, email, password): Promise<void>
  - loginAsAdmin(page): Promise<void>   ← admin@demo.com
  - loginAsClient(page): Promise<void>  ← morador@demo.com
  - loginAsPartner(page): Promise<void> ← parceiro@demo.com
  - logout(page): Promise<void>

helpers/fixtures.ts:
  - createTestCase(page): Promise<{ caseId, protocol }>
    → faz login como cliente, cria um caso via UI

auth.spec.ts:
  - Login com credenciais válidas → redireciona para /cases
  - Login com senha errada → exibe mensagem de erro
  - Acesso a /cases sem login → redireciona para /login
  - Logout → redireciona para /login

case-intake.spec.ts:
  - Criar novo caso:
    → login como morador@demo.com
    → selecionar unidade
    → criar caso
    → verificar que aparece na lista com status "Aguardando Detalhes do Escopo"
  - Caso aparece com protocolo no formato RF-*

triage-chat.spec.ts:
  Cobrir o caminho feliz da triagem:
  - Abre o chat do caso
  - Envia mensagem descrevendo reforma (ex: "quero trocar o piso e pintar as paredes")
  - Verifica que o assistente responde
  - Aguarda até o caso ter riskLevel definido (polling de até 30s)
  - Verifica que o painel de regras ativadas aparece na tela

document-upload.spec.ts:
  - Acessa /cases/:id/documents
  - Faz upload de um PDF de teste (crie um PDF mínimo válido como fixture)
  - Verifica que o documento aparece na lista com status "Aguardando"
  - Verifica que o status muda para "Processando..." (pode ser assíncrono — aguarde 5s)
  - Testa upload de tipo inválido (.exe) → mensagem de erro visível

admin-review.spec.ts:
  - Login como admin@demo.com
  - Acessa /admin/dashboard → verifica que os cards de métricas aparecem
  - Acessa /admin/review-queue
  - Se houver caso em HUMAN_REVIEW_REQUIRED:
    → abre página de revisão
    → seleciona "Aprovar"
    → adiciona nota "Caso revisado e aprovado."
    → submete
    → verifica que o caso desaparece da fila

REGRAS:
  - Testes devem ser independentes — cada spec funciona isolado
  - Use data-testid attributes nos componentes existentes onde necessário
    (você pode adicionar data-testid nos componentes existentes — só isso)
  - Não teste lógica de negócio nos E2E — isso é dos testes unitários
  - Foque em: "o usuário consegue completar a tarefa?"
  - Se o servidor não estiver rodando, o teste deve falhar com mensagem clara

NÃO TOQUE em:
- Código de produção além de adicionar data-testid attributes
- Nenhuma API route ou módulo de domínio

Runtime: bun. Rode `bunx playwright test` para verificar.
```

---

## Arquivos gerados por esta wave

```
apps/web/app/(partner)/
  layout.tsx
  dashboard/page.tsx
  cases/page.tsx
  cases/[caseId]/page.tsx
  cases/[caseId]/inspections/page.tsx
  cases/[caseId]/inspections/[inspectionId]/complete/page.tsx

apps/web/app/api/v1/partners/[partnerId]/cases/route.ts

playwright.config.ts
apps/web/tests/e2e/
  auth.spec.ts
  case-intake.spec.ts
  triage-chat.spec.ts
  document-upload.spec.ts
  admin-review.spec.ts
  helpers/auth.ts
  helpers/fixtures.ts
```

## Checklist antes de mergear

- [ ] Parceiro só vê seus próprios casos
- [ ] Formulário de conclusão bloqueia notas < 50 caracteres
- [ ] `bunx playwright test` passa (auth + case-intake obrigatórios)
- [ ] `bun run build` sem erros
- [ ] Dev server: fluxo do parceiro funciona end-to-end
