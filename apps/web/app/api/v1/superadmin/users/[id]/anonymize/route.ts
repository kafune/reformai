import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { AnonymizeUserUseCase } from "@/modules/identity/application/AnonymizeUserUseCase"
import { logger } from "@/shared/logger"

export const dynamic = "force-dynamic"

/**
 * POST /api/v1/superadmin/users/:id/anonymize — LGPD: eliminação a pedido,
 * processada pelo operador via canal de suporte. SUPER_ADMIN apenas.
 * Anonimiza o usuário-alvo dentro do tenant do operador.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const operator = await requireSessionUser()
    if (operator.role !== "SUPER_ADMIN") return forbidden()

    if (ctx.params.id === operator.id) {
      return NextResponse.json(
        { error: "BUSINESS_RULE_VIOLATION", message: "Use a exclusão de conta própria para se anonimizar." },
        { status: 422 },
      )
    }

    const result = await new AnonymizeUserUseCase().execute({
      userId: ctx.params.id,
      tenantId: operator.tenantId,
      triggeredBy: `admin:${operator.id}`,
    })

    logger.info("lgpd.account.anonymized", {
      tenantId: operator.tenantId,
      userId: ctx.params.id,
      initiator: `admin:${operator.id}`,
    })

    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    if ((err as Error).message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "NOT_FOUND", message: "Usuário não encontrado." }, { status: 404 })
    }
    return handleError(err)
  }
}
