import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CaseStatus } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const QuerySchema = z.object({
  status: z.nativeEnum(CaseStatus).optional(),
})

export async function GET(
  req: NextRequest,
  ctx: { params: { partnerId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { partnerId } = ctx.params

    // Resolve the partner from the authenticated user
    const partner = await prisma.partner.findUnique({
      where: { userId: user.id },
      select: { id: true, tenantId: true },
    })

    if (!partner) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    // Ensure the partnerId in the URL matches the partner of the session user
    if (partner.id !== partnerId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    // Defensive: tenant isolation
    if (partner.tenantId !== user.tenantId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const query = QuerySchema.parse({ status: searchParams.get("status") ?? undefined })

    const cases = await prisma.reformCase.findMany({
      where: {
        partnerId: partner.id,
        tenantId: user.tenantId,
        ...(query.status ? { status: query.status } : {}),
      },
      include: {
        condominium: { select: { name: true } },
        unit: { select: { identifier: true } },
        inspections: {
          where: { status: "SCHEDULED" },
          orderBy: { scheduledAt: "asc" },
          take: 1,
          select: { id: true, type: true, scheduledAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    // Omit sensitive fields (clientId etc.)
    const sanitized = cases.map(({ clientId: _c, reformScope: _rs, evaluationResult: _er, ...rest }) => {
      void _c
      void _rs
      void _er
      return rest
    })

    return NextResponse.json({ cases: sanitized })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
