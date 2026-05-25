import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { SyndicReviewUseCase } from "@/modules/case-intake/application/SyndicReviewUseCase"

const ApproveBodySchema = z.object({
  comment: z.string().max(1000).optional(),
})

/**
 * POST /api/v1/cases/:caseId/syndic-review/approve
 *
 * Aprova a reforma que está em AWAITING_SYNDIC_APPROVAL → AWAITING_DOCUMENTS.
 * Apenas síndico (CONDOMINIUM) do mesmo condomínio que o caso.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { caseId: string } },
) {
  try {
    const user = await requireSessionUser()

    if (user.role !== "CONDOMINIUM") return forbidden()

    const body = ApproveBodySchema.parse(await req.json())

    const useCase = new SyndicReviewUseCase()
    await useCase.approve({
      caseId: ctx.params.caseId,
      syndicId: user.id,
      tenantId: user.tenantId,
      comment: body.comment,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
