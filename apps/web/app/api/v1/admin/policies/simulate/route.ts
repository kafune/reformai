import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import { ReformScopeSchema } from "@/shared/schemas/ReformScopeSchema"
import { DeterministicEvaluator } from "@/modules/rule-engine/domain/DeterministicEvaluator"
import { PrismaPolicyRepository } from "@/modules/rule-engine/infrastructure/PrismaPolicyRepository"
import type { PolicyData, RuleAction, RuleCondition } from "@/modules/rule-engine/domain/types"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

const SimulateSchema = z.object({
  scope: ReformScopeSchema,
  condominiumId: z.string().min(1).optional(),
  policyId: z.string().min(1).optional(),
})

function toPolicyData(policy: {
  id: string
  tenantId: string | null
  name: string
  version: number
  active: boolean
  rules: Array<{
    id: string
    name: string
    description: string
    condition: unknown
    action: unknown
    priority: number
    active: boolean
  }>
}): PolicyData {
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
      condition: r.condition as RuleCondition,
      action: r.action as RuleAction,
      priority: r.priority,
      active: r.active,
    })),
  }
}

/**
 * Simula a avaliação determinística de um escopo contra uma política, sem
 * persistir nada. Resolve a política por (em ordem):
 *  - condominiumId → política do condomínio, já com overrides aplicados
 *  - policyId → política específica (do tenant ou global)
 *  - default → política ativa do tenant/global
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const { scope, condominiumId, policyId } = SimulateSchema.parse(await req.json())

    let policyData: PolicyData

    if (condominiumId) {
      const condominium = await prisma.condominium.findUnique({ where: { id: condominiumId } })
      if (!condominium || condominium.tenantId !== user.tenantId) {
        throw new NotFoundError("Condominium", condominiumId)
      }
      policyData = await new PrismaPolicyRepository().resolveForCondominium(condominiumId, user.tenantId)
    } else if (policyId) {
      const policy = await prisma.policy.findUnique({
        where: { id: policyId },
        include: { rules: true },
      })
      if (!policy || (policy.tenantId !== null && policy.tenantId !== user.tenantId)) {
        throw new NotFoundError("Policy", policyId)
      }
      policyData = toPolicyData(policy)
    } else {
      const policy = await prisma.policy.findFirst({
        where: { active: true, OR: [{ tenantId: user.tenantId }, { tenantId: null }] },
        include: { rules: true },
        orderBy: [{ tenantId: "desc" }, { effectiveFrom: "desc" }],
      })
      if (!policy) throw new NotFoundError("Policy", "default")
      policyData = toPolicyData(policy)
    }

    const result = new DeterministicEvaluator().evaluate(scope, policyData)

    return NextResponse.json({
      policy: { id: policyData.id, name: policyData.name, version: policyData.version },
      result,
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
