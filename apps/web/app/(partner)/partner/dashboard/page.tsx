import { redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus } from "@reformai/database"

export const dynamic = "force-dynamic"

const ACTIVE_STATUSES: CaseStatus[] = [
  CaseStatus.ASSIGNED_TO_PARTNER,
  CaseStatus.ART_RRT_PENDING,
  CaseStatus.INSPECTIONS_SCHEDULED,
  CaseStatus.IN_EXECUTION,
]

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
      <div className="p-8">
        <p className="text-red-600 text-sm">Perfil de parceiro não encontrado. Contate o administrador.</p>
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

  const cards = [
    {
      label: "Casos ativos",
      value: activeCases,
      description: "Em execução, agendados ou aguardando ART",
      color: "bg-blue-50 border-blue-200",
      textColor: "text-blue-700",
    },
    {
      label: "Vistorias hoje",
      value: inspectionsToday,
      description: "Agendadas para hoje",
      color: inspectionsToday > 0 ? "bg-amber-50 border-amber-300" : "bg-white border-slate-200",
      textColor: inspectionsToday > 0 ? "text-amber-700" : "text-zinc-900",
    },
    {
      label: "ART/RRT pendente",
      value: artPending,
      description: "Casos aguardando ART/RRT",
      color: artPending > 0 ? "bg-orange-50 border-orange-300" : "bg-white border-slate-200",
      textColor: artPending > 0 ? "text-orange-700" : "text-zinc-900",
    },
    {
      label: "Concluídos no mês",
      value: concludedThisMonth,
      description: "Casos encerrados este mês",
      color: "bg-green-50 border-green-200",
      textColor: "text-green-700",
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-500 mt-1">Bem-vindo, {user.name}</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`border rounded-lg p-5 ${card.color}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.textColor}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
