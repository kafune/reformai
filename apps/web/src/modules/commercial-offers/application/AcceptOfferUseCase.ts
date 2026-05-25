import type { ReformCase } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import {
  NotFoundError,
  BusinessRuleViolationError,
} from "@/shared/errors/DomainError"
import { getCaseNotificationService } from "@/modules/case-intake/application/CaseNotificationService"

// ---------------------------------------------------------------------------
// I/O types
// ---------------------------------------------------------------------------

export interface AcceptOfferInput {
  caseId: string
  tenantId: string
  acceptedBy: string
}

// ---------------------------------------------------------------------------
// Use case
// ---------------------------------------------------------------------------

export class AcceptOfferUseCase {
  constructor(private readonly caseRepo: PrismaReformCaseRepository) {}

  async execute(input: AcceptOfferInput): Promise<ReformCase> {
    const { caseId, tenantId, acceptedBy } = input

    // Busca o caso
    const reformCase = await this.caseRepo.findById(caseId, tenantId)
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // Verifica status COMMERCIAL_OFFER_SENT
    if (reformCase.status !== "COMMERCIAL_OFFER_SENT") {
      throw new BusinessRuleViolationError(
        `Aceitação de oferta só é permitida para casos em COMMERCIAL_OFFER_SENT. Status atual: ${reformCase.status}`,
      )
    }

    // Transição para AWAITING_PAYMENT via CaseStateMachine
    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel ?? null)
    const newStatus = machine.transition("AWAITING_PAYMENT", {
      previousStatus: reformCase.status,
      triggeredBy: acceptedBy,
      reason: "Cliente aceitou a proposta comercial",
    })

    // Persiste em $transaction
    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: { status: newStatus },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: newStatus,
          triggeredBy: acceptedBy,
          reason: "Cliente aceitou a proposta comercial",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          userId: acceptedBy.startsWith("user:") ? acceptedBy.slice(5) : undefined,
          action: "commercial.offer.accepted",
          triggeredBy: acceptedBy,
          details: {
            fromStatus: reformCase.status,
            toStatus: newStatus,
          },
        },
      })

      return updated
    })

    // Notificação por e-mail — fire-and-forget
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

    return updatedCase
  }
}
