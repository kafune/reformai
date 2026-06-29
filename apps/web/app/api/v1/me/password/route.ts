import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { enforceUserRateLimit } from "@/infrastructure/rate-limiter/guards"
import { ChangePasswordUseCase } from "@/modules/identity/application/ChangePasswordUseCase"

const BodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
})

/** POST /api/v1/me/password — troca a senha do próprio usuário. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()

    // Rate-limit por usuário: tentativas de troca de senha são sensíveis.
    const limited = await enforceUserRateLimit(user.id, {
      name: "account:password",
      limit: 5,
      windowSeconds: 300,
    })
    if (limited) return limited

    const body = BodySchema.parse(await req.json())

    await new ChangePasswordUseCase().execute({
      userId: user.id,
      tenantId: user.tenantId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
