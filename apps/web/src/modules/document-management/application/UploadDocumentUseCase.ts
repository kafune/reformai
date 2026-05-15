import { randomUUID } from "node:crypto"
import type { DocOrigin, DocumentType } from "@reformai/database"
import { ValidationError } from "@/shared/errors/DomainError"
import { buildStorageKey, type StorageAdapter } from "@/infrastructure/storage/StorageAdapter"
import type {
  DocumentRecord,
  DocumentRepository,
} from "../domain/repositories/DocumentRepository"
import type { QueueDocumentJob } from "../infrastructure/QueueDocumentJob"

const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
])

export interface UploadDocumentInput {
  caseId: string
  tenantId: string
  condominiumId: string
  unitId: string
  buffer: Buffer
  fileName: string
  mimeType: string
  documentType: DocumentType
  origin: DocOrigin
}

export interface UploadDocumentDeps {
  storage: StorageAdapter
  repo: DocumentRepository
  queue: QueueDocumentJob
}

export class UploadDocumentUseCase {
  constructor(private readonly deps: UploadDocumentDeps) {}

  async execute(input: UploadDocumentInput): Promise<DocumentRecord> {
    if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
      throw new ValidationError(
        `mimeType não suportado: ${input.mimeType}`,
        { allowed: Array.from(ALLOWED_MIME_TYPES) },
      )
    }

    const documentId = randomUUID()
    const storageKey = buildStorageKey(
      input.tenantId,
      input.condominiumId,
      input.unitId,
      input.caseId,
      "incoming",
      documentId,
      input.fileName,
    )

    await this.deps.storage.upload(storageKey, input.buffer, input.mimeType)

    const doc = await this.deps.repo.create({
      caseId: input.caseId,
      tenantId: input.tenantId,
      type: input.documentType,
      fileName: input.fileName,
      storageKey,
      mimeType: input.mimeType,
      origin: input.origin,
    })

    await this.deps.queue.enqueue({
      caseId: input.caseId,
      documentId: doc.id,
      tenantId: input.tenantId,
      storageKey,
      mimeType: input.mimeType,
      step: "ocr",
    })

    return doc
  }
}
