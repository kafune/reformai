import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { GetPendingActionsUseCase } from "@/modules/case-intake/application/GetPendingActionsUseCase"

export async function GET() {
  try {
    const user = await requireSessionUser()
    const useCase = new GetPendingActionsUseCase()
    const actions = await useCase.execute({
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
      condominiumId: user.condominiumId,
    })
    return NextResponse.json({ actions })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
