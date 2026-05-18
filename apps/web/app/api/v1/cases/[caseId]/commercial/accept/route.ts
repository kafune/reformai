import { NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { AcceptOfferUseCase } from "@/modules/commercial-offers/application/AcceptOfferUseCase"
import { notifyCondominiumManagers } from "@/modules/notifications/application/notifyCase"

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

    // Avisa o síndico que o morador aceitou — aguarda confirmação de pagamento.
    await notifyCondominiumManagers(
      {
        id: updatedCase.id,
        protocol: updatedCase.protocol,
        tenantId: updatedCase.tenantId,
        condominiumId: updatedCase.condominiumId,
        clientId: updatedCase.clientId,
      },
      "Proposta aceita pelo morador",
      `Caso ${updatedCase.protocol}: o morador aceitou a proposta. Confirme o pagamento ao recebê-lo.`,
    )

    return NextResponse.json({ case: updatedCase }, { status: 200 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
