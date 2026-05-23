import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import { applyOverrides } from "../domain/applyOverrides"
import type { PolicyData, PolicyOverrides, RuleAction, RuleCondition } from "../domain/types"

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
    // Overrides só se aplicam quando a política veio do vínculo do condomínio.
    const overrides = link?.policy ? (link.overrides as unknown as PolicyOverrides | null) : null

    if (!policy) {
      policy = await prisma.policy.findFirst({
        where: { active: true, OR: [{ tenantId }, { tenantId: null }] },
        include: { rules: true },
        orderBy: [{ tenantId: "desc" }, { effectiveFrom: "desc" }],
      })
    }

    if (!policy) throw new NotFoundError("Policy", `condominium=${condominiumId}`)

    const rules = policy.rules.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      condition: r.condition as unknown as RuleCondition,
      action: r.action as unknown as RuleAction,
      priority: r.priority,
      active: r.active,
    }))

    return {
      id: policy.id,
      tenantId: policy.tenantId,
      name: policy.name,
      version: policy.version,
      active: policy.active,
      rules: applyOverrides(rules, overrides),
    }
  }
}
