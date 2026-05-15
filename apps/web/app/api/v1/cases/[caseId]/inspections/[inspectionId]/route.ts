import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { InspectionStatus } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import {
  BusinessRuleViolationError,
  NotFoundError,
} from "@/shared/errors/DomainError"
import { PrismaInspectionRepository } from "@/modules/inspection-scheduling/infrastructure/PrismaInspectionRepository"

const PatchBodySchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  ctx: { params: { caseId: string; inspectionId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { caseId, inspectionId } = ctx.params

    const body = PatchBodySchema.parse(await req.json())

    const repo = new PrismaInspectionRepository()
    const inspection = await repo.findById(inspectionId, user.tenantId)

    if (!inspection || inspection.caseId !== caseId) {
      throw new NotFoundError("Inspection", inspectionId)
    }

    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new BusinessRuleViolationError(
        `Vistoria não pode ser atualizada: status atual é ${inspection.status}`,
      )
    }

    const updated = await repo.updateScheduled(inspectionId, user.tenantId, {
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      notes: body.notes,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        caseId,
        action: "inspection.updated",
        triggeredBy: `user:${user.id}`,
        details: { inspectionId, patch: body } as object,
      },
    })

    const { photoKeys: _omit, ...rest } = updated
    void _omit

    return NextResponse.json(rest)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
