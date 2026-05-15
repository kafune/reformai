# M2-W1 — Infraestrutura + Domínio Documental

**Tipo:** Agent Team (3 agentes em paralelo)  
**Pré-requisito:** M2-W0 mergeada em `main`  
**Duração estimada:** 60–90 min  

---

## PROMPT PARA O CLAUDE CODE

```
Crie uma equipe de 3 agentes para implementar a infraestrutura e o domínio
documental do projeto ReformAI.

Leia o CLAUDE.md antes de coordenar os agentes — ele é a fonte de verdade do projeto.

Os contratos compartilhados já estão definidos em:
- apps/web/src/infrastructure/storage/StorageAdapter.ts
- apps/web/src/infrastructure/queue/types.ts
- apps/web/src/modules/document-management/domain/repositories/DocumentRepository.ts
- apps/web/src/modules/document-intelligence/domain/DocumentAgent.ts
- apps/web/src/modules/document-intelligence/domain/AnalysisAgent.ts

Nenhum agente deve tocar nesses arquivos — apenas importá-los.

Spawn 3 teammates com os seguintes papéis:

──────────────────────────────────────────────────────
Teammate 1 — storage-infrastructure
──────────────────────────────────────────────────────
Você implementa os adapters de storage do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/infrastructure/storage/MinIOAdapter.ts
- apps/web/src/infrastructure/storage/S3Adapter.ts
- apps/web/src/infrastructure/storage/StorageFactory.ts
- apps/web/src/infrastructure/storage/__tests__/MinIOAdapter.test.ts

INTERFACES A IMPLEMENTAR (leia o arquivo, não reescreva):
- apps/web/src/infrastructure/storage/StorageAdapter.ts

COMPORTAMENTO ESPERADO:
- MinIOAdapter: usa o pacote `minio`. Instale com `bun add minio`.
- S3Adapter: usa `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`.
  Instale com `bun add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.
- StorageFactory: lê env var STORAGE_ADAPTER (valores: 'minio' | 's3').
  Retorna a instância correta do adapter. Lança erro claro se STORAGE_ADAPTER
  tiver valor inválido.
- Signed URLs expiram em 3600 segundos (1 hora). Nunca exponha URLs permanentes.
- O método `upload` deve verificar se o bucket existe e criá-lo se não existir (MinIO).

VARIÁVEIS DE AMBIENTE (já definidas no .env.example do projeto):
- STORAGE_ADAPTER, MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET

TESTES:
Escreva testes unitários para MinIOAdapter mockando o cliente minio.
Cubra: upload, getSignedUrl, delete, e erro quando bucket não existe.

NÃO TOQUE em nenhum arquivo fora de `apps/web/src/infrastructure/storage/`.

Runtime: bun. Rode `bun run test` ao final para verificar seus testes.

──────────────────────────────────────────────────────
Teammate 2 — document-management
──────────────────────────────────────────────────────
Você implementa o módulo de gerenciamento de documentos do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/document-management/application/UploadDocumentUseCase.ts
- apps/web/src/modules/document-management/application/GetDocumentUrlUseCase.ts
- apps/web/src/modules/document-management/application/GetDocumentsByCase.ts
- apps/web/src/modules/document-management/domain/DocumentChecklist.ts
- apps/web/src/modules/document-management/infrastructure/PrismaDocumentRepository.ts
- apps/web/src/modules/document-management/infrastructure/QueueDocumentJob.ts
- apps/web/src/modules/document-management/application/__tests__/UploadDocumentUseCase.test.ts

INTERFACES A USAR (leia, não reescreva):
- apps/web/src/modules/document-management/domain/repositories/DocumentRepository.ts
- apps/web/src/infrastructure/storage/StorageAdapter.ts
- apps/web/src/infrastructure/queue/types.ts

COMPORTAMENTO ESPERADO:

UploadDocumentUseCase:
  Input: { caseId, tenantId, buffer: Buffer, fileName, mimeType, documentType, uploadedBy }
  - Valida o mimeType (aceitos: application/pdf, image/jpeg, image/png, image/webp)
  - Gera um storageKey usando buildStorageKey() de StorageAdapter.ts
  - Chama storageAdapter.upload()
  - Persiste o Document no banco via DocumentRepository com status PENDING
  - Enfileira o job de processamento via QueueDocumentJob
  - Retorna o Document criado
  - Toda query usa tenantId como filtro

GetDocumentUrlUseCase:
  Input: { documentId, tenantId }
  - Busca o documento via repositório (verifica tenantId)
  - Chama storageAdapter.getSignedUrl(storageKey, 3600)
  - Retorna { url, expiresAt }

DocumentChecklist:
  Classe de domínio pura (sem Prisma, sem IA).
  Recebe: riskLevel (LOW/MEDIUM/HIGH/CRITICAL) + lista de DocumentRecord
  Retorna: { complete: boolean, required: DocumentType[], missing: DocumentType[], optional: DocumentType[] }

  Regras de documentos obrigatórios por risco:
  - LOW: nenhum obrigatório (só autorização é recomendada)
  - MEDIUM: [AUTHORIZATION]
  - HIGH: [AUTHORIZATION, ART_RRT, MEMORIAL]
  - CRITICAL: [AUTHORIZATION, ART_RRT, MEMORIAL, PROJECT, SCHEDULE, WORKFORCE]

