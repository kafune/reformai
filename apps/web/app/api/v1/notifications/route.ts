import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PrismaNotificationRepository } from "@/modules/notifications/infrastructure/PrismaNotificationRepository"

export async function GET() {
  try {
    const user = await requireSessionUser()
    const repo = new PrismaNotificationRepository()
    const notifications = await repo.listForUser(user.id, user.tenantId)
    return NextResponse.json({ notifications })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
