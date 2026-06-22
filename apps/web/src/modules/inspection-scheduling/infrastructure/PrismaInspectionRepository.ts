import type { Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
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
}
