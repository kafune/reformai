import type { Document, DocOrigin, DocStatus, DocumentType } from "@reformai/database"

export type DocumentRecord = Document

export interface CreateDocumentInput {
  caseId: string
  tenantId: string
  type: DocumentType
  fileName: string
  storageKey: string
  mimeType: string
  origin: DocOrigin
  version?: number
}

export interface UpdateExtractedDataInput {
  extractedText?: string
  extractedData?: Record<string, unknown>
  inconsistencies?: Record<string, unknown>
  pendencies?: Record<string, unknown>
}

export interface DocumentRepository {
  create(input: CreateDocumentInput): Promise<DocumentRecord>
  findById(id: string, tenantId: string): Promise<DocumentRecord | null>
  findByCaseId(caseId: string, tenantId: string): Promise<DocumentRecord[]>
  updateStatus(id: string, status: DocStatus, tenantId: string): Promise<void>
  updateExtractedData(id: string, data: UpdateExtractedDataInput, tenantId: string): Promise<void>
}
