import { CaseStatus, InspectionType, type Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import { BusinessRuleViolationError, NotFoundError } from "@/shared/errors/DomainError"
import { ReformScopeSchema } from "@/shared/schemas/ReformScopeSchema"
import { InspectionRules } from "../domain/InspectionRules"
import type { InspectionRepository } from "../domain/repositories/InspectionRepository"
import { getCaseNotificationService } from "@/modules/case-intake/application/CaseNotificationService"

interface ScheduleInspectionInput {
  caseId: string
  tenantId: string
  type: InspectionType
  scheduledAt: Date
  notes?: string
  scheduledBy: string
}

export class ScheduleInspectionUseCase {
  constructor(private readonly inspectionRepo: InspectionRepository) {}

  async execute(input: ScheduleInspectionInput): Promise<Inspection> {
    const { caseId, tenantId, type, scheduledAt, notes, scheduledBy } = input

    // 1. Fetch and validate case
    const reformCase = await prisma.reformCase.findFirst({ where: { id: caseId, tenantId } })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // 2. Partner must be assigned before scheduling
    if (!reformCase.partnerId) {
      throw new BusinessRuleViolationError(
        "Não é possível agendar vistoria sem um parceiro atribuído ao caso",
      )
    }

    // 3. Parse scope and evaluation (may be null)
    const scopeRaw = reformCase.reformScope
    const scope = scopeRaw ? ReformScopeSchema.safeParse(scopeRaw).data ?? null : null

    const evaluationRaw = reformCase.evaluationResult as PolicyEvaluationResult | null
    const evaluation = evaluationRaw ?? null

    // 4. List existing inspections for this case
    const existingInspections = await this.inspectionRepo.findByCaseId(caseId, tenantId)

    // 5. Validate business rules via InspectionRules
    const check = InspectionRules.canScheduleInspection({
      reformCase,
      scope,
      type,
      existingInspections,
    })
    if (!check.allowed) {
      throw new BusinessRuleViolationError(check.reason ?? "Agendamento de vistoria não permitido")
    }

    // 6. Calculate extra charge if applicable
    let extraCharge: number | null = null
    if (type === InspectionType.EXTRA || (evaluation && evaluation.riskLevel === "CRITICAL")) {
      if (reformCase.commercialPlanId) {
        const plan = await prisma.commercialPlan.findFirst({
          where: { id: reformCase.commercialPlanId, tenantId },
        })
        if (plan) {
          extraCharge = Number(plan.extraInspectionPrice)
        }
      }
    }

    // 7. Determine if a case status transition is needed
    const currentStatus = reformCase.status as CaseStatus
    const isFirstInspection = existingInspections.length === 0
    let newStatus: CaseStatus | null = null

    if (
      isFirstInspection &&
      (currentStatus === CaseStatus.ASSIGNED_TO_PARTNER ||
        currentStatus === CaseStatus.ART_RRT_PENDING)
    ) {
      newStatus = CaseStatus.INSPECTIONS_SCHEDULED
    } else if (
      currentStatus === CaseStatus.INSPECTIONS_SCHEDULED &&
      type === InspectionType.INITIAL
    ) {
      newStatus = CaseStatus.IN_EXECUTION
    }

    // 8. Validate transition if needed
    if (newStatus) {
      const machine = new CaseStateMachine(currentStatus, reformCase.riskLevel)
      machine.transition(newStatus, {
        previousStatus: currentStatus,
        triggeredBy: scheduledBy,
        reason: `Vistoria ${type} agendada`,
      })
    }

    // 9. Execute in transaction: create inspection + optional case transition + logs
    const inspection = await prisma.$transaction(async (tx) => {
      const created = await tx.inspection.create({
        data: {
          caseId,
          tenantId,
          partnerId: reformCase.partnerId!,
          type: type as never,
          scheduledAt,
          notes,
          status: "SCHEDULED",
          photoKeys: [],
          extraCharge: extraCharge !== null ? extraCharge : undefined,
        },
      })

      if (newStatus) {
        await tx.reformCase.update({
          where: { id: caseId },
          data: { status: newStatus },
        })

        await tx.caseTransitionLog.create({
          data: {
            caseId,
            fromStatus: currentStatus,
            toStatus: newStatus,
            triggeredBy: scheduledBy,
            reason: `Vistoria ${type} agendada`,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          action: "inspection.scheduled",
          triggeredBy: scheduledBy,
          details: {
            inspectionId: created.id,
            type,
            scheduledAt: scheduledAt.toISOString(),
          } as object,
        },
      })

      return created
    })

    // Notificação por e-mail se houve transição de status — fire-and-forget
    if (newStatus) {
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
    }

    return inspection
  }
}
