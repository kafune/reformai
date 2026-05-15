import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus, RiskLevel } from "@reformai/database"

export const dynamic = "force-dynamic"

type Tab = "active" | "done" | "all"

const ACTIVE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED_TO_PARTNER,
  CaseStatus.ART_RRT_PENDING,
  CaseStatus.INSPECTIONS_SCHEDULED,
  CaseStatus.IN_EXECUTION,
]

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

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "text-green-700 bg-green-100",
  MEDIUM: "text-amber-700 bg-amber-100",
  HIGH: "text-orange-700 bg-orange-100",
  CRITICAL: "text-red-700 bg-red-100",
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—"
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

export default async function PartnerCasesPage({
  searchParams,
}: {
  searchParams?: { tab?: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "PARTNER") redirect("/cases")

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
    select: { id: true, tenantId: true },
  })

  if (!partner) {
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">Perfil de parceiro não encontrado.</p>
      </div>
    )
  }

  const tab: Tab =
    searchParams?.tab === "done" ? "done" : searchParams?.tab === "all" ? "all" : "active"

  const statusFilter =
    tab === "active"
      ? { status: { in: ACTIVE_STATUSES } }
      : tab === "done"
        ? { status: CaseStatus.CONCLUDED }
        : {}

  const cases = await prisma.reformCase.findMany({
    where: {
      partnerId: partner.id,
      tenantId: user.tenantId,
      ...statusFilter,
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

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "active", label: "Ativos" },
    { value: "done", label: "Concluídos" },
    { value: "all", label: "Todos" },
  ]

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">Meus Casos</h1>
        <p className="text-sm text-zinc-500 mt-1">{cases.length} caso(s) encontrado(s)</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={`/partner/cases?tab=${t.value}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.value
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm">Nenhum caso nesta categoria.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Protocolo
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Condomínio · Unidade
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Risco
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Próxima vistoria
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map((c) => {
                const nextInspection = c.inspections[0] ?? null
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-zinc-900">{c.protocol}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.condominium.name} &middot; Un. {c.unit.identifier}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
                        {STATUS_LABELS[c.status as CaseStatus] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.riskLevel ? (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${RISK_COLORS[c.riskLevel as RiskLevel]}`}
                        >
                          {RISK_LABELS[c.riskLevel as RiskLevel] ?? c.riskLevel}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {nextInspection
                        ? `${nextInspection.type} — ${formatDate(nextInspection.scheduledAt)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/partner/cases/${c.id}`}
                        className="text-emerald-700 hover:text-emerald-900 text-xs font-medium underline"
                      >
                        Abrir &rarr;
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
