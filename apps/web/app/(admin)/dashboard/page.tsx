import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus, RiskLevel } from "@reformai/database"
import { TopBar, Eyebrow, Badge, StatusChip, RiskBadge } from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Rascunho",
  AWAITING_SCOPE_DETAILS: "Aguardando detalhes",
  SCOPE_CLASSIFIED: "Escopo classificado",
  AWAITING_DOCUMENTS: "Aguardando documentos",
  DOCUMENTS_UNDER_REVIEW: "Documentos em revisão",
  PENDING_CORRECTIONS: "Correções pendentes",
  ELIGIBLE_FOR_RELEASE: "Elegível para liberação",
  RELEASED_WITH_CONDITIONS: "Liberado com condições",
  HUMAN_REVIEW_REQUIRED: "Revisão humana exigida",
  COMMERCIAL_OFFER_SENT: "Proposta enviada",
  AWAITING_PAYMENT: "Aguardando pagamento",
  ASSIGNED_TO_PARTNER: "Atribuído ao parceiro",
  ART_RRT_PENDING: "ART/RRT pendente",
  INSPECTIONS_SCHEDULED: "Vistorias agendadas",
  IN_EXECUTION: "Em execução",
  CONCLUDED: "Concluído",
  ARCHIVED: "Arquivado",
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!ADMIN_ROLES.has(user.role)) redirect("/cases")

  const tenantId = user.tenantId
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [tenant, byStatusRaw, byRiskRaw, totalCases, humanReviewQueue, triageScoreAgg, casesThisMonth] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
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
      prisma.reformCase.count({ where: { tenantId, status: "HUMAN_REVIEW_REQUIRED" } }),
      prisma.reformCase.aggregate({
        _avg: { triageScore: true },
        where: { tenantId, triageScore: { not: null } },
      }),
      prisma.reformCase.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    ])

  // Build maps
  const statusCounts: Record<string, number> = {}
  for (const s of Object.values(CaseStatus)) statusCounts[s] = 0
  for (const row of byStatusRaw) statusCounts[row.status] = row._count._all

  const riskCounts: Record<string, number> = {}
  for (const r of Object.values(RiskLevel)) riskCounts[r] = 0
  for (const row of byRiskRaw) {
    if (row.riskLevel) riskCounts[row.riskLevel] = row._count._all
  }

  const avgScore = Math.round(triageScoreAgg._avg.triageScore ?? 0)

  const riskDistribution: Array<{ level: RiskLevel; count: number }> = [
    { level: "LOW", count: riskCounts["LOW"] ?? 0 },
    { level: "MEDIUM", count: riskCounts["MEDIUM"] ?? 0 },
    { level: "HIGH", count: riskCounts["HIGH"] ?? 0 },
    { level: "CRITICAL", count: riskCounts["CRITICAL"] ?? 0 },
  ]

  const totalWithRisk = riskDistribution.reduce((sum, r) => sum + r.count, 0)

  return (
    <>
      <TopBar
        title={`Visão geral · ${tenant?.name ?? tenantId}`}
        subtitle={`${totalCases} casos registrados · ${humanReviewQueue} aguardando revisão humana.`}
        actions={
          <Link
            href="/review-queue"
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-ink-900 px-4 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-bone-50"
          >
            Fila de revisão
          </Link>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-8 py-8">
        {/* Metric cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Total cases */}
          <div
            className="relative overflow-hidden rounded-lg bg-surface p-5 shadow-hair"
            data-testid="dashboard-card-total"
          >
            <Eyebrow>Total de casos</Eyebrow>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
              {totalCases}
            </div>
            <span className="absolute bottom-3.5 right-4 h-2 w-2 rounded-full bg-green-400 opacity-50" />
          </div>

          {/* Cases this month */}
          <div
            className="relative overflow-hidden rounded-lg bg-surface p-5 shadow-hair"
            data-testid="dashboard-card-month"
          >
            <Eyebrow>Casos no mês</Eyebrow>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
              {casesThisMonth}
            </div>
            <span className="absolute bottom-3.5 right-4 h-2 w-2 rounded-full bg-azulejo-500 opacity-50" />
          </div>

          {/* Avg score */}
          <div
            className="relative overflow-hidden rounded-lg bg-surface p-5 shadow-hair"
            data-testid="dashboard-card-score"
          >
            <Eyebrow>Score médio</Eyebrow>
            <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">
              {avgScore}
            </div>
            <span className="absolute bottom-3.5 right-4 h-2 w-2 rounded-full bg-ochre-400 opacity-50" />
          </div>

          {/* Human review queue — highlighted when non-zero */}
          <div
            className={`relative overflow-hidden rounded-lg p-5 shadow-hair ${
              humanReviewQueue > 0
                ? "bg-iron-100 shadow-[inset_0_0_0_1px_theme(colors.iron.300)]"
                : "bg-surface"
            }`}
            data-testid="dashboard-card-review-queue"
          >
            <Eyebrow className={humanReviewQueue > 0 ? "text-iron-600" : ""}>
              Fila de revisão humana
            </Eyebrow>
            <div className="mt-2 flex items-center gap-3">
              <span
                className={`font-mono text-3xl font-semibold tracking-tight tabular-nums ${
                  humanReviewQueue > 0 ? "text-iron-700" : "text-ink-900"
                }`}
              >
                {humanReviewQueue}
              </span>
              {humanReviewQueue > 0 && (
                <Link
                  href="/review-queue"
                  className="rounded-full bg-iron-600 px-3 py-1 text-xs font-medium text-bone-50 hover:bg-iron-700 transition-colors"
                >
                  Ver fila →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Main grid: status table + risk distribution */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Cases by status */}
          <div className="rounded-lg bg-surface shadow-hair">
            <div className="border-b border-divider px-5 py-4">
              <h2 className="text-sm font-semibold tracking-snug text-ink-900">Casos por status</h2>
            </div>
            <ul className="divide-y divide-divider px-5 py-2">
              {Object.values(CaseStatus)
                .filter((s) => (statusCounts[s] ?? 0) > 0)
                .sort((a, b) => (statusCounts[b] ?? 0) - (statusCounts[a] ?? 0))
                .map((s) => (
                  <li key={s} className="flex items-center justify-between py-2.5">
                    <StatusChip status={s} />
                    <span className="font-mono text-sm font-medium text-ink-900">
                      {statusCounts[s]}
                    </span>
                  </li>
                ))}
              {Object.values(CaseStatus).every((s) => (statusCounts[s] ?? 0) === 0) && (
                <li className="py-6 text-center text-sm text-ink-400">
                  Nenhum caso registrado.
                </li>
              )}
            </ul>
          </div>

          {/* Cases by risk */}
          <div className="rounded-lg bg-surface shadow-hair">
            <div className="border-b border-divider px-5 py-4">
              <h2 className="text-sm font-semibold tracking-snug text-ink-900">
                Distribuição por risco
              </h2>
            </div>
            <div className="px-5 pt-4 pb-2">
              {/* Stacked bar */}
              {totalWithRisk > 0 && (
                <div className="mb-5 flex h-3 overflow-hidden rounded-full">
                  {riskDistribution.map(({ level, count }) => {
                    if (!count) return null
                    const pct = (count / totalWithRisk) * 100
                    const bg =
                      level === "LOW"
                        ? "bg-green-500"
                        : level === "MEDIUM"
                          ? "bg-ochre-500"
                          : level === "HIGH"
                            ? "bg-clay-500"
                            : "bg-iron-600"
                    return (
                      <div
                        key={level}
                        className={bg}
                        style={{ width: `${pct}%` }}
                      />
                    )
                  })}
                </div>
              )}
              <ul className="grid grid-cols-2 gap-3">
                {riskDistribution.map(({ level, count }) => (
                  <li key={level} className="flex items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        level === "LOW"
                          ? "bg-green-500"
                          : level === "MEDIUM"
                            ? "bg-ochre-500"
                            : level === "HIGH"
                              ? "bg-clay-500"
                              : "bg-iron-600"
                      }`}
                    />
                    <RiskBadge level={level} size="sm" />
                    <span className="ml-auto font-mono text-sm font-medium text-ink-900">
                      {count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