PrismaDocumentRepository:
  Implementa DocumentRepository.
  Toda query ao banco filtra por tenantId. Sem exceção.

QueueDocumentJob:
  Usa BullMQ para enfileirar DocumentJobData.
  Importe DOCUMENT_QUEUE de infrastructure/queue/types.ts.

TESTES:
Escreva testes para UploadDocumentUseCase mockando storage e repositório.
Cubra: upload bem-sucedido, mimeType inválido, isolamento de tenant.

NÃO TOQUE em:
- infrastructure/storage/ (é do Teammate 1)
- modules/document-intelligence/ (é do Teammate 3)
- Qualquer módulo fora de document-management/

Runtime: bun. Rode `bun run test` ao final.

──────────────────────────────────────────────────────
Teammate 3 — document-intelligence
──────────────────────────────────────────────────────
Você implementa os agentes de IA para análise documental do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

ESCOPO — arquivos que você deve criar:
- apps/web/src/modules/document-intelligence/application/ClaudeDocumentAgent.ts
- apps/web/src/modules/document-intelligence/application/ClaudeAnalysisAgent.ts
- apps/web/src/modules/document-intelligence/application/__tests__/ClaudeDocumentAgent.test.ts

INTERFACES A IMPLEMENTAR (leia, não reescreva):
- apps/web/src/modules/document-intelligence/domain/DocumentAgent.ts
- apps/web/src/modules/document-intelligence/domain/AnalysisAgent.ts

INTERFACE DE LLM A USAR (leia, não reimplemente):
- apps/web/src/modules/document-intelligence/domain/LLMProvider.ts
- A implementação concreta é AnthropicProvider em infrastructure/llm/AnthropicProvider.ts
  Você recebe LLMProvider por injeção de dependência — não instancie AnthropicProvider diretamente.

COMPORTAMENTO ESPERADO:

ClaudeDocumentAgent (implementa DocumentAgent):
  extract(text: string, documentType: DocumentType): Promise<DocumentExtractionResult>
  
  - Constrói um prompt específico por tipo de documento (use system prompt diferente para
    ART_RRT, MEMORIAL, PROJECT, AUTHORIZATION, etc.)
  - Para ART_RRT extrai: número ART, CREA do responsável, data de validade, tipo de obra,
    valor da obra, nome do responsável técnico
  - Para MEMORIAL extrai: materiais listados, quantidades, serviços descritos
  - Para AUTHORIZATION extrai: nome do condômino, unidade, data de autorização, serviços autorizados
  - O modelo deve retornar JSON dentro de <extraction>...</extraction> tags
  - Parse o JSON e valide com DocumentExtractionResultSchema (de domain/DocumentAgent.ts)
  - Em caso de falha de parsing: retorna resultado com confidence=0 e warnings com o erro

ClaudeAnalysisAgent (implementa AnalysisAgent):
  analyze(documents: Array<{ type, extractedData }>): Promise<DocumentAnalysisResult>
  
  - Constrói prompt com todos os documentos fornecidos
  - Pede ao modelo que identifique inconsistências cross-documentos
    (ex: nome diferente entre ART e memorial, data inválida, serviço não autorizado)
  - O modelo deve retornar JSON dentro de <analysis>...</analysis> tags
  - Parse e valide com DocumentAnalysisResultSchema (de domain/AnalysisAgent.ts)
  - Valide também com Zod. Nunca use resultado não-validado.

REGRA CRÍTICA:
  Toda saída da IA é validada por Zod antes de ser usada.
  Se a validação falhar, lance ValidationError (de shared/errors/DomainError.ts).

TESTES:
  Mock o LLMProvider. Teste:
  - Extração bem-sucedida de ART_RRT com JSON válido na resposta
  - Falha de parsing: retorna confidence=0
  - Análise detectando inconsistência de nome entre documentos

NÃO TOQUE em:
- infrastructure/ (storage, queue — é de outros agentes)
- modules/document-management/ (é do Teammate 2)
- AnthropicProvider.ts — você só usa a interface LLMProvider

Runtime: bun. Rode `bun run test` ao final.
```

---

## Arquivos gerados por esta wave

```
apps/web/src/infrastructure/storage/
  MinIOAdapter.ts
  S3Adapter.ts
  StorageFactory.ts
  __tests__/MinIOAdapter.test.ts

apps/web/src/modules/document-management/
  application/UploadDocumentUseCase.ts
  application/GetDocumentUrlUseCase.ts
  application/GetDocumentsByCase.ts
  application/__tests__/UploadDocumentUseCase.test.ts
  domain/DocumentChecklist.ts
  infrastructure/PrismaDocumentRepository.ts
  infrastructure/QueueDocumentJob.ts

apps/web/src/modules/document-intelligence/
  application/ClaudeDocumentAgent.ts
  application/ClaudeAnalysisAgent.ts
  application/__tests__/ClaudeDocumentAgent.test.ts
```

## Checklist antes de mergear

- [ ] `bun run test` passa (todos os testes unitários)
- [ ] `bun run build` sem erros TypeScript
- [ ] Nenhum agente tocou em arquivos do escopo de outro
- [ ] Nenhuma importação direta de `@anthropic-ai/sdk` fora de `AnthropicProvider.ts`
- [ ] Toda query ao banco com filtro `tenantId`
