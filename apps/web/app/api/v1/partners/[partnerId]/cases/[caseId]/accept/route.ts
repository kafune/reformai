import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { PartnerAcceptCaseUseCase } from "@/modules/partner-network/application/PartnerAcceptCaseUseCase"

export async function POST(
  _req: Request,
  ctx: { params: { partnerId: string; caseId: string } },
) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "PARTNER") return forbidden()

    const { partnerId, caseId } = ctx.params

    const sessionPartner = await prisma.partner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!sessionPartner || sessionPartner.id !== partnerId) return forbidden()

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
