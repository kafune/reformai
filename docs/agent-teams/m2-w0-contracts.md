# M2-W0 — Contratos Compartilhados

**Tipo:** Sessão única (não é Agent Team — é sequencial por natureza)  
**Pré-requisito:** `main` limpa com o Milestone 1 mergeado  
**Duração estimada:** 30–45 min  

> Esta wave define as interfaces que todas as waves paralelas irão consumir.
> Nenhuma implementação aqui — apenas contratos TypeScript e schemas Zod.

---

## PROMPT PARA O CLAUDE CODE

```
Você vai definir os contratos compartilhados do Milestone 2 do projeto ReformAI.
Leia o CLAUDE.md inteiro antes de começar — ele é a fonte de verdade.

Esta é uma tarefa de DEFINIÇÃO DE INTERFACES APENAS. Não escreva nenhuma
implementação concreta. Apenas tipos, interfaces TypeScript e schemas Zod.

Crie os seguintes arquivos:

──────────────────────────────────────────────────
1. apps/web/src/infrastructure/storage/StorageAdapter.ts
──────────────────────────────────────────────────
Interface de storage abstrato conforme especificado no CLAUDE.md seção 11:

interface StorageAdapter {
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>
  delete(key: string): Promise<void>
}

Adicione também um helper de chaves:
function buildStorageKey(
  tenantId: string,
  condominiumId: string,
  unitId: string,
  caseId: string,
  area: 'incoming' | 'reports' | 'inspections' | 'final',
  subId: string,
  fileName: string
): string

Estrutura: tenants/{tenantId}/condominiums/{condominiumId}/units/{unitId}/cases/{caseId}/{area}/{subId}/{fileName}

──────────────────────────────────────────────────
2. apps/web/src/infrastructure/queue/types.ts
──────────────────────────────────────────────────
Tipos dos jobs BullMQ para o pipeline documental:

export const DOCUMENT_QUEUE = 'document-processing'

export type DocumentJobStep =
  | 'ocr'
  | 'extraction'
  | 'validation'
  | 'status-update'
  | 'checklist'
  | 'emit-event'

export interface DocumentJobData {
  caseId: string
  documentId: string
  tenantId: string
  storageKey: string
  mimeType: string
  step: DocumentJobStep
}

export interface DocumentJobResult {
  success: boolean
  documentId: string
  step: DocumentJobStep
  error?: string
}

──────────────────────────────────────────────────
3. apps/web/src/modules/document-management/domain/repositories/DocumentRepository.ts
──────────────────────────────────────────────────
Interface do repositório de documentos:

interface DocumentRepository {
  create(input: CreateDocumentInput): Promise<DocumentRecord>
  findById(id: string, tenantId: string): Promise<DocumentRecord | null>
  findByCaseId(caseId: string, tenantId: string): Promise<DocumentRecord[]>
  updateStatus(id: string, status: DocStatus, tenantId: string): Promise<void>
  updateExtractedData(id: string, data: UpdateExtractedDataInput, tenantId: string): Promise<void>
}

Use os enums do Prisma (DocumentType, DocStatus, DocOrigin).
Defina CreateDocumentInput e UpdateExtractedDataInput como tipos separados.

──────────────────────────────────────────────────
4. apps/web/src/modules/document-intelligence/domain/DocumentAgent.ts
──────────────────────────────────────────────────
Interface do agente de extração de dados de documentos:

interface DocumentExtractionResult {
  documentType: DocumentType
  extractedFields: Record<string, unknown>
  confidence: number  // 0-1
  warnings: string[]
}

interface DocumentAgent {
  extract(text: string, documentType: DocumentType): Promise<DocumentExtractionResult>
}

Adicione o schema Zod DocumentExtractionResultSchema abaixo da interface.

──────────────────────────────────────────────────
5. apps/web/src/modules/document-intelligence/domain/AnalysisAgent.ts
──────────────────────────────────────────────────
Interface do agente de análise cross-documentos:

interface DocumentInconsistency {
  field: string
  documentA: string
  documentB: string
  description: string
  severity: 'low' | 'medium' | 'high'
}

interface DocumentAnalysisResult {
  consistent: boolean
  inconsistencies: DocumentInconsistency[]
  pendencies: string[]
  recommendation: 'approve' | 'approve_with_caveats' | 'reject' | 'request_corrections'
  reasoning: string
}

interface AnalysisAgent {
  analyze(documents: Array<{ type: DocumentType; extractedData: Record<string, unknown> }>): Promise<DocumentAnalysisResult>
}

Adicione o schema Zod DocumentAnalysisResultSchema abaixo da interface.

──────────────────────────────────────────────────
6. apps/web/src/shared/events/CaseEvents.ts
──────────────────────────────────────────────────
Eventos de domínio relacionados a documentos e checklist:

export interface DocumentProcessedEvent {
  type: 'document.processed'
  caseId: string
  tenantId: string
  documentId: string
  status: DocStatus
  timestamp: Date
}

export interface ChecklistUpdatedEvent {
  type: 'checklist.updated'
  caseId: string
  tenantId: string
  allDocumentsValid: boolean
  pendingDocuments: string[]
  timestamp: Date
}

export type CaseDomainEvent = DocumentProcessedEvent | ChecklistUpdatedEvent

──────────────────────────────────────────────────

REGRAS:
- Nenhum arquivo de implementação
- Nenhuma importação de SDKs externos
- Use apenas imports de tipos do Prisma (@prisma/client) onde necessário
- Runtime: bun
- Ao terminar, rode: bun run build e corrija qualquer erro de tipo
```

---

## Arquivos gerados por esta wave

```
apps/web/src/infrastructure/storage/StorageAdapter.ts
apps/web/src/infrastructure/queue/types.ts
apps/web/src/modules/document-management/domain/repositories/DocumentRepository.ts
apps/web/src/modules/document-intelligence/domain/DocumentAgent.ts
apps/web/src/modules/document-intelligence/domain/AnalysisAgent.ts
apps/web/src/shared/events/CaseEvents.ts
```

## Checklist antes de mergear

- [ ] `bun run build` sem erros
- [ ] Nenhum arquivo de implementação criado (só interfaces e tipos)
- [ ] Nenhum import de SDK externo
