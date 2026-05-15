import type { DocStatus } from "@reformai/database"

export interface DocumentProcessedEvent {
  type: "document.processed"
  caseId: string
  tenantId: string
  documentId: string
  status: DocStatus
  timestamp: Date
}

export interface ChecklistUpdatedEvent {
  type: "checklist.updated"
  caseId: string
  tenantId: string
  allDocumentsValid: boolean
  pendingDocuments: string[]
  timestamp: Date
}

export type CaseDomainEvent = DocumentProcessedEvent | ChecklistUpdatedEvent
