import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { AnonymizeUserUseCase } from "@/modules/identity/application/AnonymizeUserUseCase"
import { logger } from "@/shared/logger"

export const dynamic = "force-dynamic"

const BodySchema = z.object({
  // Confirmação explícita exigida — evita exclusão acidental.
  confirm: z.literal(true),
})

/**
 * POST /api/v1/me/account/delete — LGPD: direito de eliminação (auto-serviço).
 *
 * Anonimiza a conta do próprio usuário (preserva casos/auditoria desvinculados
 * de PII). Após a operação a conta fica inativa e o login deixa de funcionar.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    BodySchema.parse(await req.json().catch(() => ({})))

    const result = await new AnonymizeUserUseCase().execute({
      userId: user.id,
      tenantId: user.tenantId,
      triggeredBy: `user:${user.id}`,
    })

    logger.info("lgpd.account.anonymized", {
      tenantId: user.tenantId,
      userId: user.id,
      initiator: "self",
    })

    return NextResponse.json({
      success: true,
      message:
        "Sua conta foi anonimizada. Seus dados pessoais foram removidos; registros legais foram preservados sem identificação. Você será desconectado.",
      unitsAnonymized: result.unitsAnonymized,
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
