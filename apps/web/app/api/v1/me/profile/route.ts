import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { UpdateProfileUseCase } from "@/modules/identity/application/UpdateProfileUseCase"

const BodySchema = z.object({
  name: z.string().min(2).max(120),
})

/** PATCH /api/v1/me/profile — atualiza o nome do próprio usuário. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    const body = BodySchema.parse(await req.json())

    const updated = await new UpdateProfileUseCase().execute({
      userId: user.id,
      tenantId: user.tenantId,
      name: body.name,
    })

    return NextResponse.json(updated)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
