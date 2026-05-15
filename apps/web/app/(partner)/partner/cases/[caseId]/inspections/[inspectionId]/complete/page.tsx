import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CompleteInspectionForm } from "./CompleteInspectionForm"

export const dynamic = "force-dynamic"

const INSPECTION_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Inicial",
  INTERMEDIATE: "Intermediária",
  FINAL: "Final",
  EXTRA: "Extra",
  CRITICAL_SYSTEM: "Sistema crítico",
}

export default async function CompleteInspectionPage({
  params,
}: {
  params: { caseId: string; inspectionId: string }
}) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (user.role !== "PARTNER") redirect("/cases")

  const partner = await prisma.partner.findUnique({
    where: { userId: user.id },
    select: { id: true, tenantId: true },
  })

  if (!partner) redirect("/partner/cases")

  // Verify case belongs to this partner + tenant
  const reformCase = await prisma.reformCase.findFirst({
    where: {
      id: params.caseId,
      partnerId: partner.id,
      tenantId: user.tenantId,
    },
    select: { id: true, protocol: true },
  })

  if (!reformCase) notFound()

  // Verify inspection belongs to this case + partner + tenant
  const inspection = await prisma.inspection.findFirst({
    where: {
      id: params.inspectionId,
      caseId: params.caseId,
      tenantId: user.tenantId,
      partnerId: partner.id,
    },
    select: {
      id: true,
      type: true,
      scheduledAt: true,
      status: true,
    },
  })

  if (!inspection) notFound()

  if (inspection.status !== "SCHEDULED") {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-4">
        <Link
          href={`/partner/cases/${params.caseId}/inspections`}
          className="text-sm text-slate-500 underline"
        >
          &larr; Vistorias
        </Link>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <p className="font-medium text-amber-800">Esta vistoria já foi concluída ou cancelada.</p>
          <p className="text-sm text-amber-700 mt-1">
            Status atual: <strong>{inspection.status}</strong>
          </p>
          <Link
            href={`/partner/cases/${params.caseId}/inspections`}
            className="mt-3 inline-block text-sm text-amber-900 underline"
          >
            Voltar para a lista de vistorias
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <header>
        <Link
          href={`/partner/cases/${params.caseId}/inspections`}
          className="text-sm text-slate-500 underline"
        >
          &larr; Vistorias — {reformCase.protocol}
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-2">Registrar conclusão</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Vistoria {INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type}
          {inspection.scheduledAt
            ? ` — ${inspection.scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
            : ""}
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <CompleteInspectionForm
          caseId={params.caseId}
          inspectionId={params.inspectionId}
        />
      </div>
    </div>
  )
}
