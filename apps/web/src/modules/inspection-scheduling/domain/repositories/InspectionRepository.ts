import type { Inspection } from "@reformai/database"

export interface InspectionRepository {
  findById(id: string, tenantId: string): Promise<Inspection | null>
  findByCaseId(caseId: string, tenantId: string): Promise<Inspection[]>
}
