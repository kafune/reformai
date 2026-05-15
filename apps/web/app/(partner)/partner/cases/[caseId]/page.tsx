import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStatus, RiskLevel } from "@reformai/database"
import { DocumentViewButton } from "./DocumentViewButton"
import { AcceptDeclineButtons } from "./AcceptDeclineButtons"

export const dynamic = "force-dynamic"

const STATUS_LABELS: Record<CaseStatus, string> = {
  DRAFT: "Rascunho",
  AWAITING_SCOPE_DETAILS: "Aguardando detalhes",
  SCOPE_CLASSIFIED: "Escopo classificado",
  AWAITING_DOCUMENTS: "Aguardando documentos",
  DOCUMENTS_UNDER_REVIEW: "Documentos em revisão",
  PENDING_CORRECTIONS: "Correções pendentes",
  ELIGIBLE_FOR_RELEASE: "Elegível para liberação",
  RELEASED_WITH_CONDITIONS: "Liberado com condições",
  HUMAN_REVIEW_REQUIRED: "Revisão humana exigida",
  COMMERCIAL_OFFER_SENT: "Proposta enviada",
  AWAITING_PAYMENT: "Aguardando pagamento",
  ASSIGNED_TO_PARTNER: "Atribuído ao parceiro",
  ART_RRT_PENDING: "ART/RRT pendente",
  INSPECTIONS_SCHEDULED: "Vistorias agendadas",
  IN_EXECUTION: "Em execução",
  CONCLUDED: "Concluído",
  ARCHIVED: "Arquivado",
}

const RISK_COLORS: Record<RiskLevel, string> = {
  LOW: "text-green-700 bg-green-100",
  MEDIUM: "text-amber-700 bg-amber-100",
  HIGH: "text-orange-700 bg-orange-100",
  CRITICAL: "text-red-700 bg-red-100",
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
}

const REPORT_TYPE_LABELS: Record<string, string> = {
  ANALYSIS: "Análise",
  TECHNICAL_OPINION: "Parecer técnico",
  COMMERCIAL_PROPOSAL: "Proposta comercial",
  SERVICE_ORDER: "Ordem de serviço",
  INSPECTION_SUMMARY: "Resumo de vistoria",
  RELEASE_OPINION: "Parecer de liberação",
  MEMORIAL_DESCRITIVO: "Memorial descritivo",
  CRONOGRAMA: "Cronograma",
}

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

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return String(date)
  }
}

interface ReformScope {
  services?: string[]
  areas?: string[]
  description?: string
}

interface EvaluationResult {
  recommendedStatus?: string
}

