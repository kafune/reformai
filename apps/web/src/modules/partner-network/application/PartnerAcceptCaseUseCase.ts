import type { ReformCase } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import {
  BusinessRuleViolationError,
  NotFoundError,
} from "@/shared/errors/DomainError"

interface PartnerAcceptCaseInput {
  caseId: string
  partnerId: string
  tenantId: string
  triggeredBy: string
}

export class PartnerAcceptCaseUseCase {
  async execute(input: PartnerAcceptCaseInput): Promise<ReformCase> {
    const { caseId, partnerId, tenantId, triggeredBy } = input

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
        `Caso deve estar em ASSIGNED_TO_PARTNER para aceite. Estado atual: ${reformCase.status}`,
      )
    }

    // Validate transition
    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    machine.transition("ART_RRT_PENDING", {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: "Parceiro aceitou o caso",
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: { status: "ART_RRT_PENDING" },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: "ART_RRT_PENDING",
          triggeredBy,
          reason: "Parceiro aceitou o caso",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          action: "partner.case.accepted",
          triggeredBy,
          details: { partnerId },
        },
      })

      return updated
    })

    return updatedCase as ReformCase
  }
}
