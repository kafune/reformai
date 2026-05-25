import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { DocumentUploadZone } from "./components/DocumentUploadZone"
import { DocumentList, type DocumentItem } from "./components/DocumentList"
import {
  TopBar,
  Badge,
  Button,
  Icon,
  Eyebrow,
  StatusChip,
} from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

export default async function CaseDocumentsPage({ params }: { params: { caseId: string } }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  const cases = new PrismaReformCaseRepository()
  const reformCase = await cases.findById(params.caseId, user.tenantId)
  if (!reformCase) notFound()

  const repo = new PrismaDocumentRepository(prisma)
  const docs = await repo.findByCaseId(params.caseId, user.tenantId)
  const initialDocuments: DocumentItem[] = docs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    type: d.type,
    status: d.status,
    uploadedAt: d.uploadedAt.toISOString(),
    version: d.version,
    mimeType: d.mimeType,
  }))

  const processingCount = initialDocuments.filter(
    (d) => d.status === "PENDING" || d.status === "PROCESSING",
  ).length

  return (
    <>
      <TopBar
        breadcrumb={["Minhas reformas", reformCase.protocol, "Documentos"]}
        title={`Documentos · análise da IA`}
        subtitle="Envie um arquivo. A IA extrai, valida e marca o que precisa de correção."
        actions={
          <>
            {processingCount > 0 && (
              <Badge tone="azulejo" dot>
                {processingCount} em análise
              </Badge>
            )}
            <StatusChip status={reformCase.status} />
          </>
        }
      />

      <div className="flex-1 overflow-auto bg-paper px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Left column */}
          <div className="flex flex-col gap-6">
            {/* Drop zone + upload */}
            <DocumentUploadZone caseId={params.caseId} />

            {/* Document list */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Eyebrow>Documentos enviados</Eyebrow>
                <span className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
                  {initialDocuments.length} arquivo{initialDocuments.length !== 1 ? "s" : ""}
                </span>
              </div>
              <DocumentList
                caseId={params.caseId}
                initialDocuments={initialDocuments}
              />
            </div>
          </div>

          {/* Right rail — AI analysis panel */}
          <aside className="self-start">
            {/* AI analysis card */}
            <div className="rounded-md bg-surface p-5 shadow-hair">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-green-900">
                  <Icon name="sparkle" size={16} className="text-green-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    Análise · DocumentAgent
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-caps text-ink-400">
                    {reformCase.protocol}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 rounded-sm bg-bone-50 px-3.5 py-3">
                <Icon name="shield" size={14} className="mt-0.5 shrink-0 text-ink-500" />
                <p className="text-xs leading-relaxed text-ink-500">
                  Extração feita por IA validada por schema Zod.{" "}
                  <strong>A análise é assistiva</strong> — a decisão final é do
                  analista humano, que pode reverter qualquer pendência.
                </p>
              </div>
            </div>

            {/* ART/RRT disclaimer */}
            <div className="mt-3.5 flex items-start gap-2.5 rounded-md bg-violet-100 px-4 py-3.5">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-violet-600" />
              <p className="text-xs leading-relaxed text-violet-600">
                <strong>A plataforma não emite ART/RRT.</strong> A análise
                documental é assistida por IA e revisada por profissional habilitado
                parceiro.
              </p>
            </div>

            {/* Back link */}
            <div className="mt-4">
              <Link href={`/cases/${params.caseId}`}>
                <Button variant="ghost" icon="arrowL" size="sm">
                  Voltar para o caso
                </Button>
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
