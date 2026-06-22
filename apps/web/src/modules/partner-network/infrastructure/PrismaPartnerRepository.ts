import type { Partner } from "@reformai/database"
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
}
