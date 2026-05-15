import { CaseStatus, InspectionStatus, InspectionType, type Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import { BusinessRuleViolationError, NotFoundError } from "@/shared/errors/DomainError"
import { ReformScopeSchema } from "@/shared/schemas/ReformScopeSchema"
import { InspectionRules } from "../domain/InspectionRules"
import type { InspectionRepository } from "../domain/repositories/InspectionRepository"

interface CompleteInspectionInput {
  inspectionId: string
  caseId: string
  tenantId: string
  notes: string
  photoStorageKeys?: string[]
  completedBy: string
}

export class CompleteInspectionUseCase {
  constructor(private readonly inspectionRepo: InspectionRepository) {}

  async execute(input: CompleteInspectionInput): Promise<Inspection> {
    const { inspectionId, caseId, tenantId, notes, photoStorageKeys, completedBy } = input

    // 1. Fetch inspection with tenant/case validation
    const inspection = await this.inspectionRepo.findById(inspectionId, tenantId)
    if (!inspection || inspection.caseId !== caseId) {
      throw new NotFoundError("Inspection", inspectionId)
    }

    // 2. Must be in SCHEDULED status
    if (inspection.status !== InspectionStatus.SCHEDULED) {
      throw new BusinessRuleViolationError(
        `Vistoria não pode ser completada: status atual é ${inspection.status}`,
      )
    }

    // 3. Fetch the case for potential transition
    const reformCase = await prisma.reformCase.findFirst({ where: { id: caseId, tenantId } })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // 4. Parse scope and evaluation for determining required inspections
    const scopeRaw = reformCase.reformScope
    const scope = scopeRaw ? ReformScopeSchema.safeParse(scopeRaw).data ?? null : null
    const evaluation = (reformCase.evaluationResult as PolicyEvaluationResult | null) ?? null

    // 5. Execute in transaction
    const completed = await prisma.$transaction(async (tx) => {
      // Complete the inspection
      const updated = await tx.inspection.update({
        where: { id: inspectionId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          notes,
          photoKeys: photoStorageKeys ?? [],
        },
      })

      // Get all inspections for this case (including the one just completed)
      const allInspections = await tx.inspection.findMany({
        where: { caseId, tenantId },
      })

      // Replace the inspection we just updated in the list so logic sees COMPLETED status
      const allWithUpdated = allInspections.map((i) =>
        i.id === inspectionId ? updated : i,
      )

      // Check if we should transition the case
      const isFinal = inspection.type === InspectionType.FINAL
      let shouldConclude = false

      if (isFinal && scope && evaluation) {
        const requiredTypes = InspectionRules.getRequiredInspectionTypes(scope, evaluation)
        shouldConclude = requiredTypes.every((requiredType) =>
          allWithUpdated.some(
            (i) => i.type === requiredType && i.status === InspectionStatus.COMPLETED,
          ),
        )
      } else if (isFinal) {
        // No scope/evaluation — check basic: all non-EXTRA inspections are completed
        shouldConclude = allWithUpdated
          .filter((i) => i.type !== InspectionType.EXTRA)
          .every((i) => i.id === inspectionId || i.status === InspectionStatus.COMPLETED)
      }

      if (shouldConclude) {
        const currentStatus = reformCase.status as CaseStatus
        const machine = new CaseStateMachine(currentStatus, reformCase.riskLevel)
        machine.transition(CaseStatus.CONCLUDED, {
          previousStatus: currentStatus,
          triggeredBy: completedBy,
          reason: "Todas as vistorias obrigatórias concluídas",
        })

        await tx.reformCase.update({
          where: { id: caseId },
          data: { status: "CONCLUDED" },
        })

        await tx.caseTransitionLog.create({
          data: {
            caseId,
            fromStatus: currentStatus,
            toStatus: "CONCLUDED",
            triggeredBy: completedBy,
            reason: "Todas as vistorias obrigatórias concluídas",
          },
        })
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          action: "inspection.completed",
          triggeredBy: completedBy,
          details: {
            inspectionId,
            type: inspection.type,
            concluded: shouldConclude,
          } as object,
        },
      })

      return updated
    })

    return completed
  }
}