export default async function PartnerCaseDetailPage({
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

  const reformCase = await prisma.reformCase.findFirst({
    where: {
      id: params.caseId,
      partnerId: partner.id,
      tenantId: user.tenantId,
    },
    include: {
      condominium: { select: { name: true, address: true, city: true, state: true } },
      unit: { select: { identifier: true } },
      documents: {
        select: {
          id: true,
          fileName: true,
          type: true,
          status: true,
          uploadedAt: true,
          version: true,
          mimeType: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
      reports: {
        select: { id: true, type: true, version: true, generatedAt: true },
        orderBy: { generatedAt: "desc" },
      },
      inspections: {
        select: {
          id: true,
          type: true,
          scheduledAt: true,
          completedAt: true,
          status: true,
          notes: true,
        },
        orderBy: { scheduledAt: "asc" },
      },
      transitions: {
        select: { fromStatus: true, toStatus: true, triggeredBy: true, reason: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!reformCase) notFound()

  const scope = reformCase.reformScope as ReformScope | null
  const evaluation = reformCase.evaluationResult as EvaluationResult | null

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <Link href="/partner/cases" className="text-sm text-slate-500 underline">
          &larr; Meus Casos
        </Link>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold text-zinc-900">{reformCase.protocol}</h1>
          <span className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">
            {STATUS_LABELS[reformCase.status as CaseStatus] ?? reformCase.status}
          </span>
          {reformCase.riskLevel && (
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${RISK_COLORS[reformCase.riskLevel as RiskLevel]}`}
            >
              {RISK_LABELS[reformCase.riskLevel as RiskLevel] ?? reformCase.riskLevel}
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mt-1">
          {reformCase.condominium.name} &middot; Un. {reformCase.unit.identifier}
        </p>
      </header>

      {/* Ações contextuais */}
      {reformCase.status === CaseStatus.ASSIGNED_TO_PARTNER && (
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-blue-800 mb-3">Ação necessária</h2>
          <p className="text-sm text-blue-700 mb-4">
            Este caso foi atribuído a você. Aceite ou recuse para continuar.
          </p>
          <AcceptDeclineButtons partnerId={partner.id} caseId={reformCase.id} />
        </section>
      )}

      {reformCase.status === CaseStatus.ART_RRT_PENDING && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-amber-800 mb-2">ART/RRT pendente</h2>
          <p className="text-sm text-amber-700 mb-3">
            Para iniciar o cronograma de vistorias, agende a primeira vistoria pela aba
            &ldquo;Vistorias&rdquo;. A transição para &ldquo;Vistorias agendadas&rdquo; ocorre
            automaticamente ao agendar.
          </p>
          <Link
            href={`/partner/cases/${reformCase.id}/inspections`}
            className="inline-block rounded bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800"
          >
            Ir para Vistorias &rarr;
          </Link>
        </section>
      )}

      {/* Dados da obra */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Dados da obra</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Condomínio</dt>
            <dd className="font-medium">{reformCase.condominium.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Unidade</dt>
            <dd className="font-medium">{reformCase.unit.identifier}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Endereço</dt>
            <dd className="font-medium">
              {reformCase.condominium.address}, {reformCase.condominium.city} —{" "}
              {reformCase.condominium.state}
            </dd>
          </div>
          {reformCase.triageScore !== null && (
            <div>
              <dt className="text-slate-500">Score de triagem</dt>
              <dd className="font-medium">{reformCase.triageScore}</dd>
            </div>
          )}
          {evaluation?.recommendedStatus && (
            <div>
              <dt className="text-slate-500">Status recomendado</dt>
              <dd className="font-medium">
                {STATUS_LABELS[evaluation.recommendedStatus as CaseStatus] ??
                  evaluation.recommendedStatus}
              </dd>
            </div>
          )}
          {reformCase.requiresART !== null && (
            <div>
              <dt className="text-slate-500">Requer ART/RRT</dt>
              <dd className="font-medium">{reformCase.requiresART ? "Sim" : "Não"}</dd>
            </div>
          )}
        </dl>
        {scope && scope.services && scope.services.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Serviços</p>
            <ul className="flex flex-wrap gap-1">
              {scope.services.map((s) => (
                <li key={s} className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {scope?.description && (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Descrição</p>
            <p className="text-sm text-zinc-700">{scope.description}</p>
          </div>
        )}
      </section>

      {/* Documentos */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">
          Documentos ({reformCase.documents.length})
        </h2>
        {reformCase.documents.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum documento enviado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reformCase.documents.map((doc) => (
              <li key={doc.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">{doc.fileName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {doc.type} &middot; v{doc.version} &middot; {formatDate(doc.uploadedAt)}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    doc.status === "VALID"
                      ? "bg-green-100 text-green-700"
                      : doc.status === "INVALID"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {doc.status}
                </span>
                <DocumentViewButton caseId={reformCase.id} documentId={doc.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Relatórios */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">
          Relatórios ({reformCase.reports.length})
        </h2>
        {reformCase.reports.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum relatório gerado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reformCase.reports.map((report) => (
              <li key={report.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900">
                    {REPORT_TYPE_LABELS[report.type] ?? report.type}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    v{report.version} &middot; {formatDate(report.generatedAt)}
                  </p>
                </div>
                <ReportViewButton caseId={reformCase.id} reportId={report.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vistorias */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-700">
            Vistorias ({reformCase.inspections.length})
          </h2>
          <Link
            href={`/partner/cases/${reformCase.id}/inspections`}
            className="text-xs text-emerald-700 underline hover:text-emerald-900"
          >
            Gerenciar vistorias &rarr;
          </Link>
        </div>
        {reformCase.inspections.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma vistoria registrada.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reformCase.inspections.map((insp) => (
              <li key={insp.id} className="py-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-zinc-800">
                  {INSPECTION_TYPE_LABELS[insp.type] ?? insp.type}
                </span>
                <span className="text-slate-400">{formatDate(insp.scheduledAt)}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs ${
                    insp.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : insp.status === "CANCELLED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {INSPECTION_STATUS_LABELS[insp.status] ?? insp.status}
                </span>
                <Link
                  href={`/partner/cases/${reformCase.id}/inspections`}
                  className="ml-auto text-xs text-slate-500 underline hover:text-slate-700"
                >
                  Detalhes
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Histórico de transições */}
      {reformCase.transitions.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Histórico de status</h2>
          <ul className="space-y-2">
            {reformCase.transitions.map((t, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-2">
                <span className="text-slate-400">{formatDate(t.createdAt)}</span>
                <span>
                  {STATUS_LABELS[t.fromStatus as CaseStatus] ?? t.fromStatus} &rarr;{" "}
                  {STATUS_LABELS[t.toStatus as CaseStatus] ?? t.toStatus}
                </span>
                {t.reason && <span className="text-slate-400">— {t.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// Small client component for opening report signed URL
function ReportViewButton({ caseId, reportId }: { caseId: string; reportId: string }) {
  return <DocumentViewButton caseId={caseId} documentId={reportId} isReport />
}
