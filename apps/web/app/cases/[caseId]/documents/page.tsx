import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { DocumentUploadZone } from "./components/DocumentUploadZone"
import { DocumentList, type DocumentItem } from "./components/DocumentList"

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
  }))

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href={`/cases/${params.caseId}`} className="text-sm text-slate-500 underline">← Voltar para o caso</Link>
          <h1 className="text-2xl font-semibold mt-1">Documentos · {reformCase.protocol}</h1>
        </div>
        <div className="text-right text-sm">
          <p><span className="font-medium">Status:</span> {reformCase.status}</p>
        </div>
      </header>

      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-medium text-slate-700 mb-2">Novo documento</h2>
          <DocumentUploadZone caseId={params.caseId} />
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-700 mb-2">Documentos enviados</h2>
          <DocumentList caseId={params.caseId} initialDocuments={initialDocuments} />
        </section>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-900">
          Esta plataforma <strong>não emite ART/RRT</strong>. A análise documental é assistida por IA e revisada por profissional habilitado parceiro.
        </div>
      </div>
    </main>
  )
}
