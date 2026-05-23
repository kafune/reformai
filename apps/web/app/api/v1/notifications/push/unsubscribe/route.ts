import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const UnsubscribeSchema = z.object({ endpoint: z.string().url() })

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    const { endpoint } = UnsubscribeSchema.parse(await req.json())

    // Só remove se pertencer ao usuário autenticado.
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
