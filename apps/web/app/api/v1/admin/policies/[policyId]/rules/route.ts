import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])
const forbidden = (message?: string) =>
  NextResponse.json({ error: "FORBIDDEN", message }, { status: 403 })

const RuleConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["contains", "equals", "is_true", "is_false", "gte", "lte"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
})

const RuleActionSchema = z.object({
  riskDelta: z.number().optional(),
  requiresART: z.boolean().optional(),
  requiresHumanReview: z.boolean().optional(),
  mandatoryInspection: z.boolean().optional(),
})

const RuleSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  condition: RuleConditionSchema,
  action: RuleActionSchema,
  priority: z.number().int(),
  active: z.boolean().optional().default(true),
})

const BodySchema = z.object({
  rules: z.array(RuleSchema),
})

/**
 * Substitui o conjunto de regras de uma política e incrementa sua versão.
 * Políticas de tenant: editáveis por ADMIN/SUPER_ADMIN do tenant.
 * Políticas globais (tenantId null): editáveis apenas por SUPER_ADMIN.
 */
export async function PATCH(req: NextRequest, ctx: { params: { policyId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const { policyId } = ctx.params

    const policy = await prisma.policy.findUnique({ where: { id: policyId } })
    if (!policy) throw new NotFoundError("Policy", policyId)

    if (policy.tenantId === null) {
      if (user.role !== "SUPER_ADMIN") {
        return forbidden("Apenas o Super Admin pode editar políticas globais.")
      }
    } else if (policy.tenantId !== user.tenantId) {
      // Não revela a existência de políticas de outros tenants.
      throw new NotFoundError("Policy", policyId)
    }

    const body = BodySchema.parse(await req.json())

    const updatedPolicy = await prisma.$transaction(async (tx) => {
      await tx.rule.deleteMany({ where: { policyId } })

      await tx.rule.createMany({
        data: body.rules.map((rule) => ({
          policyId,
          name: rule.name,
          description: rule.description,
          condition: rule.condition as Prisma.InputJsonValue,
          action: rule.action as Prisma.InputJsonValue,
          priority: rule.priority,
          active: rule.active ?? true,
        })),
      })

      return tx.policy.update({
        where: { id: policyId },
        data: { version: { increment: 1 } },
        include: { rules: { orderBy: { priority: "asc" } } },
      })
    })

    return NextResponse.json(updatedPolicy)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
