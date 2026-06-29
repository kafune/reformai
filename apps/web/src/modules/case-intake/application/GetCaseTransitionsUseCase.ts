import type { CaseStatus } from "@reformai/database"
import { prisma } from "@/infrastructure/database/prisma"
import { sanitizeActor } from "./actor-label"

export { sanitizeActor } from "./actor-label"

export interface CaseTransitionView {
  id: string
  fromStatus: CaseStatus
  toStatus: CaseStatus
  /** Ator amigável, sem vazar IDs internos. */
  actor: string
  reason: string | null
  createdAt: string
}

export class GetCaseTransitionsUseCase {
  /**
   * Histórico de transições do caso, em ordem cronológica. O chamador deve ter
   * verificado o acesso ao caso (assertCaseAccess) antes.
   */
  async execute(params: {
    caseId: string
    tenantId: string
    currentUserId: string
  }): Promise<CaseTransitionView[]> {
    const { caseId, tenantId, currentUserId } = params

    const transitions = await prisma.caseTransitionLog.findMany({
      where: { caseId, case: { tenantId } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        triggeredBy: true,
        reason: true,
        createdAt: true,
      },
    })

    return transitions.map((t) => ({
      id: t.id,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      actor: sanitizeActor(t.triggeredBy, currentUserId),
      reason: t.reason ?? null,
      createdAt: t.createdAt.toISOString(),
    }))
  }
}
