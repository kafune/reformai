import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus, RiskLevel } from "@reformai/database"

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

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
}

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "text-green-700 bg-green-100",
  MEDIUM: "text-amber-700 bg-amber-100",
  HIGH: "text-orange-700 bg-orange-100",
  CRITICAL: "text-red-700 bg-red-100",
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

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Painel</h1>
        <p className="text-sm text-zinc-500 mt-1">{tenant?.name ?? tenantId}</p>
      </header>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="dashboard-card-total">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total de casos</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{totalCases}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="dashboard-card-month">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Casos no mês</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{casesThisMonth}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="dashboard-card-score">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Score médio</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{avgScore}</p>
        </div>

        {/* Human review queue — highlighted */}
        <div
          className={`border rounded-lg p-5 ${humanReviewQueue > 0 ? "bg-red-50 border-red-300" : "bg-white border-slate-200"}`}
          data-testid="dashboard-card-review-queue"
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${humanReviewQueue > 0 ? "text-red-600" : "text-slate-500"}`}>
            Fila de revisão humana
          </p>
          <div className="flex items-center gap-3 mt-1">
            <p className={`text-3xl font-bold ${humanReviewQueue > 0 ? "text-red-700" : "text-zinc-900"}`}>
              {humanReviewQueue}
            </p>
            {humanReviewQueue > 0 && (
              <Link
                href="/review-queue"
                className="text-xs bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-700"
              >
                Ver fila &rarr;
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Bottom section: status + risk tables */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Cases by status */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Casos por status</h2>
          <ul className="space-y-1">
            {Object.values(CaseStatus)
              .filter((s) => (statusCounts[s] ?? 0) > 0)
              .sort((a, b) => (statusCounts[b] ?? 0) - (statusCounts[a] ?? 0))
              .map((s) => (
                <li key={s} className="flex justify-between text-sm">
                  <span className="text-slate-600">{STATUS_LABELS[s]}</span>
                  <span className="font-medium text-zinc-900">{statusCounts[s]}</span>
                </li>
              ))}
            {Object.values(CaseStatus).every((s) => (statusCounts[s] ?? 0) === 0) && (
              <li className="text-sm text-slate-400">Nenhum caso registrado.</li>
            )}
          </ul>
        </div>

        {/* Cases by risk */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Casos por risco</h2>
          <ul className="space-y-1">
            {Object.values(RiskLevel).map((r) => (
              <li key={r} className="flex justify-between items-center text-sm">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${RISK_COLORS[r]}`}>
                  {RISK_LABELS[r]}
                </span>
                <span className="font-medium text-zinc-900">{riskCounts[r] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
