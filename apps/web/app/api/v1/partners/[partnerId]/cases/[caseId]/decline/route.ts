import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
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
    if (user.role !== "PARTNER") return forbidden()

    const { partnerId, caseId } = ctx.params

    const sessionPartner = await prisma.partner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!sessionPartner || sessionPartner.id !== partnerId) return forbidden()

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
