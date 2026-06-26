import type { Inspection } from "@reformai/database"

export interface InspectionRepository {
  findById(id: string, tenantId: string): Promise<Inspection | null>
  findByCaseId(caseId: string, tenantId: string): Promise<Inspection[]>
  /**
   * Atualiza data e/ou observações de uma vistoria (reagendamento), com escopo
   * de tenant. Campos `undefined` não são alterados. Retorna o registro
   * atualizado.
   */
  updateScheduled(
    id: string,
    tenantId: string,
    data: { scheduledAt?: Date; notes?: string },
  ): Promise<Inspection>
}
