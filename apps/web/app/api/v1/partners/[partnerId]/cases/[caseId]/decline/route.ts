import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PartnerDeclineCaseUseCase } from "@/modules/partner-network/application/PartnerDeclineCaseUseCase"

const DeclineBodySchema = z.object({
  reason: z.string().min(5, "Motivo deve ter pelo menos 5 caracteres"),
})

export async function POST(
  req: NextRequest,
  ctx: { params: { partnerId: string; caseId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { partnerId, caseId } = ctx.params

    const body = DeclineBodySchema.parse(await req.json())

    const useCase = new PartnerDeclineCaseUseCase()
    const updatedCase = await useCase.execute({
      caseId,
      partnerId,
      tenantId: user.tenantId,
      triggeredBy: `user:${user.id}`,
      reason: body.reason,
    })

    return NextResponse.json({ case: updatedCase })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
