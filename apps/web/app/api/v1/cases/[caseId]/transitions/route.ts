import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { GetCaseTransitionsUseCase } from "@/modules/case-intake/application/GetCaseTransitionsUseCase"

/**
 * GET /api/v1/cases/:caseId/transitions
 *
 * Histórico real de transições de estado do caso (CaseTransitionLog), com o
 * ator sanitizado (sem vazar IDs). Usado pela timeline do morador.
 */
export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    await assertCaseAccess(user, ctx.params.caseId)

    const useCase = new GetCaseTransitionsUseCase()
    const transitions = await useCase.execute({
      caseId: ctx.params.caseId,
      tenantId: user.tenantId,
      currentUserId: user.id,
    })

    return NextResponse.json({ transitions })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
