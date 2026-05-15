import type { CommercialPlan } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"

export class PrismaCommercialRepository {
  /**
   * Find a single CommercialPlan by id scoped to the tenant.
   * Returns null if not found or belongs to a different tenant.
   */
  async findPlanById(planId: string, tenantId: string): Promise<CommercialPlan | null> {
    return prisma.commercialPlan.findFirst({
      where: { id: planId, tenantId, active: true },
    })
  }

  /**
   * List all active CommercialPlans for the tenant.
   */
  async listPlans(tenantId: string): Promise<CommercialPlan[]> {
    return prisma.commercialPlan.findMany({
      where: { tenantId, active: true },
      orderBy: { name: "asc" },
    })
  }
}
