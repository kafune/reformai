import type { Inspection } from "@reformai/database"

export interface CreateInspectionInput {
  caseId: string
  tenantId: string
  partnerId: string
  type: string
  scheduledAt?: Date
  notes?: string
  extraCharge?: number | null
}

export interface InspectionRepository {
  create(input: CreateInspectionInput): Promise<Inspection>
  findById(id: string, tenantId: string): Promise<Inspection | null>
  findByCaseId(caseId: string, tenantId: string): Promise<Inspection[]>
  updateScheduled(
    id: string,
    tenantId: string,
    patch: { scheduledAt?: Date; notes?: string },
  ): Promise<Inspection>
  complete(
    id: string,
    tenantId: string,
    patch: { notes: string; photoKeys?: string[] },
  ): Promise<Inspection>
}
