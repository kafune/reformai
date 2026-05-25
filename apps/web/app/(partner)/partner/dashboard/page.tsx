import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus } from "@reformai/database"
import { TopBar, Card, Eyebrow, Icon, type IconName } from "@/interfaces/components/ui"
import { PendingActionsWidget } from "@/interfaces/components/ui/PendingActionsWidget"

export const dynamic = "force-dynamic"

const ACTIVE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED_TO_PARTNER,
  CaseStatus.ART_RRT_PENDING,
  CaseStatus.INSPECTIONS_SCHEDULED,
  CaseStatus.IN_EXECUTION,
]

const STAT_ICONS: IconName[] = ["check", "clock", "doc", "star"]

export default async function PartnerDashboardPage() {
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
        <TopBar title="Dashboard" subtitle="Painel do parceiro" />
        <div className="p-8">
          <p className="text-sm text-iron-600">
            Perfil de parceiro não encontrado. Contate o administrador.
          </p>
        </div>
      </div>
    )
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [activeCases, inspectionsToday, artPending, concludedThisMonth] = await Promise.all([
    prisma.reformCase.count({
      where: {
        partnerId: partner.id,
        tenantId: user.tenantId,
        status: { in: ACTIVE_STATUSES },
      },
    }),
    prisma.inspection.count({
      where: {
        partnerId: partner.id,
        tenantId: user.tenantId,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
        status: "SCHEDULED",
      },
    }),
    prisma.reformCase.count({
      where: {
        partnerId: partner.id,
        tenantId: user.tenantId,
        status: "ART_RRT_PENDING",
      },
    }),
    prisma.reformCase.count({
      where: {
        partnerId: partner.id,
        tenantId: user.tenantId,
        status: "CONCLUDED",
        updatedAt: { gte: startOfMonth },
      },
    }),
  ])

  const stats = [
    {
      label: "Casos ativos",
      value: activeCases,
      description: "Em execução, agendados ou aguardando ART",
      tone: "green" as const,
      icon: STAT_ICONS[0]!,
    },
    {
      label: "Vistorias hoje",
      value: inspectionsToday,
      description: "Agendadas para hoje",
      tone: "azulejo" as const,
      icon: STAT_ICONS[1]!,
    },
    {
      label: "ART/RRT pendente",
      value: artPending,
      description: "Casos aguardando ART/RRT",
      tone: "ochre" as const,
      icon: STAT_ICONS[2]!,
    },
    {
      label: "Concluídos no mês",
      value: concludedThisMonth,
      description: "Casos encerrados este mês",
      tone: "green" as const,
      icon: STAT_ICONS[3]!,
    },
  ]

  return (
    <div className="flex flex-col">
      <TopBar
        title="Dashboard"
        subtitle={`Bem-vindo, ${user.name}`}
      />

      <div className="flex-1 bg-bone-50 p-8">
        {/* Pending actions inbox */}
        <PendingActionsWidget />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} padded={false} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Eyebrow className="truncate">{s.label}</Eyebrow>
                  <div className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
                    {s.value}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">{s.description}</div>
                </div>
                <Icon
                  name={s.icon}
                  size={18}
                  className={
                    s.tone === "green"
                      ? "text-green-600"
                      : s.tone === "azulejo"
                        ? "text-azulejo-600"
                        : s.tone === "ochre"
                          ? "text-ochre-600"
                          : "text-green-600"
                  }
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
