import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { DocumentUploadZoneWrapper } from "./components/DocumentUploadZoneWrapper"
import type { DocumentItem } from "./components/DocumentList"
import {
  TopBar,
  Badge,
  Button,
  Icon,
  StatusChip,
} from "@/interfaces/components/ui"
import { DocumentChecklist } from "./components/DocumentChecklist"
import type { DocStatus, DocumentType } from "@reformai/database"

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
    id:              d.id,
    fileName:        d.fileName,
    type:            d.type,
    status:          d.status,
    uploadedAt:      d.uploadedAt.toISOString(),
    version:         d.version,
    mimeType:        d.mimeType,
    pendencies:      d.pendencies      as Record<string, unknown> | null | undefined,
    extractedData:   d.extractedData   as Record<string, unknown> | null | undefined,
    inconsistencies: d.inconsistencies as Record<string, unknown> | null | undefined,
  }))

  const processingCount = initialDocuments.filter(
    (d) => d.status === "PENDING" || d.status === "PROCESSING",
  ).length

  // Build uploaded-by-type map for the checklist (latest non-INVALID status wins)
  const uploadedByType: Partial<Record<DocumentType, DocStatus>> = {}
  for (const doc of initialDocuments) {
    const existing = uploadedByType[doc.type]
    if (!existing || existing === "INVALID") {
      uploadedByType[doc.type] = doc.status
    }
  }

  // Extract requiresART from evaluationResult JSON
  const evaluationResult = reformCase.evaluationResult as Record<string, unknown> | null
  const requiresART = evaluationResult?.requiresART === true

  const isPendingCorrections = reformCase.status === "PENDING_CORRECTIONS"

  return (
    <>
      <TopBar
        breadcrumb={["Minhas reformas", reformCase.protocol, "Documentos"]}
        title="Documentos · análise da IA"
        subtitle="Envie um arquivo. A IA extrai, valida e marca o que precisa de correção."
        actions={
          <>
            {processingCount > 0 && (
              <Badge tone="azulejo" dot>
                {processingCount} em análise
              </Badge>
            )}
            <StatusChip status={reformCase.status} />
            <Link href={`/cases/${params.caseId}`}>
              <Button variant="ghost" icon="arrowL" size="sm">
                Voltar ao caso
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto bg-paper px-4 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Left column — upload form + document list (client component, shares ref) */}
          <DocumentUploadZoneWrapper
            caseId={params.caseId}
            initialDocuments={initialDocuments}
          />

          {/* Right rail — checklist + AI analysis + disclaimer */}
          <aside className="self-start flex flex-col gap-3.5">
            {/* Dynamic checklist */}
            <DocumentChecklist
              requiresART={requiresART}
              uploadedByType={uploadedByType}
              pendingCorrections={isPendingCorrections}
            />

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
                <Icon name="sparkle" size={14} className="mt-0.5 shrink-0 text-green-700" />
                <p className="text-xs leading-relaxed text-ink-500">
                  Em cada documento, toque em <strong>&ldquo;Análise&rdquo;</strong>{" "}
                  para ver o que a IA leu: dados extraídos, nível de confiança e
                  pontos de atenção. <strong>A análise é assistiva</strong> — a
                  decisão final é do analista humano.
                </p>
              </div>
            </div>

            {/* ART/RRT disclaimer */}
            <div className="flex items-start gap-2.5 rounded-md bg-violet-100 px-4 py-3.5">
              <Icon name="shield" size={16} className="mt-0.5 shrink-0 text-violet-600" />
              <p className="text-xs leading-relaxed text-violet-600">
                <strong>A plataforma não emite ART/RRT.</strong> A análise
                documental é assistida por IA e revisada por profissional habilitado
                parceiro.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
