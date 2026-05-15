import { NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { AcceptOfferUseCase } from "@/modules/commercial-offers/application/AcceptOfferUseCase"

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(_req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    const caseRepo = new PrismaReformCaseRepository()
    const useCase = new AcceptOfferUseCase(caseRepo)

    const updatedCase = await useCase.execute({
      caseId,
      tenantId: user.tenantId,
      acceptedBy: `user:${user.id}`,
    })

    return NextResponse.json({ case: updatedCase }, { status: 200 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
