# M3-W2 — Agendamento de Vistorias e Painel Admin

**Tipo:** Agent Team (2 agentes em paralelo)  
**Pré-requisito:** M3-W1 mergeada em `main`  
**Duração estimada:** 90–120 min  

---

## PROMPT PARA O CLAUDE CODE

```
Crie uma equipe de 2 agentes para implementar o módulo de vistorias e o painel
administrativo do projeto ReformAI.

Leia o CLAUDE.md antes de coordenar os agentes.

O que já está disponível:
- Todos os módulos anteriores (case-intake, rule-engine, document-management,
  document-generation, commercial-offers, partner-network)
- CaseStateMachine com transições ASSIGNED_TO_PARTNER → ART_RRT_PENDING →
  INSPECTIONS_SCHEDULED → IN_EXECUTION → CONCLUDED
- Modelo Inspection no banco (schema Prisma já completo)

Spawn 2 teammates:

──────────────────────────────────────────────────────
Teammate 1 — inspection-scheduling
──────────────────────────────────────────────────────
Você implementa o módulo de agendamento e gestão de vistorias do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/inspection-scheduling/domain/InspectionRules.ts
- apps/web/src/modules/inspection-scheduling/domain/repositories/InspectionRepository.ts
- apps/web/src/modules/inspection-scheduling/application/ScheduleInspectionUseCase.ts
- apps/web/src/modules/inspection-scheduling/application/CompleteInspectionUseCase.ts
- apps/web/src/modules/inspection-scheduling/application/GetCaseInspectionsUseCase.ts
- apps/web/src/modules/inspection-scheduling/infrastructure/PrismaInspectionRepository.ts
- apps/web/app/api/v1/cases/[caseId]/inspections/route.ts
- apps/web/app/api/v1/cases/[caseId]/inspections/[inspectionId]/route.ts
- apps/web/app/api/v1/cases/[caseId]/inspections/[inspectionId]/complete/route.ts
- apps/web/src/modules/inspection-scheduling/application/__tests__/InspectionRules.test.ts

COMPORTAMENTO ESPERADO:

InspectionRules (domínio puro, sem banco, sem IA):
  Classe com métodos estáticos:
  
  static getRequiredInspectionTypes(scope: ReformScope, evaluationResult: PolicyEvaluationResult): InspectionType[]
    - Toda obra: inclui INITIAL e FINAL
    - mandatoryInspection=true (impermeabilização, gás, estrutural): inclui INTERMEDIATE
    - riskLevel CRITICAL: inclui CRITICAL_SYSTEM
    - Retorna array ordenado: INITIAL → INTERMEDIATE? → CRITICAL_SYSTEM? → FINAL
  
  static canScheduleInspection(case: ReformCase, inspectionType: InspectionType): boolean
    - INITIAL: caso em ASSIGNED_TO_PARTNER ou ART_RRT_PENDING ou INSPECTIONS_SCHEDULED
    - INTERMEDIATE: ao menos 1 INITIAL completada
    - FINAL: todas as INTERMEDIATEs completadas (ou nenhuma necessária)
    - CRITICAL_SYSTEM: caso em IN_EXECUTION
  
  REGRA INBYPASSÁVEL (conforme CLAUDE.md regra 5):
    Impermeabilização exige vistoria INTERMEDIATE antes de cobertura.
    canScheduleInspection('FINAL') retorna false se:
    - scope.services contém 'Impermeabilização'
    - E não existe Inspection com type=INTERMEDIATE e status=COMPLETED

ScheduleInspectionUseCase:
  Input: { caseId, tenantId, type: InspectionType, scheduledAt: Date, notes?: string, scheduledBy }
  - Busca o caso completo
  - Chama InspectionRules.canScheduleInspection() — lança BusinessRuleViolationError se false
  - Cria Inspection no banco com status SCHEDULED
  - Se é a primeira vistoria: transiciona caso para INSPECTIONS_SCHEDULED
  - Se caso estava em INSPECTIONS_SCHEDULED e é INITIAL: transiciona para IN_EXECUTION
  - CaseTransitionLog + AuditLog: action 'inspection.scheduled'
  - Retorna Inspection criada
  
  Cobrança extra (se a obra for CRITICAL ou type=EXTRA):
    Define extraCharge baseado no CommercialPlan.extraInspectionPrice do caso

CompleteInspectionUseCase:
  Input: { inspectionId, caseId, tenantId, notes: string, photoStorageKeys?: string[], completedBy }
  - Atualiza Inspection: status=COMPLETED, completedAt=now, notes, photoKeys
  - Verifica se todas as vistorias obrigatórias foram completadas
  - Se todas completas e type=FINAL: transiciona caso para CONCLUDED
  - AuditLog: action 'inspection.completed'

API routes:
  GET  /inspections         → GetCaseInspectionsUseCase (lista vistorias do caso)
  POST /inspections         → ScheduleInspectionUseCase
  PATCH /inspections/:id    → atualiza scheduledAt ou notes (só se SCHEDULED)
  POST /inspections/:id/complete → CompleteInspectionUseCase

TESTES:
  InspectionRules: teste a regra de impermeabilização bloqueando FINAL,
  e o fluxo completo de tipos obrigatórios por risco.

NÃO TOQUE em:
- Nenhum arquivo fora de inspection-scheduling/ e app/api/v1/cases/[caseId]/inspections/

Runtime: bun.

──────────────────────────────────────────────────────
Teammate 2 — admin-panel
──────────────────────────────────────────────────────
Você implementa o painel administrativo do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:

API routes:
- apps/web/app/api/v1/admin/dashboard/route.ts
- apps/web/app/api/v1/admin/review-queue/route.ts
- apps/web/app/api/v1/admin/review/[caseId]/route.ts
- apps/web/app/api/v1/admin/policies/route.ts
- apps/web/app/api/v1/admin/policies/[policyId]/rules/route.ts

UI Pages:
- apps/web/app/(admin)/layout.tsx
- apps/web/app/(admin)/dashboard/page.tsx
- apps/web/app/(admin)/review-queue/page.tsx
- apps/web/app/(admin)/review-queue/[caseId]/page.tsx
- apps/web/app/(admin)/policies/page.tsx

COMPORTAMENTO ESPERADO:

API — Todos os endpoints requerem role SUPER_ADMIN ou ADMIN.
Qualquer outro role → 403.

GET /admin/dashboard:
  Retorna:
  {
    totalCases: number
    byStatus: Record<CaseStatus, number>
    byRisk: Record<RiskLevel, number>
    humanReviewQueue: number       ← casos em HUMAN_REVIEW_REQUIRED
    averageTriageScore: number
    casesThisMonth: number
  }
  Sempre filtra por tenantId da sessão.

GET /admin/review-queue:
  Lista casos em status HUMAN_REVIEW_REQUIRED do tenant.
  Inclui: caso completo, mensagens de triagem, resultado de avaliação, documentos.
  Query params: ?page=1&limit=20

POST /admin/review/:caseId:
  Body: { decision: 'approve' | 'approve_with_conditions' | 'reject' | 'request_corrections', notes: string }
  
  Mapeamento de decisão → status:
  - 'approve'                → ELIGIBLE_FOR_RELEASE
  - 'approve_with_conditions'→ RELEASED_WITH_CONDITIONS
  - 'reject'                 → ARCHIVED
  - 'request_corrections'    → PENDING_CORRECTIONS
  
  Cria CaseTransitionLog: triggeredBy='reviewer:{userId}'
  AuditLog: action 'case.human.review.completed', aiReasoning: null,
    details: { decision, notes }
  
  Retorna caso atualizado.

GET /admin/policies:
  Lista políticas do tenant (inclui regras).

POST /admin/policies:
  Cria nova política para o tenant.

PATCH /admin/policies/:policyId/rules:
  Body: { rules: Rule[] }  ← substitui as regras da política
  Incrementa policy.version.
  Retorna política atualizada.

UI (Server Components onde possível, Client onde necessário):

layout.tsx:
  Sidebar com links: Dashboard, Fila de Revisão, Políticas
  Verifica role na sessão — redireciona se não for ADMIN/SUPER_ADMIN

dashboard/page.tsx:
  Cards com as métricas do endpoint /dashboard
  Destaque visual para humanReviewQueue (badge vermelho se > 0)
  Gráfico simples de casos por status (use uma table/list, não bibliotecas de gráfico)

review-queue/page.tsx:
  Lista de casos aguardando revisão humana
  Para cada caso: protocolo, risco (com badge de cor), triageScore, data de criação
  Link para página de revisão individual

review-queue/[caseId]/page.tsx:
  Painel de revisão completo:
  - Dados do caso (protocolo, unidade, condomínio)
  - Escopo da reforma
  - Resultado da avaliação (regras ativadas, score, recomendação)
  - Histórico de mensagens do chat de triagem
  - Formulário de decisão (radio: aprovar / aprovar com condições / rejeitar / solicitar correções)
  - Campo de texto para notas obrigatórias
  - Botão "Registrar Decisão" → POST /admin/review/:caseId

policies/page.tsx:
  Lista políticas ativas
  Para cada política: nome, versão, número de regras, data de vigência
  (Edição de regras é funcionalidade futura — apenas visualização no MVP)

NÃO TOQUE em:
- Nenhum arquivo fora de app/(admin)/ e app/api/v1/admin/
- Não altere módulos de domínio existentes

Runtime: bun. Inicie o dev server e teste o fluxo:
  1. Login como admin@demo.com
  2. Acesse /admin/dashboard
  3. Acesse /admin/review-queue
  4. Tome uma decisão em um caso em HUMAN_REVIEW_REQUIRED
```

---

## Arquivos gerados por esta wave

```
apps/web/src/modules/inspection-scheduling/ (completo)
apps/web/app/api/v1/cases/[caseId]/inspections/ (4 rotas)
apps/web/app/api/v1/admin/ (5 rotas)
apps/web/app/(admin)/ (layout + 3 páginas)
```

## Checklist antes de mergear

- [ ] Regra de impermeabilização bloqueia FINAL sem INTERMEDIATE
- [ ] Revisão humana transiciona corretamente para cada decisão
- [ ] Dashboard filtra por tenantId
- [ ] Acesso admin bloqueado para outros roles (403)
- [ ] `bun run test` passa
- [ ] `bun run build` sem erros
- [ ] Dev server: fluxo de revisão humana funciona end-to-end
