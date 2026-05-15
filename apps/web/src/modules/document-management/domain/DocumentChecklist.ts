import { DocumentType, type RiskLevel } from "@reformai/database"
import type { DocumentRecord } from "./repositories/DocumentRepository"

export interface ChecklistResult {
  complete: boolean
  required: DocumentType[]
  missing: DocumentType[]
  optional: DocumentType[]
}

/**
 * Tipos de documentos cujo `status` indica presença efetiva no caso.
 * Documentos `INVALID` ou `MISSING` não contam como entregues.
 */
const PRESENT_STATUSES = new Set<string>([
  "PENDING",
  "PROCESSING",
  "VALID",
  "VALID_WITH_CAVEATS",
])

const REQUIRED_BY_RISK: Record<RiskLevel, DocumentType[]> = {
  LOW: [],
  MEDIUM: [DocumentType.AUTHORIZATION],
  HIGH: [DocumentType.AUTHORIZATION, DocumentType.ART_RRT, DocumentType.MEMORIAL],
  CRITICAL: [
    DocumentType.AUTHORIZATION,
    DocumentType.ART_RRT,
    DocumentType.MEMORIAL,
    DocumentType.PROJECT,
    DocumentType.SCHEDULE,
    DocumentType.WORKFORCE,
  ],
}

const OPTIONAL_BY_RISK: Record<RiskLevel, DocumentType[]> = {
  LOW: [DocumentType.AUTHORIZATION],
  MEDIUM: [],
  HIGH: [],
  CRITICAL: [],
}

export class DocumentChecklist {
  static evaluate(riskLevel: RiskLevel, documents: DocumentRecord[]): ChecklistResult {
    const required = REQUIRED_BY_RISK[riskLevel]
    const optional = OPTIONAL_BY_RISK[riskLevel]

    const presentTypes = new Set<DocumentType>()
    for (const doc of documents) {
      if (PRESENT_STATUSES.has(doc.status)) {
        presentTypes.add(doc.type)
      }
    }

    const missing = required.filter((t) => !presentTypes.has(t))

    return {
      complete: missing.length === 0,
      required,
      missing,
      optional,
    }
  }
}
