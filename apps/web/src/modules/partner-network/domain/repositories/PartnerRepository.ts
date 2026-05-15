import type { Partner, ReformCase } from "@reformai/database"

export interface PartnerRepository {
  findAvailable(tenantId: string, city: string, state: string): Promise<Partner[]>
  findById(id: string, tenantId: string): Promise<Partner | null>
  updateRating(id: string, tenantId: string, rating: number): Promise<void>
  findCases(partnerId: string, tenantId: string): Promise<ReformCase[]>
}
