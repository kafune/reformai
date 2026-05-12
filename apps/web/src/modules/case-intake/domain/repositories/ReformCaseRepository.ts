import type { CaseStatus, ReformCase, RiskLevel } from "@reformai/database"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"

export interface CreateCaseInput {
  tenantId: string
  condominiumId: string
  unitId: string
  clientId: string
  protocol: string
}

export interface UpdateScopeInput {
  scope: ReformScope
  evaluationResult: unknown
  riskLevel: RiskLevel
  requiresART: boolean
  triageScore: number
  newStatus: CaseStatus
  previousStatus: CaseStatus
  triggeredBy: string
  reason?: string
}

export interface ReformCaseRepository {
  create(input: CreateCaseInput): Promise<ReformCase>
  findById(id: string, tenantId: string): Promise<ReformCase | null>
  listByTenant(tenantId: string, filters?: { clientId?: string }): Promise<ReformCase[]>
  applyScopeClassification(caseId: string, tenantId: string, input: UpdateScopeInput): Promise<ReformCase>
  appendMessage(caseId: string, tenantId: string, role: "USER" | "ASSISTANT" | "SYSTEM", content: string, metadata?: unknown): Promise<void>
  listMessages(caseId: string, tenantId: string): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>>
}
