import type { Partner, ReformCase } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import type { PartnerRepository } from "../domain/repositories/PartnerRepository"

export class PrismaPartnerRepository implements PartnerRepository {
  async findAvailable(tenantId: string, city: string, state: string): Promise<Partner[]> {
    return prisma.partner.findMany({
      where: {
        tenantId,
        active: true,
        states: { has: state },
      },
    }) as Promise<Partner[]>
  }

  async findById(id: string, tenantId: string): Promise<Partner | null> {
    return prisma.partner.findFirst({
      where: { id, tenantId },
    }) as Promise<Partner | null>
  }

  async updateRating(id: string, tenantId: string, rating: number): Promise<void> {
    await prisma.partner.updateMany({
      where: { id, tenantId },
      data: { rating },
    })
  }

  async findCases(partnerId: string, tenantId: string): Promise<ReformCase[]> {
    return prisma.reformCase.findMany({
      where: { partnerId, tenantId },
      orderBy: { createdAt: "desc" },
    }) as Promise<ReformCase[]>
  }
}
