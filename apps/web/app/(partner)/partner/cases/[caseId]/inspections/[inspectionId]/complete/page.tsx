import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CompleteInspectionForm } from "./CompleteInspectionForm"
import { TopBar, Card, Badge } from "@/interfaces/components/ui"

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
      <div className="flex flex-col">
        <TopBar
          breadcrumb={["Meus Casos", reformCase.protocol, "Vistorias"]}
          title="Registrar conclusão"
        />
        <div className="flex-1 bg-bone-50 p-8 max-w-3xl">
          <Card className="border border-ochre-300 bg-ochre-50">
            <div className="flex items-start gap-3">
              <div>
                <p className="font-semibold text-ochre-800 mb-1">
                  Esta vistoria já foi concluída ou cancelada.
                </p>
                <p className="text-sm text-ochre-700 mb-4">
                  Status atual: <strong>{inspection.status}</strong>
                </p>
                <Link
                  href={`/partner/cases/${params.caseId}/inspections`}
                  className="text-sm text-ochre-900 underline hover:no-underline"
                >
                  ← Voltar para a lista de vistorias
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const scheduledLabel = inspection.scheduledAt
    ? inspection.scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : null

  return (
    <div className="flex flex-col">
      <TopBar
        breadcrumb={[
          "Meus Casos",
          reformCase.protocol,
          "Vistorias",
          "Registrar conclusão",
        ]}
        title="Registrar conclusão de vistoria"
        subtitle={
          `${INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type}` +
          (scheduledLabel ? ` · agendada para ${scheduledLabel}` : "")
        }
      />

      <div className="flex-1 bg-bone-50 p-8">
        <div className="max-w-2xl space-y-6">
          {/* Context header */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="azulejo">
              {INSPECTION_TYPE_LABELS[inspection.type] ?? inspection.type}
            </Badge>
            {scheduledLabel && (
              <span className="font-mono text-xs text-ink-400">{scheduledLabel}</span>
            )}
          </div>

          <Card>
            <CompleteInspectionForm
              caseId={params.caseId}
              inspectionId={params.inspectionId}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
