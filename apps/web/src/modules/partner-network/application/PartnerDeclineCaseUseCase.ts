import type { ReformCase } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import {
  BusinessRuleViolationError,
  NotFoundError,
} from "@/shared/errors/DomainError"

interface PartnerDeclineCaseInput {
  caseId: string
  partnerId: string
  tenantId: string
  triggeredBy: string
  reason: string
}

export class PartnerDeclineCaseUseCase {
  async execute(input: PartnerDeclineCaseInput): Promise<ReformCase> {
    const { caseId, partnerId, tenantId, triggeredBy, reason } = input

    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId },
    })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // Verify this partner is the assigned partner
    if (reformCase.partnerId !== partnerId) {
      throw new BusinessRuleViolationError(
        `Parceiro ${partnerId} não está vinculado ao caso ${caseId}`,
      )
    }

    // Verify correct status
    if (reformCase.status !== "ASSIGNED_TO_PARTNER") {
      throw new BusinessRuleViolationError(
        `Caso deve estar em ASSIGNED_TO_PARTNER para recusa. Estado atual: ${reformCase.status}`,
      )
    }

    // Validate transition
    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    machine.transition("COMMERCIAL_OFFER_SENT", {
      previousStatus: reformCase.status,
      triggeredBy,
      reason,
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: {
          status: "COMMERCIAL_OFFER_SENT",
          partnerId: null,
        },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: "COMMERCIAL_OFFER_SENT",
          triggeredBy,
          reason,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          action: "partner.case.declined",
          triggeredBy,
          details: { partnerId, reason },
        },
      })

      return updated
    })

    return updatedCase as ReformCase
  }
}
