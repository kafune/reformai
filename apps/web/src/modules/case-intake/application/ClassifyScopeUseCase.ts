import { CaseStateMachine } from "../domain/entities/CaseStateMachine"
import { NotFoundError } from "@/shared/errors/DomainError"
import { ReformScopeSchema, type ReformScope } from "@/shared/schemas/ReformScopeSchema"
import { logger } from "@/shared/logger"
import { DeterministicEvaluator } from "@/modules/rule-engine/domain/DeterministicEvaluator"
import { PrismaPolicyRepository } from "@/modules/rule-engine/infrastructure/PrismaPolicyRepository"
import type { ReformCaseRepository } from "../domain/repositories/ReformCaseRepository"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import { getCaseNotificationService } from "./CaseNotificationService"
import { prisma } from "@/infrastructure/database/prisma"

export interface ClassifyScopeRequest {
  caseId: string
  tenantId: string
  triggeredBy: string
  rawScope: unknown
}

export interface ClassifyScopeResponse {
  scope: ReformScope
  evaluation: PolicyEvaluationResult
}

export class ClassifyScopeUseCase {
  constructor(
    private readonly cases: ReformCaseRepository,
    private readonly policies = new PrismaPolicyRepository(),
    private readonly evaluator = new DeterministicEvaluator(),
  ) {}

  async execute(req: ClassifyScopeRequest): Promise<ClassifyScopeResponse> {
    const scope = ReformScopeSchema.parse(req.rawScope)

    const existing = await this.cases.findById(req.caseId, req.tenantId)
    if (!existing) throw new NotFoundError("ReformCase", req.caseId)

    const policy = await this.policies.resolveForCondominium(existing.condominiumId, req.tenantId)
    const evaluation = this.evaluator.evaluate(scope, policy)

    // Verifica se o condomínio exige aprovação do síndico
    const condominium = await prisma.condominium.findUnique({
      where: { id: existing.condominiumId },
      select: { requiresSyndicApproval: true },
    })

    // Se exige aprovação do síndico e o destino seria AWAITING_DOCUMENTS, desvia para aprovação
    const targetStatus =
      condominium?.requiresSyndicApproval &&
      evaluation.recommendedStatus === "AWAITING_DOCUMENTS"
        ? ("AWAITING_SYNDIC_APPROVAL" as const)
        : evaluation.recommendedStatus

    const sm = new CaseStateMachine(existing.status, evaluation.riskLevel)
    const newStatus = sm.transition(targetStatus, {
      triggeredBy: req.triggeredBy,
      previousStatus: existing.status,
      reason: `Classificação determinística. Score: ${evaluation.triageScore}`,
    })

    await this.cases.applyScopeClassification(req.caseId, req.tenantId, {
      scope,
      evaluationResult: evaluation,
      riskLevel: evaluation.riskLevel,
      requiresART: evaluation.requiresART,
      triageScore: evaluation.triageScore,
      newStatus,
      previousStatus: existing.status,
      triggeredBy: req.triggeredBy,
      reason: `Regras disparadas: ${evaluation.triggeredRules.map((r) => r.ruleName).join(", ") || "nenhuma"}`,
    })

    logger.info("case.scope.classified", {
      tenantId: req.tenantId,
      caseId: req.caseId,
      riskLevel: evaluation.riskLevel,
      triageScore: evaluation.triageScore,
    })

    // Notificação por e-mail — fire-and-forget, nunca bloqueia
    getCaseNotificationService()
      .onTransition({
        caseId: req.caseId,
        protocol: existing.protocol,
        toStatus: newStatus,
        clientId: existing.clientId,
        tenantId: req.tenantId,
        condominiumId: existing.condominiumId,
      })
      .catch(() => {})

    return { scope, evaluation }
  }
}
