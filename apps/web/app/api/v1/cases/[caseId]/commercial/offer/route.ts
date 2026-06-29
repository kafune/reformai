import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { GetCaseOfferUseCase } from "@/modules/commercial-offers/application/GetCaseOfferUseCase"

/**
 * GET /api/v1/cases/:caseId/commercial/offer
 *
 * Devolve a proposta comercial do caso (reconstruída do AuditLog da cotação)
 * para o morador rever e aceitar. Retorna `{ offer: null }` quando ainda não
 * há proposta para o caso.
 */
export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    await assertCaseAccess(user, ctx.params.caseId)

    const useCase = new GetCaseOfferUseCase()
    const offer = await useCase.execute({
      caseId: ctx.params.caseId,
      tenantId: user.tenantId,
    })

    return NextResponse.json({ offer })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
