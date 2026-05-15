import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getSessionUser } from "@/infrastructure/auth/getSessionUser"
import { prisma } from "@/infrastructure/database/prisma"
import { ReviewDecisionForm } from "./ReviewDecisionForm"

export const dynamic = "force-dynamic"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

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
    },
  })

  if (!reformCase) notFound()

  const scope = reformCase.reformScope as ReformScope | null
  const evaluation = reformCase.evaluationResult as EvaluationResult | null

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <Link href="/review-queue" className="text-sm text-slate-500 underline">
          &larr; Voltar para a fila
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-900 mt-2">
          Revisão &mdash; {reformCase.protocol}
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {reformCase.condominium.name} &middot; Un.&nbsp;{reformCase.unit.identifier}
        </p>
      </header>

      {/* Case info */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Informações do caso</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{reformCase.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Nível de risco</dt>
            <dd className="font-medium">{reformCase.riskLevel ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Score de triagem</dt>
            <dd className="font-medium">{reformCase.triageScore ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Requer ART/RRT</dt>
            <dd className="font-medium">{reformCase.requiresART === true ? "Sim" : reformCase.requiresART === false ? "Não" : "—"}</dd>
          </div>
        </dl>
      </section>

      {/* Reform scope */}
      {scope && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Escopo da reforma</h2>
          {scope.services && scope.services.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Serviços</p>
              <ul className="flex flex-wrap gap-1">
                {scope.services.map((s) => (
                  <li key={s} className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scope.areas && scope.areas.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Áreas</p>
              <ul className="flex flex-wrap gap-1">
                {scope.areas.map((a) => (
                  <li key={a} className="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-700">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {scope.description && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Descrição</p>
              <p className="text-sm text-zinc-700">{scope.description}</p>
            </div>
          )}
        </section>
      )}

      {/* Evaluation result */}
      {evaluation && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Resultado da avaliação</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div>
              <dt className="text-slate-500">Risco</dt>
              <dd className="font-medium">{evaluation.riskLevel ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Score</dt>
              <dd className="font-medium">{evaluation.triageScore ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status recomendado</dt>
              <dd className="font-medium">{evaluation.recommendedStatus ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Vistoria obrigatória</dt>
              <dd className="font-medium">{evaluation.mandatoryInspection ? "Sim" : "Não"}</dd>
            </div>
          </dl>

          {evaluation.triggeredRules && evaluation.triggeredRules.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                Regras ativadas
              </p>
              <ul className="space-y-1">
                {evaluation.triggeredRules.map((r) => (
                  <li key={r.ruleId} className="text-sm bg-slate-50 border border-slate-100 rounded px-3 py-2">
                    <span className="font-medium text-zinc-800">{r.ruleName}</span>
                    {r.reason && <span className="text-slate-500"> — {r.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Chat messages */}
      {reformCase.messages.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-zinc-700 mb-3">Histórico de mensagens de triagem</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {reformCase.messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded px-3 py-2 text-sm ${
                  msg.role === "ASSISTANT"
                    ? "bg-blue-50 border border-blue-100"
                    : msg.role === "SYSTEM"
                      ? "bg-slate-50 border border-slate-100 text-slate-500 text-xs"
                      : "bg-white border border-slate-200"
                }`}
              >
                <span className="font-medium text-xs text-slate-400 uppercase mr-2">
                  {msg.role === "ASSISTANT" ? "Sistema" : msg.role === "SYSTEM" ? "Contexto" : "Morador"}
                </span>
                {msg.content}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decision form */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-zinc-700 mb-4">Registrar decisão</h2>
        <ReviewDecisionForm caseId={reformCase.id} />
      </section>
    </div>
  )
}
