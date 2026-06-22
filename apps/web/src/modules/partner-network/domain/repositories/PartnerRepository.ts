import type { Partner } from "@reformai/database"

export interface PartnerRepository {
  findAvailable(tenantId: string, city: string, state: string): Promise<Partner[]>
}
