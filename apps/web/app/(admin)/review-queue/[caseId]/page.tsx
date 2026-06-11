import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { ReviewDecisionForm } from "@/interfaces/components/review/ReviewDecisionForm"
import { ReviewDocumentList } from "@/interfaces/components/review/ReviewDocumentList"
import {
  AiAnalysisCard,
  extractAiAnalysis,
} from "@/interfaces/components/review/AiAnalysisCard"
import {
  TopBar,
  Eyebrow,
  Badge,
  RiskBadge,
  StatusChip,
  Card,
} from "@/interfaces/components/ui"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])

interface TriggeredRule {
  ruleId: string
  ruleName: string
  reason: string
}

interface EvaluationResult {
  riskLevel?: string
  triageScore?: number
  requiresART?: boolean | string
  requiresHumanReview?: boolean
  mandatoryInspection?: boolean
  recommendedStatus?: string
  triggeredRules?: TriggeredRule[]
}

interface ReformScope {
  services?: string[]
  areas?: string[]
  description?: string
}

export default async function ReviewCasePage({ params }: { params: { caseId: string } }) {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  if (!ADMIN_ROLES.has(user.role)) redirect("/cases")

  const reformCase = await prisma.reformCase.findFirst({
    where: { id: params.caseId, tenantId: user.tenantId },
    include: {
      condominium: { select: { name: true } },
      unit: { select: { identifier: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
      documents: {
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          status: true,
          type: true,
          pendencies: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "desc" },
      },
    },
  })

  if (!reformCase) notFound()

  const scope = reformCase.reformScope as ReformScope | null
  const evaluation = reformCase.evaluationResult as EvaluationResult | null

  // A análise cruzada da IA é gravada no documento processado mais recente
  // (documents já vem ordenado por uploadedAt desc).
  const aiAnalysis = extractAiAnalysis(reformCase.documents)

  return (
    <>
      <TopBar
        breadcrumb={["Fila de Revisão", reformCase.protocol]}
        title={`Revisão — ${reformCase.protocol}`}
        subtitle={`${reformCase.condominium.name} · Un. ${reformCase.unit.identifier}`}
        actions={
          <Link
            href="/review-queue"
            className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-line-strong px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-bone-200"
          >
            ← Voltar
          </Link>
        }
      />

      <div className="flex-1 overflow-auto bg-bone-50 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Hero card */}
          <Card className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:gap-8" padded>
            <div>
              <div className="flex items-center gap-3">
                <Eyebrow>Protocolo</Eyebrow>
                <span className="font-mono text-sm font-medium text-ink-900">
                  {reformCase.protocol}
                </span>
                <span className="h-1 w-1 rounded-full bg-ink-300" />
                <span className="font-mono text-xs text-ink-400">
                  {new Date(reformCase.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-snug text-ink-900">
                {reformCase.condominium.name} · Un.&nbsp;{reformCase.unit.identifier}
              </h2>
            </div>
            <div className="flex flex-col items-end gap-3">
              <StatusChip status={reformCase.status} />
              {reformCase.riskLevel && (
                <RiskBadge
                  level={reformCase.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}
                  score={reformCase.triageScore ?? undefined}
                />
              )}
            </div>
          </Card>

          {/* Case info */}
          <Card padded>
            <h2 className="mb-4 text-sm font-semibold tracking-snug text-ink-900">
              Informações do caso
            </h2>
            <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <Eyebrow className="mb-1">Status</Eyebrow>
                <dd className="font-medium text-ink-900">
                  <StatusChip status={reformCase.status} />
                </dd>
              </div>
              <div>
                <Eyebrow className="mb-1">Nível de risco</Eyebrow>
                <dd>
                  {reformCase.riskLevel ? (
                    <RiskBadge
                      level={reformCase.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"}
                      size="sm"
                    />
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </dd>
              </div>
              <div>
                <Eyebrow className="mb-1">Score de triagem</Eyebrow>
                <dd className="font-mono text-sm font-medium text-ink-900">
                  {reformCase.triageScore ?? "—"}
                </dd>
              </div>
              <div>
                <Eyebrow className="mb-1">Requer ART/RRT</Eyebrow>
                <dd className="font-medium text-ink-900">
                  {reformCase.requiresART === true
                    ? "Sim"
                    : reformCase.requiresART === false
                      ? "Não"
                      : "—"}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Reform scope */}
          {scope && (
            <Card padded>
              <h2 className="mb-4 text-sm font-semibold tracking-snug text-ink-900">
                Escopo da reforma
              </h2>
              {scope.services && scope.services.length > 0 && (
                <div className="mb-4">
                  <Eyebrow className="mb-2">Serviços</Eyebrow>
                  <ul className="flex flex-wrap gap-1.5">
                    {scope.services.map((s) => (
                      <li key={s}>
                        <Badge tone="neutral">{s}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scope.areas && scope.areas.length > 0 && (
                <div className="mb-4">
                  <Eyebrow className="mb-2">Áreas</Eyebrow>
                  <ul className="flex flex-wrap gap-1.5">
                    {scope.areas.map((a) => (
                      <li key={a}>
                        <Badge tone="neutral">{a}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {scope.description && (
                <div>
                  <Eyebrow className="mb-2">Descrição</Eyebrow>
                  <p className="text-sm leading-relaxed text-ink-700">{scope.description}</p>
                </div>
              )}
            </Card>
          )}

          {/* Evaluation result */}
          {evaluation && (
            <Card padded>
              <div className="mb-4 flex items-start justify-between">
                <h2 className="text-sm font-semibold tracking-snug text-ink-900">
                  Resultado da avaliação
                </h2>
                <span className="font-mono text-xs text-ink-400">
                  Rule Engine · determinístico
                </span>
              </div>
              <dl className="mb-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <Eyebrow className="mb-1">Risco</Eyebrow>
                  <dd className="font-medium text-ink-900">{evaluation.riskLevel ?? "—"}</dd>
                </div>
                <div>
                  <Eyebrow className="mb-1">Score</Eyebrow>
                  <dd className="font-mono text-sm font-medium text-ink-900">
                    {evaluation.triageScore ?? "—"}
                  </dd>
                </div>
                <div>
                  <Eyebrow className="mb-1">Status recomendado</Eyebrow>
                  <dd>
                    {evaluation.recommendedStatus ? (
                      <StatusChip status={evaluation.recommendedStatus} />
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </dd>
                </div>
                <div>
                  <Eyebrow className="mb-1">Vistoria obrigatória</Eyebrow>
                  <dd className="font-medium text-ink-900">
                    {evaluation.mandatoryInspection ? "Sim" : "Não"}
                  </dd>
                </div>
              </dl>

              {evaluation.triggeredRules && evaluation.triggeredRules.length > 0 && (
                <div>
                  <Eyebrow className="mb-3">Regras ativadas</Eyebrow>
                  <ul className="flex flex-col gap-2">
                    {evaluation.triggeredRules.map((r) => (
                      <li
                        key={r.ruleId}
                        className="rounded-sm bg-bone-50 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-ink-900">{r.ruleName}</span>
                        {r.reason && (
                          <span className="text-ink-500"> — {r.reason}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Rule engine notice */}
              <div className="mt-4 flex gap-2.5 rounded-sm bg-violet-100 p-3">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="var(--rai-violet-600)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M8 2l5 2v4c0 3.5-5 6-5 6s-5-2.5-5-6V4l5-2z" />
                </svg>
                <p className="text-xs leading-relaxed text-violet-600">
                  Regra de bloqueio: <strong>HIGH/CRITICAL nunca vão para ELIGIBLE_FOR_RELEASE
                  sem passar por HUMAN_REVIEW_REQUIRED.</strong> Essa transição é validada pela{" "}
                  <span className="font-mono">CaseStateMachine</span>.
                </p>
              </div>
            </Card>
          )}

          {/* Chat messages */}
          {reformCase.messages.length > 0 && (
            <Card padded>
              <h2 className="mb-4 text-sm font-semibold tracking-snug text-ink-900">
                Histórico de mensagens de triagem
              </h2>
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {reformCase.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-sm px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "ASSISTANT"
                        ? "border border-azulejo-300 bg-azulejo-100 text-ink-800"
                        : msg.role === "SYSTEM"
                          ? "border border-bone-200 bg-bone-100 text-xs text-ink-500"
                          : "border border-line bg-surface text-ink-900"
                    }`}
                  >
                    <span className="mr-2 font-mono text-xs font-medium uppercase text-ink-400">
                      {msg.role === "ASSISTANT"
                        ? "Sistema"
                        : msg.role === "SYSTEM"
                          ? "Contexto"
                          : "Morador"}
                    </span>
                    {msg.content}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* AI document analysis */}
          {aiAnalysis && <AiAnalysisCard analysis={aiAnalysis} />}

          {/* Documents for review */}
          <Card padded>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-snug text-ink-900">
                Documentos do caso
              </h2>
              <Eyebrow>{reformCase.documents.length} arquivo(s)</Eyebrow>
            </div>
            <ReviewDocumentList
              caseId={reformCase.id}
              documents={reformCase.documents.map(({ id, fileName, mimeType, status, type }) => ({
                id,
                fileName,
                mimeType,
                status,
                type,
              }))}
            />
          </Card>

          {/* Decision form */}
          <Card padded>
            <h2 className="mb-5 text-sm font-semibold tracking-snug text-ink-900">
              Registrar decisão
            </h2>
            <ReviewDecisionForm caseId={reformCase.id} />
          </Card>
        </div>
      </div>
    </>
  )
}
