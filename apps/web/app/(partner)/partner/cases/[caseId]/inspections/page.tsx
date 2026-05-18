import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { ScheduleInspectionForm } from "./ScheduleInspectionForm"
import { RescheduleButton } from "./RescheduleButton"
import {
  TopBar,
  Card,
  Eyebrow,
  Badge,
  Button,
  Icon,
} from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Inicial",
  INTERMEDIATE: "Intermediária",
  FINAL: "Final",
  EXTRA: "Extra",
  CRITICAL_SYSTEM: "Sistema crítico",
}

const INSPECTION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  RESCHEDULED: "Reagendada",
}

const INSPECTION_TONES: Record<string, string> = {
  INITIAL: "azulejo",
  INTERMEDIATE: "azulejo",
  FINAL: "green",
  EXTRA: "ochre",
  CRITICAL_SYSTEM: "iron",
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—"
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
}

function formatDayMonth(date: Date | null | undefined): { day: string; month: string; time: string } {
  if (!date) return { day: "—", month: "", time: "" }
  const d = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).split(" ")
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  return { day: d[0] ?? "—", month: (d[2] ?? d[1] ?? "").toUpperCase(), time }
}

export default async function PartnerInspectionsPage({
  params,
}: {
  params: { caseId: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "PARTNER") redirect("/cases")

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
    select: { id: true, tenantId: true },
  })

  if (!partner) redirect("/partner/cases")

  // Verify the case belongs to this partner + tenant
  const reformCase = await prisma.reformCase.findFirst({
    where: {
      id: params.caseId,
      partnerId: partner.id,
      tenantId: user.tenantId,
    },
    select: { id: true, protocol: true, status: true },
  })

  if (!reformCase) notFound()

  const inspections = await prisma.inspection.findMany({
    where: {
      caseId: params.caseId,
      tenantId: user.tenantId,
      partnerId: partner.id,
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      type: true,
      scheduledAt: true,
      completedAt: true,
      status: true,
      notes: true,
    },
  })

  const scheduled = inspections.filter((i) => i.status === "SCHEDULED")
  const others = inspections.filter((i) => i.status !== "SCHEDULED")

  return (
    <div className="flex flex-col">
      <TopBar
        breadcrumb={["Meus Casos", reformCase.protocol, "Vistorias"]}
        title="Vistorias"
        subtitle={`${inspections.length} vistoria(s) registrada(s)`}
      />

      <div className="flex-1 bg-bone-50 p-4 md:p-8 space-y-6">
        {/* Agendar nova vistoria */}
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-sm bg-green-900 flex items-center justify-center shrink-0">
              <Icon name="plus" size={14} className="text-green-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-900 tracking-snug">
                Agendar nova vistoria
              </h2>
            </div>
          </div>
          <ScheduleInspectionForm caseId={params.caseId} />
        </Card>

        {/* Próximas vistorias */}
        {scheduled.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink-900 tracking-snug">
                Próximas vistorias
              </h2>
              <Eyebrow>{scheduled.length} agendada(s)</Eyebrow>
            </div>

            <div className="space-y-2.5">
              {scheduled.map((insp) => {
                const { day, month, time } = formatDayMonth(insp.scheduledAt)
                const tone = INSPECTION_TONES[insp.type] ?? "azulejo"
                return (
                  <div
                    key={insp.id}
                    className="grid grid-cols-[56px_1fr] gap-3 rounded-sm bg-bone-50 p-3 items-center sm:grid-cols-[60px_1fr_auto] sm:gap-4"
                  >
                    {/* Date block */}
                    <div className="rounded bg-surface text-center py-2 px-1 shadow-hair">
                      <div className="font-mono text-xs text-ink-500">{month}</div>
                      <div className="text-lg font-semibold text-ink-900 leading-tight">{day}</div>
                      <div className="font-mono text-xs text-ink-500">{time}</div>
                    </div>

                    {/* Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: `var(--rai-${tone}-500)` }}
                        />
                        <span
                          className="text-xs font-medium"
                          style={{ color: `var(--rai-${tone}-700)` }}
                        >
                          {INSPECTION_TYPE_LABELS[insp.type] ?? insp.type}
                        </span>
                      </div>
                      {insp.notes && (
                        <p className="text-xs text-ink-500 line-clamp-1">{insp.notes}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-2 flex gap-2 items-center sm:col-span-1 sm:flex-col sm:items-end">
                      <Link
                        href={`/partner/cases/${params.caseId}/inspections/${insp.id}/complete`}
                      >
                        <Button variant="primary" size="sm" iconRight="arrow">
                          Concluir
                        </Button>
                      </Link>
                      <RescheduleButton
                        caseId={params.caseId}
                        inspectionId={insp.id}
                        currentScheduledAt={insp.scheduledAt?.toISOString() ?? ""}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {/* Histórico de vistorias */}
        {others.length > 0 && (
          <Card>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-ink-900 tracking-snug">
                Histórico de vistorias
              </h2>
              <Eyebrow>{others.length} registro(s)</Eyebrow>
            </div>

            <div className="space-y-2.5">
              {others.map((insp) => {
                const statusTone: Record<string, string> = {
                  COMPLETED: "green",
                  CANCELLED: "iron",
                  RESCHEDULED: "ochre",
                }
                const tone = statusTone[insp.status] ?? "neutral"
                return (
                  <div
                    key={insp.id}
                    className="flex flex-wrap items-start gap-3 rounded-sm bg-bone-50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink-900">
                          {INSPECTION_TYPE_LABELS[insp.type] ?? insp.type}
                        </span>
                        <Badge
                          tone={
                            tone === "green"
                              ? "green"
                              : tone === "iron"
                                ? "iron"
                                : tone === "ochre"
                                  ? "ochre"
                                  : "neutral"
                          }
                        >
                          {INSPECTION_STATUS_LABELS[insp.status] ?? insp.status}
                        </Badge>
                        <span className="font-mono text-xs text-ink-400">
                          {formatDate(insp.scheduledAt)}
                        </span>
                      </div>
                      {insp.notes && (
                        <p className="mt-1 text-xs text-ink-500 line-clamp-2">{insp.notes}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {inspections.length === 0 && (
          <Card className="py-12 text-center">
            <Icon name="clock" size={24} className="text-ink-300 mx-auto mb-3" />
            <p className="text-sm text-ink-400">Nenhuma vistoria agendada ainda.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
