import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

/**
 * Fila de revisão do parceiro: casos em HUMAN_REVIEW_REQUIRED dos
 * condomínios em que o parceiro logado é o responsável.
 */
export async function GET() {
  try {
    const user = await requireSessionUser()
    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!partner) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const cases = await prisma.reformCase.findMany({
      where: {
        tenantId: user.tenantId,
        status: "HUMAN_REVIEW_REQUIRED",
        condominium: { partnerId: partner.id },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        protocol: true,
        riskLevel: true,
        triageScore: true,
        requiresART: true,
        reformScope: true,
        evaluationResult: true,
        createdAt: true,
        condominium: { select: { name: true } },
        unit: { select: { identifier: true } },
      },
    })

    return NextResponse.json({ cases })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
