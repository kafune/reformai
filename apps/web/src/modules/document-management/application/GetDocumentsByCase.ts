import type {
  DocumentRecord,
  DocumentRepository,
} from "../domain/repositories/DocumentRepository"

export interface GetDocumentsByCaseInput {
  caseId: string
  tenantId: string
}

export interface GetDocumentsByCaseDeps {
  repo: DocumentRepository
}

export class GetDocumentsByCase {
  constructor(private readonly deps: GetDocumentsByCaseDeps) {}

  async execute(input: GetDocumentsByCaseInput): Promise<DocumentRecord[]> {
    return this.deps.repo.findByCaseId(input.caseId, input.tenantId)
  }
}
