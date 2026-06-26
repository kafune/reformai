import type { Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import type { InspectionRepository } from "../domain/repositories/InspectionRepository"

export class PrismaInspectionRepository implements InspectionRepository {
  async findById(id: string, tenantId: string): Promise<Inspection | null> {
    return prisma.inspection.findFirst({ where: { id, tenantId } })
  }

  async findByCaseId(caseId: string, tenantId: string): Promise<Inspection[]> {
    return prisma.inspection.findMany({
      where: { caseId, tenantId },
      orderBy: { scheduledAt: "asc" },
    })
  }

  async updateScheduled(
    id: string,
    tenantId: string,
    data: { scheduledAt?: Date; notes?: string },
  ): Promise<Inspection> {
    // Escopo de tenant garantido no WHERE; campos undefined não são alterados.
    await prisma.inspection.updateMany({
      where: { id, tenantId },
      data: {
        ...(data.scheduledAt !== undefined ? { scheduledAt: data.scheduledAt } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    })
    const updated = await prisma.inspection.findFirst({ where: { id, tenantId } })
    if (!updated) throw new NotFoundError("Inspection", id)
    return updated
  }
}
