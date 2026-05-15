import { NextResponse } from "next/server"
import { CaseStatus, RiskLevel } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

export async function GET() {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const tenantId = user.tenantId

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Run all aggregation queries in parallel
    const [byStatusRaw, byRiskRaw, totalCases, humanReviewQueue, triageScoreAgg, casesThisMonth] =
      await Promise.all([
        prisma.reformCase.groupBy({
          by: ["status"],
          _count: { _all: true },
          where: { tenantId },
        }),
        prisma.reformCase.groupBy({
          by: ["riskLevel"],
          _count: { _all: true },
          where: { tenantId, riskLevel: { not: null } },
        }),
        prisma.reformCase.count({ where: { tenantId } }),
        prisma.reformCase.count({
          where: { tenantId, status: "HUMAN_REVIEW_REQUIRED" },
        }),
        prisma.reformCase.aggregate({
          _avg: { triageScore: true },
          where: { tenantId, triageScore: { not: null } },
        }),
        prisma.reformCase.count({
          where: { tenantId, createdAt: { gte: thirtyDaysAgo } },
        }),
      ])

    // Build byStatus with all statuses (zero-fill missing ones)
    const allStatuses = Object.values(CaseStatus)
    const statusCounts: Record<string, number> = {}
    for (const s of allStatuses) {
      statusCounts[s] = 0
    }
    for (const row of byStatusRaw) {
      statusCounts[row.status] = row._count._all
    }

    // Build byRisk with all levels (zero-fill missing ones)
    const allRisks = Object.values(RiskLevel)
    const riskCounts: Record<string, number> = {}
    for (const r of allRisks) {
      riskCounts[r] = 0
    }
    for (const row of byRiskRaw) {
      if (row.riskLevel) {
        riskCounts[row.riskLevel] = row._count._all
      }
    }

    return NextResponse.json({
      totalCases,
      byStatus: statusCounts,
      byRisk: riskCounts,
      humanReviewQueue,
      averageTriageScore: triageScoreAgg._avg.triageScore ?? 0,
      casesThisMonth,
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
