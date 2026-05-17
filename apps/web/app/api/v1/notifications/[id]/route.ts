import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PrismaNotificationRepository } from "@/modules/notifications/infrastructure/PrismaNotificationRepository"

export async function PATCH(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireSessionUser()
    const repo = new PrismaNotificationRepository()
    const updated = await repo.markRead(ctx.params.id, user.id)
    if (!updated) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }
    return NextResponse.json({ notification: updated })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
