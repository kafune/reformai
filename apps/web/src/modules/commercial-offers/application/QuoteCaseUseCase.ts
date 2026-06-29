import type { ReformCase, CommercialPlan } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import {
  NotFoundError,
  BusinessRuleViolationError,
} from "@/shared/errors/DomainError"
import { logger } from "@/shared/logger"
import { calculatePrice, type PriceCalculatorOutput } from "../domain/PriceCalculator"
import type { CommercialAgent, CommercialOfferOutput } from "./CommercialAgent"
import type { PrismaCommercialRepository } from "../infrastructure/PrismaCommercialRepository"
import { getCaseNotificationService } from "@/modules/case-intake/application/CaseNotificationService"

// ---------------------------------------------------------------------------
// I/O types
// ---------------------------------------------------------------------------

export interface QuoteCaseInput {
  caseId: string
  tenantId: string
  planId: string
  extraInspections?: number
  triggeredBy: string
}

export interface QuoteCaseOutput {
  case: ReformCase
  plan: CommercialPlan
  quote: PriceCalculatorOutput
  narrativa: string
  beneficios: string[]
  prazo: string
}

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

export class QuoteCaseUseCase {
  constructor(
    private readonly caseRepo: PrismaReformCaseRepository,
    private readonly commercialRepo: PrismaCommercialRepository,
    private readonly agent: CommercialAgent,
  ) {}

  async execute(input: QuoteCaseInput): Promise<QuoteCaseOutput> {
    const { caseId, tenantId, planId, extraInspections = 0, triggeredBy } = input

    // (a) Busca o caso e verifica status SCOPE_CLASSIFIED
    const reformCase = await this.caseRepo.findById(caseId, tenantId)
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    if (reformCase.status !== "SCOPE_CLASSIFIED") {
      throw new BusinessRuleViolationError(
        `Cotação só é permitida para casos em SCOPE_CLASSIFIED. Status atual: ${reformCase.status}`,
      )
    }

    // (b) Busca o plano comercial pelo id+tenantId
    const plan = await this.commercialRepo.findPlanById(planId, tenantId)
    if (!plan) throw new NotFoundError("CommercialPlan", planId)

    // (c) Calcula preço
    const quote = calculatePrice({
      plan,
      riskLevel: reformCase.riskLevel ?? "LOW",
      mandatoryInspection: reformCase.evaluationResult
        ? !!(reformCase.evaluationResult as Record<string, unknown>).mandatoryInspection
        : false,
      extraInspections,
    })

    // (d) Gera narrativa via CommercialAgent
    let agentOutput: CommercialOfferOutput
    try {
      agentOutput = await this.agent.generateOffer(reformCase, plan, quote)
    } catch (err) {
      logger.warn("commercial.agent.failed", {
        caseId,
        message: (err as Error).message,
      })
      agentOutput = {
        narrativa: `Proposta para o plano ${plan.name}. Total: R$ ${quote.totalPrice.toFixed(2)}.`,
        beneficiosDestacados: ["Acompanhamento técnico especializado"],
        prazo: "Até 2 dias úteis",
      }
    }

    // (e) Transição de status via CaseStateMachine + persiste tudo em $transaction
    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel ?? null)
    const newStatus = machine.transition("COMMERCIAL_OFFER_SENT", {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: `Cotação gerada — plano ${plan.name}`,
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      // Atualiza o caso com commercialPlanId e novo status
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: {
          status: newStatus,
          commercialPlanId: planId,
        },
      })

      // Cria CaseTransitionLog
      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: newStatus,
          triggeredBy,
          reason: `Cotação gerada — plano ${plan.name}`,
        },
      })

      // Cria AuditLog com breakdown de preço
      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          action: "commercial.quote.generated",
          triggeredBy,
          details: {
            planId,
            planName: plan.name,
            quote: {
              basePrice: quote.basePrice,
              riskSurcharge: quote.riskSurcharge,
              inspectionsIncluded: quote.inspectionsIncluded,
              extraInspectionCost: quote.extraInspectionCost,
              totalPrice: quote.totalPrice,
              breakdown: quote.breakdown as unknown as object,
            },
            // Narrativa da oferta — persistida para o morador rever a proposta
            // depois (o GET /commercial/offer reconstrói a partir daqui).
            offer: {
              narrativa: agentOutput.narrativa,
              beneficios: agentOutput.beneficiosDestacados,
              prazo: agentOutput.prazo,
            },
          } as object,
        },
      })

      return updated
    })

    // (f) Notificação por e-mail — fire-and-forget
    getCaseNotificationService()
      .onTransition({
        caseId,
        protocol: reformCase.protocol,
        toStatus: newStatus,
        clientId: reformCase.clientId,
        tenantId,
        condominiumId: reformCase.condominiumId,
      })
      .catch(() => {})

    // (g) Retorna resultado completo
    return {
      case: updatedCase,
      plan,
      quote,
      narrativa: agentOutput.narrativa,
      beneficios: agentOutput.beneficiosDestacados,
      prazo: agentOutput.prazo,
    }
  }
}
