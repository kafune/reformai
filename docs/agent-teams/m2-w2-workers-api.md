# M2-W2 — Workers, API e Seed

**Tipo:** Agent Team (3 agentes em paralelo)  
**Pré-requisito:** M2-W1 mergeada em `main`  
**Duração estimada:** 60–90 min  

---

## PROMPT PARA O CLAUDE CODE

```
Crie uma equipe de 3 agentes para implementar os workers BullMQ, as rotas de API
de documentos e o seed do banco do projeto ReformAI.

Leia o CLAUDE.md antes de coordenar os agentes.

Toda a infraestrutura e domínio documental já estão implementados. Os agentes
devem usar (não reimplementar) o que já existe:
- apps/web/src/infrastructure/storage/ (StorageAdapter + adapters)
- apps/web/src/infrastructure/queue/types.ts
- apps/web/src/modules/document-management/ (use cases, repositório)
- apps/web/src/modules/document-intelligence/ (ClaudeDocumentAgent, ClaudeAnalysisAgent)
- apps/web/src/modules/case-intake/ (CaseStateMachine, repositório)

Spawn 3 teammates:

──────────────────────────────────────────────────────
Teammate 1 — document-worker
──────────────────────────────────────────────────────
Você implementa o worker BullMQ que processa documentos no projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/infrastructure/queue/DocumentWorker.ts
- apps/web/src/infrastructure/queue/QueueManager.ts
- apps/web/src/infrastructure/queue/__tests__/DocumentWorker.test.ts

DEPENDÊNCIAS A INSTALAR:
  bun add bullmq

COMPORTAMENTO ESPERADO:

QueueManager:
  Singleton que expõe:
  - getQueue(name: string): Queue    ← cria/retorna fila BullMQ
  - getWorker(name: string): Worker  ← retorna worker registrado
  Usa REDIS_URL da variável de ambiente.

DocumentWorker:
  Processa jobs do tipo DocumentJobData (de infrastructure/queue/types.ts).
  Pipeline de steps em sequência — cada step é idempotente:

  step 'ocr':
    - Busca o documento no storage (signed URL temporária)
    - Extrai texto via Tesseract.js (`bun add tesseract.js`)
    - Para PDFs: usa `pdf-parse` (`bun add pdf-parse`) para extrair texto
    - Salva extractedText no Document via PrismaDocumentRepository
    - Enfileira próximo job com step 'extraction'

  step 'extraction':
    - Lê extractedText do banco
    - Chama ClaudeDocumentAgent.extract(text, documentType)
    - Salva extractedData e inconsistencies no Document
    - Enfileira próximo job com step 'validation'

  step 'validation':
    - Lê todos os documentos válidos do caso
    - Chama ClaudeAnalysisAgent.analyze(documents)
    - Salva o resultado de análise no Document
    - Define status: VALID, VALID_WITH_CAVEATS, INVALID ou PENDING_CORRECTIONS
      baseado em DocumentAnalysisResult.recommendation
    - Enfileira próximo job com step 'status-update'

  step 'status-update':
    - Atualiza Document.status via repositório
    - Enfileira próximo job com step 'checklist'

  step 'checklist':
    - Busca o caso completo (ReformCase com riskLevel)
    - Busca todos os documentos do caso
    - Usa DocumentChecklist para calcular se checklist está completo
    - Emite ChecklistUpdatedEvent
    - Se allDocumentsValid: enfileira step 'emit-event'

  step 'emit-event':
    - Dispara DocumentProcessedEvent
    - Se o checklist estiver completo e o caso estiver em AWAITING_DOCUMENTS:
      transiciona o caso para DOCUMENTS_UNDER_REVIEW usando CaseStateMachine
      (via CaseTransitionLog + AuditLog — mesmo padrão de CreateCaseUseCase)

RETRY E ERROS:
  - Configuração BullMQ: attempts=3, backoff exponencial (2s base)
  - Em falha permanente (após 3 tentativas): atualiza Document.status para INVALID
    e loga o erro em AuditLog com action 'document.processing.failed'
  - Cada step verifica se o documento ainda existe antes de processar (idempotência)

TESTES:
  Mock ClaudeDocumentAgent, ClaudeAnalysisAgent, PrismaDocumentRepository.
  Teste o step 'extraction' com sucesso e com falha de parsing da IA.

NÃO TOQUE em:
- Nenhum arquivo fora de apps/web/src/infrastructure/queue/
- Você IMPORTA os módulos existentes — não reimplementa nada

Runtime: bun.

──────────────────────────────────────────────────────
Teammate 2 — document-api-routes
──────────────────────────────────────────────────────
Você implementa as rotas de API de documentos do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/app/api/v1/cases/[caseId]/documents/route.ts
- apps/web/app/api/v1/cases/[caseId]/documents/[documentId]/url/route.ts
- apps/web/app/api/v1/cases/[caseId]/documents/analyze/route.ts

PADRÃO A SEGUIR:
  Leia como estão implementadas as rotas existentes em:
  - apps/web/app/api/v1/cases/route.ts
  - apps/web/app/api/v1/cases/[caseId]/messages/route.ts
  Siga exatamente o mesmo padrão de auth, tenant injection e error handling.

COMPORTAMENTO ESPERADO:

POST /api/v1/cases/[caseId]/documents
  - Requer autenticação (getServerSession)
  - Aceita multipart/form-data com campos: file (File), documentType (DocumentType)
  - Valida mimeType: apenas pdf, jpeg, png, webp
  - Valida tamanho: máximo 20MB
  - Converte o File para Buffer
  - Chama UploadDocumentUseCase
  - Retorna 201 com o Document criado
  - Erro 400 se mimeType inválido, 413 se arquivo muito grande

GET /api/v1/cases/[caseId]/documents
  - Requer autenticação
  - Chama GetDocumentsByCase com caseId e tenantId da sessão
  - Retorna lista de documentos (sem storageKey — nunca exponha a chave interna)

GET /api/v1/cases/[caseId]/documents/[documentId]/url
  - Requer autenticação
  - Chama GetDocumentUrlUseCase
  - Retorna { url, expiresAt }
  - Erro 404 se documento não encontrado ou não pertence ao tenant

POST /api/v1/cases/[caseId]/documents/analyze
  - Requer autenticação e role ADMIN ou CONDOMINIUM
  - Reenfileira o processamento de todos os documentos PENDING do caso
  - Útil para reprocessamento manual
  - Retorna { queued: number }

REGRAS:
  - Nunca exponha storageKey nas respostas
  - Toda query usa tenantId da sessão — nunca do body/query
  - Imports: use os use cases existentes, não acesse o Prisma diretamente
  - Não escreva lógica de negócio nas rotas

NÃO TOQUE em:
- Nenhum arquivo fora de app/api/v1/cases/[caseId]/documents/
- Não altere rotas existentes (/cases, /messages, /units)

Runtime: bun.

──────────────────────────────────────────────────────
Teammate 3 — database-seed
──────────────────────────────────────────────────────
Você implementa o seed do banco de dados do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar/modificar:
- packages/database/seed.ts   ← arquivo principal do seed
- packages/database/data/policies.ts   ← as 14 regras do motor de regras

O seed é executado com: bun run db:seed

COMPORTAMENTO ESPERADO:

O seed deve ser idempotente — pode ser executado múltiplas vezes sem duplicar dados.
Use `upsert` do Prisma onde possível. Use transações para dados relacionados.

1. Tenant demo:
   { name: 'Demo Administradora', slug: 'demo', type: 'ADMINISTRADORA', active: true }

2. Condomínio demo:
   { name: 'Condomínio Edifício Central', cnpj: '12.345.678/0001-00',
     address: 'Rua das Flores, 123', city: 'São Paulo', state: 'SP' }

3. Unidades (3):
   - Apt 101 | floor: '1', ownerName: 'Morador Demo', ownerEmail: 'morador@demo.com'
   - Apt 201 | floor: '2'
   - Apt 301 | floor: '3'

4. Usuários (conforme CLAUDE.md seção 15):
   - admin@demo.com      | SUPER_ADMIN | senha: 'senha123'
   - sindico@demo.com    | CONDOMINIUM | senha: 'senha123'
   - morador@demo.com    | CLIENT      | senha: 'senha123'
   - parceiro@demo.com   | PARTNER     | senha: 'senha123'
   
   Hash de senha: olhe como está sendo feito em infrastructure/auth/auth.ts
   e use o mesmo mecanismo de hash.

5. Política padrão global com as 14 regras do CLAUDE.md seção 7:
   { name: 'Política Padrão Global', tenantId: null (global), active: true }

   Crie o arquivo packages/database/data/policies.ts com array de regras:

   const DEFAULT_RULES = [
     {
       name: 'Pintura simples',
       description: 'Pintura simples de paredes internas',
       condition: { field: 'services', operator: 'contains', value: 'Pintura simples' },
       action: { riskDelta: 5, requiresART: false, requiresHumanReview: false, mandatoryInspection: false },
       priority: 10,
     },
     // ... todas as 14 regras conforme tabela no CLAUDE.md seção 7
   ]

   Implemente todas as 14 regras com os valores exatos da tabela do CLAUDE.md.

6. Parceiro demo:
   { creaNumber: 'SP-123456', type: 'ENGINEER',
     specialties: ['Elétrica', 'Hidráulica', 'Estrutural'],
     cities: ['São Paulo'], states: ['SP'],
     basePrice: 500.00, slaHours: 48, active: true }
   Associado ao usuário parceiro@demo.com

7. Plano comercial demo:
   { name: 'Plano Essencial', basePrice: 990.00, extraInspectionPrice: 250.00,
     includes: { inspections: 3, reports: ['ANALYSIS', 'TECHNICAL_OPINION'] } }

Ao final, imprima um resumo de quantos registros foram criados/atualizados.

NÃO TOQUE em:
- Nenhum arquivo de schema Prisma (packages/database/schema.prisma)
- Nenhum arquivo fora de packages/database/

Runtime: bun. Teste rodando `bun run db:seed` ao final.
```

---

## Arquivos gerados por esta wave

```
apps/web/src/infrastructure/queue/
  DocumentWorker.ts
  QueueManager.ts
  __tests__/DocumentWorker.test.ts

apps/web/app/api/v1/cases/[caseId]/documents/
  route.ts
  [documentId]/url/route.ts
  analyze/route.ts

packages/database/
  seed.ts
  data/policies.ts
```

## Checklist antes de mergear

- [ ] `bun run test` passa
- [ ] `bun run build` sem erros
- [ ] `bun run db:seed` executa sem erro
- [ ] `storageKey` nunca aparece nas respostas da API
- [ ] Worker é idempotente (pode reprocessar sem duplicar dados)
- [ ] Seed é idempotente (pode rodar N vezes)
