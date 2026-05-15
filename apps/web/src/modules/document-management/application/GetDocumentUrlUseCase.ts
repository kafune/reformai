import { NotFoundError } from "@/shared/errors/DomainError"
import type { StorageAdapter } from "@/infrastructure/storage/StorageAdapter"
import type { DocumentRepository } from "../domain/repositories/DocumentRepository"

const SIGNED_URL_TTL_SECONDS = 3600

export interface GetDocumentUrlInput {
  documentId: string
  tenantId: string
}

export interface GetDocumentUrlResult {
  url: string
  expiresAt: Date
}

export interface GetDocumentUrlDeps {
  storage: StorageAdapter
  repo: DocumentRepository
}

export class GetDocumentUrlUseCase {
  constructor(private readonly deps: GetDocumentUrlDeps) {}

  async execute(input: GetDocumentUrlInput): Promise<GetDocumentUrlResult> {
    const doc = await this.deps.repo.findById(input.documentId, input.tenantId)
    if (!doc) {
      throw new NotFoundError("Document", input.documentId)
    }

    const url = await this.deps.storage.getSignedUrl(doc.storageKey, SIGNED_URL_TTL_SECONDS)
    return {
      url,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000),
    }
  }
}
