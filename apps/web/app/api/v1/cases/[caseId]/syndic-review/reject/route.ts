import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { SyndicReviewUseCase } from "@/modules/case-intake/application/SyndicReviewUseCase"

const RejectBodySchema = z.object({
  reason: z.string().min(10, "O motivo deve ter no mínimo 10 caracteres").max(2000),
})

/**
 * POST /api/v1/cases/:caseId/syndic-review/reject
 *
 * Recusa a reforma que está em AWAITING_SYNDIC_APPROVAL → ARCHIVED.
 * Apenas síndico (CONDOMINIUM) do mesmo condomínio que o caso.
 * Body: { reason: string } — obrigatório, mín 10 chars.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { caseId: string } },
) {
  try {
    const user = await requireSessionUser()

    if (user.role !== "CONDOMINIUM") return forbidden()

    const body = RejectBodySchema.parse(await req.json())

    const useCase = new SyndicReviewUseCase()
    await useCase.reject({
      caseId: ctx.params.caseId,
      syndicId: user.id,
      tenantId: user.tenantId,
      reason: body.reason,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
