import type { Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import type {
  CreateInspectionInput,
  InspectionRepository,
} from "../domain/repositories/InspectionRepository"

export class PrismaInspectionRepository implements InspectionRepository {
  async create(input: CreateInspectionInput): Promise<Inspection> {
    return prisma.inspection.create({
      data: {
        caseId: input.caseId,
        tenantId: input.tenantId,
        partnerId: input.partnerId,
        type: input.type as never,
        scheduledAt: input.scheduledAt,
        notes: input.notes,
        status: "SCHEDULED",
        photoKeys: [],
        extraCharge: input.extraCharge !== null && input.extraCharge !== undefined
          ? input.extraCharge
          : null,
      },
    })
  }

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
    patch: { scheduledAt?: Date; notes?: string },
  ): Promise<Inspection> {
    // Verify tenant ownership before update
    const existing = await prisma.inspection.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error(`Inspection not found: ${id}`)

    return prisma.inspection.update({
      where: { id },
      data: {
        ...(patch.scheduledAt !== undefined ? { scheduledAt: patch.scheduledAt } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      },
    })
  }

  async complete(
    id: string,
    tenantId: string,
    patch: { notes: string; photoKeys?: string[] },
  ): Promise<Inspection> {
    const existing = await prisma.inspection.findFirst({ where: { id, tenantId } })
    if (!existing) throw new Error(`Inspection not found: ${id}`)

    return prisma.inspection.update({
      where: { id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        notes: patch.notes,
        photoKeys: patch.photoKeys ?? [],
      },
    })
  }
}
