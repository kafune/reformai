import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { InspectionType } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaInspectionRepository } from "@/modules/inspection-scheduling/infrastructure/PrismaInspectionRepository"
import { GetCaseInspectionsUseCase } from "@/modules/inspection-scheduling/application/GetCaseInspectionsUseCase"
import { ScheduleInspectionUseCase } from "@/modules/inspection-scheduling/application/ScheduleInspectionUseCase"

const ScheduleBodySchema = z.object({
  type: z.nativeEnum(InspectionType),
  scheduledAt: z.string().datetime(),
  notes: z.string().optional(),
})

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const { caseId } = ctx.params

    const caseRepo = new PrismaReformCaseRepository()
    const reformCase = await caseRepo.findById(caseId, user.tenantId)
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    const repo = new PrismaInspectionRepository()
    const useCase = new GetCaseInspectionsUseCase(repo)
    const inspections = await useCase.execute({ caseId, tenantId: user.tenantId })

    // Omit photoKeys from response — clients use a dedicated endpoint to get signed URLs
    const sanitized = inspections.map(({ photoKeys: _omit, ...rest }) => {
      void _omit
      return rest
    })

    return NextResponse.json({ inspections: sanitized })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const { caseId } = ctx.params

    const body = ScheduleBodySchema.parse(await req.json())

    const repo = new PrismaInspectionRepository()
    const useCase = new ScheduleInspectionUseCase(repo)

    const inspection = await useCase.execute({
      caseId,
      tenantId: user.tenantId,
      type: body.type,
      scheduledAt: new Date(body.scheduledAt),
      notes: body.notes,
      scheduledBy: `user:${user.id}`,
    })

    const { photoKeys: _omit, ...rest } = inspection
    void _omit

    return NextResponse.json(rest, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
