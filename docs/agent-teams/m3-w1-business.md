# M3-W1 — Módulos de Negócio (Relatórios, Comercial, Parceiros)

**Tipo:** Agent Team (3 agentes em paralelo)  
**Pré-requisito:** M3-W0 mergeada em `main`  
**Duração estimada:** 90–120 min  

---

## PROMPT PARA O CLAUDE CODE

```
Crie uma equipe de 3 agentes para implementar os módulos de negócio do Milestone 3
do projeto ReformAI: geração de relatórios, ofertas comerciais e rede de parceiros.

Leia o CLAUDE.md antes de coordenar os agentes.

Infraestrutura disponível (não reimplementar):
- packages/templates/  ← templates de documentos e engine de renderização
- apps/web/src/modules/case-intake/  ← CaseStateMachine, repositório
- apps/web/src/modules/rule-engine/  ← DeterministicEvaluator
- apps/web/src/modules/document-management/  ← DocumentChecklist
- apps/web/src/infrastructure/storage/  ← StorageAdapter
- apps/web/src/infrastructure/queue/  ← QueueManager
- apps/web/src/modules/document-intelligence/domain/LLMProvider.ts

Spawn 3 teammates:

──────────────────────────────────────────────────────
Teammate 1 — document-generation
──────────────────────────────────────────────────────
Você implementa o módulo de geração de relatórios do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/document-generation/domain/ReportAgent.ts (interface)
- apps/web/src/modules/document-generation/application/ClaudeReportAgent.ts
- apps/web/src/modules/document-generation/application/GenerateReportUseCase.ts
- apps/web/src/modules/document-generation/infrastructure/PrismaReportRepository.ts
- apps/web/app/api/v1/cases/[caseId]/reports/generate/route.ts
- apps/web/app/api/v1/cases/[caseId]/reports/route.ts
- apps/web/app/api/v1/cases/[caseId]/reports/[reportId]/url/route.ts
- apps/web/src/modules/document-generation/application/__tests__/GenerateReportUseCase.test.ts

COMPORTAMENTO ESPERADO:

ReportAgent (interface de domínio):
  interface ReportAgent {
    generateReport(
      templateId: TemplateId,
      caseData: ReformCaseData,
      options?: { enrichWithAI?: boolean }
    ): Promise<{ content: string; templateUsed: TemplateId }>
  }
  ReformCaseData inclui: caso completo, documentos extraídos, resultado de avaliação.

ClaudeReportAgent (implementa ReportAgent):
  - Se enrichWithAI=true: usa LLMProvider para enriquecer o texto do relatório
    (preencher seções de narrativa, recomendações, análise de pendências)
  - Sempre renderiza via renderTemplate() de packages/templates
  - Sempre retorna markdown com disclaimer (o engine já injeta automaticamente)
  - Valida output com Zod (schema: string não-vazia, contém o disclaimer)

GenerateReportUseCase:
  Input: { caseId, tenantId, reportType: ReportType, generatedBy: string }
  - Busca o caso completo (com documentos e evaluation result)
  - Mapeia ReportType → TemplateId
  - Monta ReformCaseData com todos os dados do caso
  - Chama ReportAgent.generateReport()
  - Faz upload do markdown para o storage como arquivo .md
    (chave: tenants/{tid}/cases/{caseId}/reports/{reportId}/relatorio.md)
  - Persiste Report no banco
  - Retorna Report criado
  - Toda query com tenantId

Mapeamento ReportType → TemplateId:
  ANALYSIS            → 'relatorio-analise'
  TECHNICAL_OPINION   → 'parecer-pendencias'
  COMMERCIAL_PROPOSAL → 'proposta-comercial'
  SERVICE_ORDER       → 'ordem-servico'
  INSPECTION_SUMMARY  → 'relatorio-analise'   (usa mesmo template)
  RELEASE_OPINION     → 'parecer-pendencias'  (usa mesmo template)

API routes (siga o padrão das rotas existentes):
  POST /reports/generate → chama GenerateReportUseCase, retorna Report
  GET  /reports          → lista Reports do caso (sem content — só metadados)
  GET  /reports/:id/url  → gera signed URL do arquivo no storage (1h)

TESTES:
  Mock LLMProvider e StorageAdapter.
  Teste: geração com enrichWithAI=false (só template), geração com IA,
  e erro quando caso não existe.

NÃO TOQUE em:
- Nenhum arquivo fora de document-generation/ e app/api/v1/cases/[caseId]/reports/
- packages/templates/ — apenas importe

Runtime: bun.

──────────────────────────────────────────────────────
Teammate 2 — commercial-offers
──────────────────────────────────────────────────────
Você implementa o módulo de ofertas comerciais do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/commercial-offers/domain/PriceCalculator.ts
- apps/web/src/modules/commercial-offers/application/CommercialAgent.ts
- apps/web/src/modules/commercial-offers/application/QuoteCaseUseCase.ts
- apps/web/src/modules/commercial-offers/application/AcceptOfferUseCase.ts
- apps/web/src/modules/commercial-offers/infrastructure/PrismaCommercialRepository.ts
- apps/web/app/api/v1/cases/[caseId]/commercial/quote/route.ts
- apps/web/app/api/v1/cases/[caseId]/commercial/accept/route.ts
- apps/web/src/modules/commercial-offers/application/__tests__/QuoteCaseUseCase.test.ts

COMPORTAMENTO ESPERADO:

PriceCalculator (domínio puro, sem IA, sem banco):
  Recebe: CommercialPlan + riskLevel + mandatoryInspection (boolean) + extraInspections (number)
  Retorna: { basePrice, inspectionsIncluded, extraInspectionCost, totalPrice, breakdown }
  Regra: o plano inclui mínimo 3 vistorias (conforme CLAUDE.md regra 6).
  Vistorias extras são cobradas à parte com extraInspectionPrice do plano.

CommercialAgent (application service, usa LLMProvider):
  Recebe dados do caso + PriceCalculator result
  Gera texto de proposta comercial em linguagem natural (para o template commercial_proposal)
  Retorna: { narrativa: string, beneficiosDestacados: string[], prazo: string }
  Valida output com Zod.

QuoteCaseUseCase:
  Input: { caseId, tenantId, planId, extraInspections?: number }
  - Busca o caso (verifica tenantId, verifica que status é SCOPE_CLASSIFIED)
  - Busca CommercialPlan pelo planId
  - Calcula preço via PriceCalculator
  - Chama CommercialAgent para gerar narrativa
  - Atualiza caso: commercialPlanId = planId
  - Cria AuditLog: action 'commercial.quote.generated', com breakdown de preço
  - Transiciona o caso para COMMERCIAL_OFFER_SENT via CaseStateMachine
  - Retorna { quote, narrativa }

AcceptOfferUseCase:
  Input: { caseId, tenantId, acceptedBy: string }
  - Verifica status é COMMERCIAL_OFFER_SENT
  - Transiciona para AWAITING_PAYMENT
  - Cria CaseTransitionLog + AuditLog
  - Retorna caso atualizado
  (Pagamento real está fora do escopo do MVP — apenas registra a aceitação)

API routes:
  POST /commercial/quote  → QuoteCaseUseCase, retorna quote
  POST /commercial/accept → AcceptOfferUseCase, retorna caso

TESTES:
  PriceCalculator: teste com 0, 1, 3 vistorias extras e plano base.
  QuoteCaseUseCase: mock repositório e CommercialAgent.

NÃO TOQUE em:
- Nenhum arquivo fora de commercial-offers/ e app/api/v1/cases/[caseId]/commercial/

Runtime: bun.

──────────────────────────────────────────────────────
Teammate 3 — partner-network
──────────────────────────────────────────────────────
Você implementa o módulo de rede de parceiros do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/partner-network/domain/PartnerMatcher.ts
- apps/web/src/modules/partner-network/domain/repositories/PartnerRepository.ts (interface)
- apps/web/src/modules/partner-network/application/AssignPartnerUseCase.ts
- apps/web/src/modules/partner-network/application/PartnerAcceptCaseUseCase.ts
- apps/web/src/modules/partner-network/application/PartnerDeclineCaseUseCase.ts
- apps/web/src/modules/partner-network/infrastructure/PrismaPartnerRepository.ts
- apps/web/app/api/v1/partners/route.ts
- apps/web/app/api/v1/partners/[partnerId]/cases/[caseId]/accept/route.ts
- apps/web/app/api/v1/partners/[partnerId]/cases/[caseId]/decline/route.ts
- apps/web/src/modules/partner-network/application/__tests__/PartnerMatcher.test.ts

COMPORTAMENTO ESPERADO:

PartnerMatcher (domínio puro, sem banco, sem IA):
  Recebe: lista de Partner[] + critérios { city, state, servicesNeeded: string[], riskLevel }
  Retorna: Partner[] ordenados por compatibilidade (rating desc, slaHours asc)
  Critérios de filtro:
  - Parceiro ativo
  - Estado da obra está em partner.states
  - Cidade da obra está em partner.cities (ou partner.cities inclui '*')
  - Para risco HIGH/CRITICAL: prefere ENGINEER sobre ARCHITECT
  - Para obras com gás/estrutural: filtra quem tem essa specialty

PartnerRepository (interface de domínio):
  findAvailable(tenantId: string, city: string, state: string): Promise<Partner[]>
  findById(id: string, tenantId: string): Promise<Partner | null>
  updateRating(id: string, rating: number): Promise<void>
  findCases(partnerId: string, tenantId: string): Promise<ReformCase[]>

AssignPartnerUseCase:
  Input: { caseId, tenantId, assignedBy: string }
  - Busca o caso (status deve ser AWAITING_PAYMENT ou RELEASED_WITH_CONDITIONS
    ou ELIGIBLE_FOR_RELEASE)
  - Busca parceiros disponíveis para a cidade/estado do condomínio
  - Usa PartnerMatcher para ordenar
  - Seleciona o primeiro parceiro disponível
  - Atualiza caso: partnerId = partner.id
  - Transiciona para ASSIGNED_TO_PARTNER
  - Cria CaseTransitionLog + AuditLog: action 'partner.assigned'
  - Retorna { case, partner }

PartnerAcceptCaseUseCase:
  Input: { caseId, partnerId, tenantId }
  - Verifica que o parceiro é o partner do caso
  - Verifica status ASSIGNED_TO_PARTNER
  - Transiciona para ART_RRT_PENDING
  - AuditLog: action 'partner.case.accepted'

PartnerDeclineCaseUseCase:
  Input: { caseId, partnerId, tenantId, reason: string }
  - Verifica que o parceiro é o partner do caso
  - Limpa partnerId do caso
  - Transiciona para COMMERCIAL_OFFER_SENT (reabre para nova oferta)
  - AuditLog: action 'partner.case.declined', details: { reason }

GET /api/v1/partners:
  - Requer role ADMIN ou CONDOMINIUM
  - Lista parceiros do tenant com filtros opcionais: city, state, specialty
  - Retorna array de partners (sem dados sensíveis)

POST /partners/:partnerId/cases/:caseId/accept → PartnerAcceptCaseUseCase
POST /partners/:partnerId/cases/:caseId/decline → PartnerDeclineCaseUseCase

TESTES:
  PartnerMatcher: teste ordenação por rating, filtro por specialty, preferência
  de ENGINEER para HIGH risk.

NÃO TOQUE em:
- Nenhum arquivo fora de partner-network/ e app/api/v1/partners/

Runtime: bun.
```

---

## Arquivos gerados por esta wave

```
apps/web/src/modules/document-generation/ (completo)
apps/web/src/modules/commercial-offers/ (completo)
apps/web/src/modules/partner-network/ (completo)
apps/web/app/api/v1/cases/[caseId]/reports/ (3 rotas)
apps/web/app/api/v1/cases/[caseId]/commercial/ (2 rotas)
apps/web/app/api/v1/partners/ (3 rotas)
```

## Checklist antes de mergear

- [ ] `bun run test` passa
- [ ] `bun run build` sem erros
- [ ] Disclaimer presente em todos os relatórios gerados
- [ ] PriceCalculator respeita mínimo de 3 vistorias
- [ ] PartnerMatcher prefere ENGINEER para HIGH/CRITICAL
- [ ] Toda query com filtro tenantId
