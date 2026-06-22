import { prisma } from "@/infrastructure/database/prisma"
import { computeFunnel, computeApprovalRate, type FunnelStage, type ApprovalRate } from "../domain/funnel"
import { computeAvgDurationPerStatus, type StatusDuration } from "../domain/timePerStatus"

export interface PartnerSla {
  partnerId: string
  name: string
  assignedCases: number
  concludedCases: number
  completedInspections: number
}

export interface DashboardAnalytics {
  funnel: FunnelStage[]
  approval: ApprovalRate
  timePerStatus: StatusDuration[]
  partners: PartnerSla[]
}

/** Monta as métricas analíticas do tenant (funil, aprovação, tempo, SLA). */
export async function getDashboardAnalytics(tenantId: string): Promise<DashboardAnalytics> {
  const [byStatusRaw, transitions, partners] = await Promise.all([
    prisma.reformCase.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { tenantId },
    }),
    prisma.caseTransitionLog.findMany({
      where: { case: { tenantId } },
      select: { caseId: true, toStatus: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.partner.findMany({
      where: { tenantId },
      select: {
        id: true,
        user: { select: { name: true } },
        _count: { select: { cases: true } },
      },
    }),
  ])

  const statusCounts: Record<string, number> = {}
  for (const row of byStatusRaw) statusCounts[row.status] = row._count._all

  const partnerIds = partners.map((p) => p.id)

  const [concludedCaseRows, completedInspectionRows] = await Promise.all([
    prisma.reformCase.groupBy({
      by: ["partnerId"],
      where: { tenantId, partnerId: { in: partnerIds }, status: "CONCLUDED" },
      _count: { id: true },
    }),
    prisma.inspection.groupBy({
      by: ["partnerId"],
      where: { tenantId, partnerId: { in: partnerIds }, status: "COMPLETED" },
      _count: { id: true },
    }),
  ])

  const concludedByPartner = new Map(concludedCaseRows.map((r) => [r.partnerId, r._count.id]))
  const inspectionsByPartner = new Map(completedInspectionRows.map((r) => [r.partnerId, r._count.id]))

  const partnerSla: PartnerSla[] = partners.map((p) => ({
    partnerId: p.id,
    name: p.user.name,
    assignedCases: p._count.cases,
    concludedCases: concludedByPartner.get(p.id) ?? 0,
    completedInspections: inspectionsByPartner.get(p.id) ?? 0,
  }))

  return {
    funnel: computeFunnel(statusCounts),
    approval: computeApprovalRate(statusCounts),
    timePerStatus: computeAvgDurationPerStatus(transitions),
    partners: partnerSla.sort((a, b) => b.assignedCases - a.assignedCases),
  }
}
