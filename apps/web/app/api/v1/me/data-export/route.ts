import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { ExportUserDataUseCase } from "@/modules/identity/application/ExportUserDataUseCase"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/me/data-export — LGPD: direito de acesso/portabilidade.
 * Retorna, como download JSON, todos os dados pessoais e operacionais do
 * próprio usuário autenticado (escopo do seu tenant).
 */
export async function GET() {
  try {
    const user = await requireSessionUser()
    const data = await new ExportUserDataUseCase().execute({
      userId: user.id,
      tenantId: user.tenantId,
    })

    const filename = `reformai-dados-${user.id}.json`
    return new NextResponse(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
