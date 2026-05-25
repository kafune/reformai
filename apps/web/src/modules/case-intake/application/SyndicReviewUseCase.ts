/**
 * SyndicReviewUseCase
 *
 * Permite ao síndico (role CONDOMINIUM) aprovar ou recusar uma reforma
 * que está no estado AWAITING_SYNDIC_APPROVAL.
 *
 * - Aprovação → transição para AWAITING_DOCUMENTS
 * - Rejeição  → transição para ARCHIVED (reason obrigatório, mín 10 chars)
 *
 * Regras de autorização:
 *   - O usuário deve ter role CONDOMINIUM
 *   - O user.condominiumId deve ser igual ao caso.condominiumId
 *
 * Toda ação grava CaseTransitionLog + AuditLog e dispara notificação ao morador.
 */

import { prisma } from "@/infrastructure/database/prisma"
import {
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/DomainError"
import { CaseStateMachine } from "../domain/entities/CaseStateMachine"
import { getCaseNotificationService } from "./CaseNotificationService"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApproveParams {
  caseId: string
  syndicId: string   // user.id com role CONDOMINIUM
  tenantId: string
  comment?: string
}

export interface RejectParams {
  caseId: string
  syndicId: string
  tenantId: string
  reason: string     // obrigatório, mínimo 10 chars
}

// ---------------------------------------------------------------------------
// Use Case
// ---------------------------------------------------------------------------

export class SyndicReviewUseCase {
  /**
   * Síndico aprova a reforma → AWAITING_DOCUMENTS.
   */
  async approve(params: ApproveParams): Promise<void> {
    const { caseId, syndicId, tenantId, comment } = params

    const { reformCase, syndic } = await this.loadAndValidate(caseId, syndicId, tenantId)

    const sm = new CaseStateMachine(reformCase.status, reformCase.riskLevel ?? null)
    const newStatus = sm.transition("AWAITING_DOCUMENTS", {
      triggeredBy: `user:${syndicId}`,
      previousStatus: reformCase.status,
      reason: comment ?? "Aprovado pelo síndico",
    })

    await prisma.$transaction([
      prisma.reformCase.update({
        where: { id: caseId },
        data: { status: newStatus },
      }),
      prisma.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: newStatus,
          triggeredBy: `user:${syndicId}`,
          reason: comment ?? "Aprovado pelo síndico",
          metadata: { syndicName: syndic.name },
        },
      }),
      prisma.auditLog.create({
        data: {
          tenantId,
          caseId,
          userId: syndicId,
          action: "case.syndic.approved",
          triggeredBy: `user:${syndicId}`,
          details: {
            fromStatus: reformCase.status,
            toStatus: newStatus,
            comment: comment ?? null,
          },
        },
      }),
    ])

    // Notificação ao morador — fire-and-forget
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

  /**
   * Síndico recusa a reforma → ARCHIVED.
   */
  async reject(params: RejectParams): Promise<void> {
    const { caseId, syndicId, tenantId, reason } = params

    if (!reason || reason.trim().length < 10) {
      throw new ValidationError("O motivo da recusa deve ter no mínimo 10 caracteres")
    }

    const { reformCase, syndic } = await this.loadAndValidate(caseId, syndicId, tenantId)

    const sm = new CaseStateMachine(reformCase.status, reformCase.riskLevel ?? null)
    const newStatus = sm.transition("ARCHIVED", {
      triggeredBy: `user:${syndicId}`,
      previousStatus: reformCase.status,
      reason: reason.trim(),
    })

    await prisma.$transaction([
      prisma.reformCase.update({
        where: { id: caseId },
        data: { status: newStatus },
      }),
      prisma.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: newStatus,
          triggeredBy: `user:${syndicId}`,
          reason: reason.trim(),
          metadata: { syndicName: syndic.name },
        },
      }),
      prisma.auditLog.create({
        data: {
          tenantId,
          caseId,
          userId: syndicId,
          action: "case.syndic.rejected",
          triggeredBy: `user:${syndicId}`,
          details: {
            fromStatus: reformCase.status,
            toStatus: newStatus,
            reason: reason.trim(),
          },
        },
      }),
    ])

    // Notificação ao morador — fire-and-forget
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

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Carrega e valida o caso e o síndico.
   * Lança erros de domínio se alguma restrição for violada.
   */
  private async loadAndValidate(caseId: string, syndicId: string, tenantId: string) {
    const [reformCase, syndic] = await Promise.all([
      prisma.reformCase.findFirst({
        where: { id: caseId, tenantId },
      }),
      prisma.user.findUnique({
        where: { id: syndicId },
        select: { id: true, role: true, condominiumId: true, name: true, tenantId: true },
      }),
    ])

    if (!reformCase) throw new NotFoundError("ReformCase", caseId)
    if (!syndic) throw new NotFoundError("User", syndicId)

    // Verificar role
    if (syndic.role !== "CONDOMINIUM") {
      throw new ForbiddenError("Apenas o síndico pode aprovar ou recusar reformas")
    }

    // Verificar que o síndico pertence ao condomínio do caso
    if (syndic.condominiumId !== reformCase.condominiumId) {
      throw new ForbiddenError(
        "O síndico não pertence ao condomínio deste caso",
      )
    }

    // Verificar que o caso está no estado correto
    if (reformCase.status !== "AWAITING_SYNDIC_APPROVAL") {
      // CaseStateMachine vai lançar InvalidTransitionError, mas verificamos
      // explicitamente para dar mensagem clara
      throw new InvalidTransitionError(reformCase.status, "AWAITING_DOCUMENTS / ARCHIVED")
    }

    return { reformCase, syndic }
  }
}
