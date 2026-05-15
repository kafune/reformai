import { CaseStatus, InspectionStatus, InspectionType, type Inspection, type ReformCase } from "@reformai/database"
import type { PolicyEvaluationResult } from "@/modules/rule-engine/domain/types"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"

export interface CanScheduleResult {
  allowed: boolean
  reason?: string
}

export class InspectionRules {
  /**
   * Returns the required inspection types for a given scope and evaluation result.
   * Order is always: INITIAL → (INTERMEDIATE?) → (CRITICAL_SYSTEM?) → FINAL
   */
  static getRequiredInspectionTypes(
    _scope: ReformScope,
    evaluation: PolicyEvaluationResult,
  ): InspectionType[] {
    const types: InspectionType[] = [InspectionType.INITIAL]

    if (evaluation.mandatoryInspection) {
      types.push(InspectionType.INTERMEDIATE)
    }

    if (evaluation.riskLevel === "CRITICAL") {
      types.push(InspectionType.CRITICAL_SYSTEM)
    }

    types.push(InspectionType.FINAL)

    return types
  }

  /**
   * Checks whether a given inspection type can be scheduled for a case.
   * Returns { allowed: true } or { allowed: false, reason: string }.
   *
   * REGRA INBYPASSÁVEL (CLAUDE.md §13 regra 5):
   * Impermeabilização exige vistoria INTERMEDIATE completada antes de FINAL.
   */
  static canScheduleInspection(args: {
    reformCase: ReformCase
    scope: ReformScope | null
    type: InspectionType
    existingInspections: Inspection[]
  }): CanScheduleResult {
    const { reformCase, scope, type, existingInspections } = args
    const status = reformCase.status as CaseStatus

    const postPartnerStatuses: CaseStatus[] = [
      CaseStatus.ASSIGNED_TO_PARTNER,
      CaseStatus.ART_RRT_PENDING,
      CaseStatus.INSPECTIONS_SCHEDULED,
      CaseStatus.IN_EXECUTION,
      CaseStatus.CONCLUDED,
    ]

    switch (type) {
      case InspectionType.INITIAL: {
        const initialAllowedStatuses: string[] = [
          CaseStatus.ASSIGNED_TO_PARTNER,
          CaseStatus.ART_RRT_PENDING,
          CaseStatus.INSPECTIONS_SCHEDULED,
        ]
        const allowed = initialAllowedStatuses.includes(status)
        if (!allowed) {
          return {
            allowed: false,
            reason: `Vistoria INITIAL só pode ser agendada nos estados ASSIGNED_TO_PARTNER, ART_RRT_PENDING ou INSPECTIONS_SCHEDULED. Estado atual: ${status}`,
          }
        }
        return { allowed: true }
      }

      case InspectionType.INTERMEDIATE: {
        const hasCompletedInitial = existingInspections.some(
          (i) => i.type === InspectionType.INITIAL && i.status === InspectionStatus.COMPLETED,
        )
        if (!hasCompletedInitial) {
          return {
            allowed: false,
            reason: "Vistoria INTERMEDIATE exige ao menos uma vistoria INITIAL com status COMPLETED",
          }
        }
        return { allowed: true }
      }

      case InspectionType.FINAL: {
        // REGRA INBYPASSÁVEL: Impermeabilização exige INTERMEDIATE completada antes de FINAL
        if (scope?.services.includes("Impermeabilização")) {
          const hasCompletedIntermediate = existingInspections.some(
            (i) => i.type === InspectionType.INTERMEDIATE && i.status === InspectionStatus.COMPLETED,
          )
          if (!hasCompletedIntermediate) {
            return {
              allowed: false,
              reason:
                "Impermeabilização exige vistoria INTERMEDIATE antes da FINAL",
            }
          }
        }

        // All required INTERMEDIATEs must be completed (or none required)
        const requiredIntermediate = existingInspections.filter(
          (i) => i.type === InspectionType.INTERMEDIATE,
        )
        const allIntermediateCompleted =
          requiredIntermediate.length === 0 ||
          requiredIntermediate.every((i) => i.status === InspectionStatus.COMPLETED)

        if (!allIntermediateCompleted) {
          return {
            allowed: false,
            reason: "Todas as vistorias INTERMEDIATE devem estar COMPLETED antes de agendar a FINAL",
          }
        }

        return { allowed: true }
      }

      case InspectionType.CRITICAL_SYSTEM: {
        if (status !== CaseStatus.IN_EXECUTION) {
          return {
            allowed: false,
            reason: `Vistoria CRITICAL_SYSTEM exige caso no estado IN_EXECUTION. Estado atual: ${status}`,
          }
        }
        return { allowed: true }
      }

      case InspectionType.EXTRA: {
        const isPostPartner = (postPartnerStatuses as string[]).includes(status)
        if (!isPostPartner) {
          return {
            allowed: false,
            reason: `Vistoria EXTRA só pode ser agendada após ASSIGNED_TO_PARTNER. Estado atual: ${status}`,
          }
        }
        return { allowed: true }
      }

      default: {
        return { allowed: false, reason: `Tipo de vistoria desconhecido: ${type}` }
      }
    }
  }
}
