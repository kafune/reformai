import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
})

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    const { endpoint, keys } = SubscribeSchema.parse(await req.json())
    const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null

    // endpoint é único: upsert reata a assinatura ao usuário atual.
    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
