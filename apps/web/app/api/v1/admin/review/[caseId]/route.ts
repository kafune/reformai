import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CaseStatus, Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import { NotFoundError, BusinessRuleViolationError } from "@/shared/errors/DomainError"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])

const BodySchema = z.object({
  decision: z.enum(["approve", "approve_with_conditions", "reject", "request_corrections"]),
  notes: z.string().min(10),
})

const DECISION_STATUS_MAP: Record<string, CaseStatus> = {
  approve: "ELIGIBLE_FOR_RELEASE",
  approve_with_conditions: "RELEASED_WITH_CONDITIONS",
  reject: "ARCHIVED",
  request_corrections: "PENDING_CORRECTIONS",
}

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = BodySchema.parse(await req.json())
    const { caseId } = ctx.params

    // Fetch case with tenant isolation
    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId: user.tenantId },
    })

    if (!reformCase) {
      throw new NotFoundError("ReformCase", caseId)
    }

    if (reformCase.status !== "HUMAN_REVIEW_REQUIRED") {
      throw new BusinessRuleViolationError(
        `Caso deve estar em HUMAN_REVIEW_REQUIRED para revisão humana. Status atual: ${reformCase.status}`,
      )
    }

    const toStatus = DECISION_STATUS_MAP[body.decision]
    if (!toStatus) {
      throw new BusinessRuleViolationError(`Decisão inválida: ${body.decision}`)
    }

    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    const triggeredBy = `reviewer:${user.id}`

    machine.transition(toStatus, {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: body.notes,
    })

    // Persist everything in a transaction
    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: { status: toStatus, updatedAt: new Date() },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus,
          triggeredBy,
          reason: body.notes,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          caseId,
          userId: user.id,
          action: "case.human.review.completed",
          triggeredBy,
          details: { decision: body.decision, notes: body.notes },
          aiReasoning: Prisma.JsonNull,
        },
      })

      return updated
    })

    return NextResponse.json(updatedCase)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
