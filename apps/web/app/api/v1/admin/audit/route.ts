import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])

/** Trilha de auditoria do tenant, com filtros e paginação por offset. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const sp = req.nextUrl.searchParams
    const action = sp.get("action")?.trim()
    const caseId = sp.get("caseId")?.trim()
    const limit = Math.min(200, Math.max(1, Number(sp.get("limit") ?? "50") || 50))
    const skip = Math.max(0, Number(sp.get("skip") ?? "0") || 0)

    const where: Prisma.AuditLogWhereInput = {
      tenantId: user.tenantId,
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(caseId ? { caseId } : {}),
    }

    const [entries, total, actions] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          action: true,
          triggeredBy: true,
          caseId: true,
          details: true,
          aiReasoning: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
      // Lista distinta de ações para o filtro.
      prisma.auditLog.findMany({
        where: { tenantId: user.tenantId },
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
      }),
    ])

    return NextResponse.json({
      entries,
      total,
      skip,
      limit,
      actions: actions.map((a) => a.action),
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
