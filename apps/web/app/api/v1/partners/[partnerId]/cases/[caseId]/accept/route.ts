import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PartnerAcceptCaseUseCase } from "@/modules/partner-network/application/PartnerAcceptCaseUseCase"

export async function POST(
  _req: Request,
  ctx: { params: { partnerId: string; caseId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { partnerId, caseId } = ctx.params

    const useCase = new PartnerAcceptCaseUseCase()
    const updatedCase = await useCase.execute({
      caseId,
      partnerId,
      tenantId: user.tenantId,
      triggeredBy: `user:${user.id}`,
    })

    return NextResponse.json({ case: updatedCase })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
