import { NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

/** Lista condomínios de um tenant — usado no formulário de criação de síndico. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") return forbidden()

    const tenantId = req.nextUrl.searchParams.get("tenantId")
    if (!tenantId) {
      return NextResponse.json({ condominiums: [] })
    }

    const condominiums = await prisma.condominium.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    })

    return NextResponse.json({ condominiums })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
