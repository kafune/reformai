export const DOCUMENT_QUEUE = "document-processing"

export type DocumentJobStep =
  | "ocr"
  | "extraction"
  | "validation"
  | "status-update"
  | "checklist"
  | "emit-event"

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
