import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const { page, limit } = QuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })

    const where = {
      tenantId: user.tenantId,
      status: "HUMAN_REVIEW_REQUIRED" as const,
    }

    const [items, total] = await Promise.all([
      prisma.reformCase.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          protocol: true,
          status: true,
          riskLevel: true,
          triageScore: true,
          createdAt: true,
          reformScope: true,
          evaluationResult: true,
          condominium: { select: { name: true } },
          unit: { select: { identifier: true } },
        },
      }),
      prisma.reformCase.count({ where }),
    ])

    return NextResponse.json({ items, page, limit, total })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
