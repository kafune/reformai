import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { ScheduleInspectionForm } from "./ScheduleInspectionForm"
import { RescheduleButton } from "./RescheduleButton"

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

function formatDate(date: Date | null | undefined): string {
  if (!date) return "—"
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
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

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header>
        <Link href={`/partner/cases/${params.caseId}`} className="text-sm text-slate-500 underline">
          &larr; Caso {reformCase.protocol}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-2">Vistorias</h1>
        <p className="text-sm text-zinc-500 mt-1">{inspections.length} vistoria(s) registrada(s)</p>
      </header>

      {/* Schedule new inspection */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Agendar nova vistoria</h2>
        <ScheduleInspectionForm caseId={params.caseId} />
      </section>

      {/* Inspections list */}
      {inspections.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-400 text-sm">Nenhuma vistoria agendada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((insp) => (
            <div
              key={insp.id}
              className="bg-white border border-slate-200 rounded-lg p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium text-zinc-900">
                  {INSPECTION_TYPE_LABELS[insp.type] ?? insp.type}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    insp.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : insp.status === "CANCELLED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {INSPECTION_STATUS_LABELS[insp.status] ?? insp.status}
                </span>
                <span className="text-sm text-slate-500">{formatDate(insp.scheduledAt)}</span>
              </div>

              {insp.notes && (
                <p className="text-sm text-slate-600 line-clamp-2">{insp.notes}</p>
              )}

              {insp.status === "SCHEDULED" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Link
                    href={`/partner/cases/${params.caseId}/inspections/${insp.id}/complete`}
                    className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800"
                  >
                    Registrar conclusão &rarr;
                  </Link>
                  <RescheduleButton
                    caseId={params.caseId}
                    inspectionId={insp.id}
                    currentScheduledAt={insp.scheduledAt?.toISOString() ?? ""}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
