import type { Inspection } from "@reformai/database"
import type { InspectionRepository } from "../domain/repositories/InspectionRepository"

interface GetCaseInspectionsInput {
  caseId: string
  tenantId: string
}

export class GetCaseInspectionsUseCase {
  constructor(private readonly inspectionRepo: InspectionRepository) {}

  async execute(input: GetCaseInspectionsInput): Promise<Inspection[]> {
    const { caseId, tenantId } = input
    return this.inspectionRepo.findByCaseId(caseId, tenantId)
  }
}
