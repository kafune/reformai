import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import type { PolicyData, RuleAction, RuleCondition } from "../domain/types"

export class PrismaPolicyRepository {
  async resolveForCondominium(condominiumId: string, tenantId: string): Promise<PolicyData> {
    const link = await prisma.condominiumPolicy.findFirst({
      where: {
        condominiumId,
        policy: { active: true, OR: [{ tenantId }, { tenantId: null }] },
      },
      include: { policy: { include: { rules: true } } },
    })

    let policy = link?.policy ?? null
    if (!policy) {
      policy = await prisma.policy.findFirst({
        where: { active: true, OR: [{ tenantId }, { tenantId: null }] },
        include: { rules: true },
        orderBy: [{ tenantId: "desc" }, { effectiveFrom: "desc" }],
      })
    }

    if (!policy) throw new NotFoundError("Policy", `condominium=${condominiumId}`)

    return {
      id: policy.id,
      tenantId: policy.tenantId,
      name: policy.name,
      version: policy.version,
      active: policy.active,
      rules: policy.rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        condition: r.condition as unknown as RuleCondition,
        action: r.action as unknown as RuleAction,
        priority: r.priority,
        active: r.active,
      })),
    }
  }
}
