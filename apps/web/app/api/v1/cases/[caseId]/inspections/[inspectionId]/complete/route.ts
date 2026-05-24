import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"

/** Apenas parceiros e gestores podem concluir vistorias. */
const COMPLETE_ROLES = new Set(["PARTNER", "ADMIN", "MANAGER", "SUPER_ADMIN"])
import { PrismaInspectionRepository } from "@/modules/inspection-scheduling/infrastructure/PrismaInspectionRepository"
import { CompleteInspectionUseCase } from "@/modules/inspection-scheduling/application/CompleteInspectionUseCase"

const CompleteBodySchema = z.object({
  notes: z.string().min(5),
  photoStorageKeys: z.array(z.string()).optional(),
})

export async function POST(
  req: NextRequest,
  ctx: { params: { caseId: string; inspectionId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { caseId, inspectionId } = ctx.params

    if (!COMPLETE_ROLES.has(user.role)) return forbidden()

    const body = CompleteBodySchema.parse(await req.json())

    await assertCaseAccess(user, caseId)

    const repo = new PrismaInspectionRepository()
    const useCase = new CompleteInspectionUseCase(repo)

    const inspection = await useCase.execute({
      inspectionId,
      caseId,
      tenantId: user.tenantId,
      notes: body.notes,
      photoStorageKeys: body.photoStorageKeys,
      completedBy: `user:${user.id}`,
    })

    const { photoKeys: _omit, ...rest } = inspection
    void _omit

    return NextResponse.json(rest)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
