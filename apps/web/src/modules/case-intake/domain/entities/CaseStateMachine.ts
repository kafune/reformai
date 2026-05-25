import { CaseStatus, RiskLevel } from "@reformai/database"
import { BusinessRuleViolationError, InvalidTransitionError } from "@/shared/errors/DomainError"

const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ["AWAITING_SCOPE_DETAILS"],
  AWAITING_SCOPE_DETAILS: ["SCOPE_CLASSIFIED", "HUMAN_REVIEW_REQUIRED"],
  SCOPE_CLASSIFIED: [
    "AWAITING_SYNDIC_APPROVAL",
    "AWAITING_DOCUMENTS",
    "COMMERCIAL_OFFER_SENT",
    "ELIGIBLE_FOR_RELEASE",
    "HUMAN_REVIEW_REQUIRED",
  ],
  AWAITING_SYNDIC_APPROVAL: [
    "AWAITING_DOCUMENTS", // síndico aprova
    "ARCHIVED",           // síndico recusa
  ],
  AWAITING_DOCUMENTS: ["DOCUMENTS_UNDER_REVIEW"],
  DOCUMENTS_UNDER_REVIEW: [
    "ELIGIBLE_FOR_RELEASE",
    "RELEASED_WITH_CONDITIONS",
    "PENDING_CORRECTIONS",
    "HUMAN_REVIEW_REQUIRED",
  ],
  PENDING_CORRECTIONS: ["DOCUMENTS_UNDER_REVIEW", "HUMAN_REVIEW_REQUIRED"],
  ELIGIBLE_FOR_RELEASE: ["CONCLUDED", "ASSIGNED_TO_PARTNER"],
  RELEASED_WITH_CONDITIONS: ["ASSIGNED_TO_PARTNER"],
  HUMAN_REVIEW_REQUIRED: [
    "ELIGIBLE_FOR_RELEASE",
    "RELEASED_WITH_CONDITIONS",
    "PENDING_CORRECTIONS",
    "ARCHIVED",
  ],
  COMMERCIAL_OFFER_SENT: ["AWAITING_PAYMENT", "ARCHIVED"],
  AWAITING_PAYMENT: ["ASSIGNED_TO_PARTNER"],
  ASSIGNED_TO_PARTNER: ["ART_RRT_PENDING", "COMMERCIAL_OFFER_SENT"],
  ART_RRT_PENDING: ["INSPECTIONS_SCHEDULED"],
  INSPECTIONS_SCHEDULED: ["IN_EXECUTION"],
  IN_EXECUTION: ["CONCLUDED"],
  CONCLUDED: [],
  ARCHIVED: [],
}

export interface TransitionContext {
  previousStatus?: CaseStatus | null
  triggeredBy: string
  reason?: string
}

export class CaseStateMachine {
  constructor(
    private readonly current: CaseStatus,
    private readonly riskLevel: RiskLevel | null,
  ) {}

  static validTransitionsFrom(status: CaseStatus): readonly CaseStatus[] {
    return VALID_TRANSITIONS[status]
  }

  canTransition(to: CaseStatus): boolean {
    return VALID_TRANSITIONS[this.current].includes(to)
  }

  transition(to: CaseStatus, ctx: TransitionContext): CaseStatus {
    if (!this.canTransition(to)) {
      throw new InvalidTransitionError(this.current, to)
    }
    this.assertBusinessRules(to, ctx)
    return to
  }

  private assertBusinessRules(to: CaseStatus, ctx: TransitionContext) {
    const isHighRisk = this.riskLevel === "HIGH" || this.riskLevel === "CRITICAL"
    if (
      to === "ELIGIBLE_FOR_RELEASE" &&
      isHighRisk &&
      ctx.previousStatus !== "HUMAN_REVIEW_REQUIRED"
    ) {
      throw new BusinessRuleViolationError(
        "Casos HIGH/CRITICAL exigem HUMAN_REVIEW_REQUIRED antes de ELIGIBLE_FOR_RELEASE",
      )
    }
  }
}
