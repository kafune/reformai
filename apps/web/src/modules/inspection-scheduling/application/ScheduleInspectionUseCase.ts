import { CaseStatus, InspectionType, type Inspection } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import { BusinessRuleViolationError, InvalidTransitionError, NotFoundError } from "@/shared/errors/DomainError"
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

    // 1. Pre-flight: verify case exists and partner is assigned (non-transactional read for fast fail)
    const preflight = await prisma.reformCase.findFirst({ where: { id: caseId, tenantId } })
    if (!preflight) throw new NotFoundError("ReformCase", caseId)

    if (!preflight.partnerId) {
      throw new BusinessRuleViolationError(
        "Não é possível agendar vistoria sem um parceiro atribuído ao caso",
      )
    }

    // 2. Parse scope and evaluation for business-rule checks (based on preflight data which is immutable for these fields)
    const scope = preflight.reformScope
      ? ReformScopeSchema.safeParse(preflight.reformScope).data ?? null
      : null
    const evaluation = (preflight.evaluationResult as PolicyEvaluationResult | null) ?? null

    // 3. List existing inspections for this case
    const existingInspections = await this.inspectionRepo.findByCaseId(caseId, tenantId)

    // 4. Validate business rules via InspectionRules
    const check = InspectionRules.canScheduleInspection({
      reformCase: preflight,
      scope,
      type,
      existingInspections,
    })
    if (!check.allowed) {
      throw new BusinessRuleViolationError(check.reason ?? "Agendamento de vistoria não permitido")
    }

    // 5. Calculate extra charge if applicable
    let extraCharge: number | null = null
    if (type === InspectionType.EXTRA || (evaluation && evaluation.riskLevel === "CRITICAL")) {
      if (preflight.commercialPlanId) {
        const plan = await prisma.commercialPlan.findFirst({
          where: { id: preflight.commercialPlanId, tenantId },
        })
        if (plan) {
          extraCharge = Number(plan.extraInspectionPrice)
        }
      }
    }

    // 6. Execute in transaction: re-fetch case with lock, validate transition, create inspection + logs
    const { inspection, newStatus, protocol, clientId, condominiumId } =
      await prisma.$transaction(async (tx) => {
        // Re-fetch inside transaction so the status we act on is authoritative
        const reformCase = await tx.reformCase.findFirst({ where: { id: caseId, tenantId } })
        if (!reformCase) throw new NotFoundError("ReformCase", caseId)

        const currentStatus = reformCase.status as CaseStatus
        const isFirstInspection = existingInspections.length === 0
        let nextStatus: CaseStatus | null = null

        if (
          isFirstInspection &&
          (currentStatus === CaseStatus.ASSIGNED_TO_PARTNER ||
            currentStatus === CaseStatus.ART_RRT_PENDING)
        ) {
          nextStatus = CaseStatus.INSPECTIONS_SCHEDULED
        } else if (
          currentStatus === CaseStatus.INSPECTIONS_SCHEDULED &&
          type === InspectionType.INITIAL
        ) {
          nextStatus = CaseStatus.IN_EXECUTION
        }

        if (nextStatus) {
          const machine = new CaseStateMachine(currentStatus, reformCase.riskLevel)
          machine.transition(nextStatus, {
            previousStatus: currentStatus,
            triggeredBy: scheduledBy,
            reason: `Vistoria ${type} agendada`,
          })

          const updated = await tx.reformCase.updateMany({
            where: { id: caseId, status: currentStatus },
            data: { status: nextStatus, updatedAt: new Date() },
          })

          if (updated.count === 0) {
            throw new InvalidTransitionError(currentStatus, nextStatus)
          }

          await tx.caseTransitionLog.create({
            data: {
              caseId,
              fromStatus: currentStatus,
              toStatus: nextStatus,
              triggeredBy: scheduledBy,
              reason: `Vistoria ${type} agendada`,
            },
          })
        }

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

        return {
          inspection: created,
          newStatus: nextStatus,
          protocol: reformCase.protocol,
          clientId: reformCase.clientId,
          condominiumId: reformCase.condominiumId,
        }
      })

    // Notificação por e-mail se houve transição de status — fire-and-forget
    if (newStatus) {
      getCaseNotificationService()
        .onTransition({
          caseId,
          protocol,
          toStatus: newStatus,
          clientId,
          tenantId,
          condominiumId,
        })
        .catch(() => {})
    }

    return inspection
  }
}
