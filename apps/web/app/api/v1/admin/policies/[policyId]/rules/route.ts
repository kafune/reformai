import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

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

export async function PATCH(req: NextRequest, ctx: { params: { policyId: string } }) {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = BodySchema.parse(await req.json())
    const { policyId } = ctx.params

    const updatedPolicy = await prisma.$transaction(async (tx) => {
      // Fetch policy with tenant isolation
      const policy = await tx.policy.findFirst({
        where: { id: policyId, tenantId: user.tenantId },
      })

      if (!policy) {
        throw new NotFoundError("Policy", policyId)
      }

      // Delete existing rules
      await tx.rule.deleteMany({ where: { policyId } })

      // Create new rules
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

      // Increment policy version
      const updated = await tx.policy.update({
        where: { id: policyId },
        data: { version: { increment: 1 } },
        include: { rules: true },
      })

      return updated
    })

    return NextResponse.json(updatedPolicy)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
