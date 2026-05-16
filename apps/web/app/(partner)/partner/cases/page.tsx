import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus, RiskLevel } from "@reformai/database"
import {
  TopBar,
  Card,
  Eyebrow,
  RiskBadge,
  StatusChip,
} from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

type Tab = "active" | "done" | "all"

const ACTIVE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED_TO_PARTNER,
  CaseStatus.ART_RRT_PENDING,
  CaseStatus.INSPECTIONS_SCHEDULED,
  CaseStatus.IN_EXECUTION,
]

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
      <div className="flex flex-col">
        <TopBar title="Meus Casos" />
        <div className="p-8">
          <p className="text-sm text-iron-600">Perfil de parceiro não encontrado.</p>
        </div>
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

  const INSPECTION_TYPE_LABELS: Record<string, string> = {
    INITIAL: "Inicial",
    INTERMEDIATE: "Intermediária",
    FINAL: "Final",
    EXTRA: "Extra",
    CRITICAL_SYSTEM: "Sistema crítico",
  }

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "active", label: "Ativos" },
    { value: "done", label: "Concluídos" },
    { value: "all", label: "Todos" },
  ]

  return (
    <div className="flex flex-col">
      <TopBar
        title="Meus Casos"
        subtitle={`${cases.length} caso(s) encontrado(s)`}
      />

      <div className="flex-1 bg-bone-50 p-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-divider">
          {tabs.map((t) => (
            <Link
              key={t.value}
              href={`/partner/cases?tab=${t.value}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.value
                  ? "border-green-700 text-green-800"
                  : "border-transparent text-ink-500 hover:text-ink-700 hover:border-line-strong"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {cases.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-sm text-ink-400">Nenhum caso nesta categoria.</p>
          </Card>
        ) : (
          <Card padded={false}>
            {/* Table header */}
            <div className="border-b border-divider px-5 py-3 grid grid-cols-[110px_1fr_150px_165px_150px_60px] gap-3 items-center">
              <Eyebrow>Protocolo</Eyebrow>
              <Eyebrow>Condomínio · Unidade</Eyebrow>
              <Eyebrow>Risco</Eyebrow>
              <Eyebrow>Status</Eyebrow>
              <Eyebrow>Próxima vistoria</Eyebrow>
              <span />
            </div>

            {/* Table rows */}
            {cases.map((c, i) => {
              const nextInspection = c.inspections[0] ?? null
              return (
                <div
                  key={c.id}
                  className={`px-5 py-3.5 grid grid-cols-[110px_1fr_150px_165px_150px_60px] gap-3 items-center transition-colors hover:bg-bone-50 ${
                    i > 0 ? "border-t border-divider" : ""
                  }`}
                >
                  {/* Protocol */}
                  <span className="font-mono text-xs text-ink-500 tracking-wide">
                    {c.protocol}
                  </span>

                  {/* Condo · Unit */}
                  <div>
                    <div className="text-sm font-medium text-ink-900">
                      {c.condominium.name}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      Un. {c.unit.identifier}
                    </div>
                  </div>

                  {/* Risk */}
                  {c.riskLevel ? (
                    <RiskBadge
                      level={c.riskLevel as RiskLevel}
                      score={c.triageScore ?? undefined}
                      size="sm"
                    />
                  ) : (
                    <span className="text-ink-300 text-sm">—</span>
                  )}

                  {/* Status */}
                  <StatusChip status={c.status} />

                  {/* Next inspection */}
                  <span className="font-mono text-xs text-ink-500">
                    {nextInspection
                      ? `${INSPECTION_TYPE_LABELS[nextInspection.type] ?? nextInspection.type} · ${formatDate(nextInspection.scheduledAt)}`
                      : "—"}
                  </span>

                  {/* Action */}
                  <Link
                    href={`/partner/cases/${c.id}`}
                    className="text-xs font-medium text-green-700 hover:text-green-900 transition-colors"
                  >
                    Abrir →
                  </Link>
                </div>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
