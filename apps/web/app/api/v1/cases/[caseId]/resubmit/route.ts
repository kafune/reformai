import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import { NotFoundError, BusinessRuleViolationError } from "@/shared/errors/DomainError"
import {
  notifyCondominiumPartner,
  notifyCondominiumManagers,
  type CaseStakeholderRef,
} from "@/modules/notifications/application/notifyCase"

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"])

/**
 * Reenvia para revisão um caso que estava em PENDING_CORRECTIONS.
 * O morador corrige/anexa os documentos pelo fluxo normal de documentos
 * e então reenvia o caso para que o parceiro revise novamente.
 * Transição: PENDING_CORRECTIONS → HUMAN_REVIEW_REQUIRED.
 */
export async function POST(_req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const { caseId } = ctx.params

    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId: user.tenantId },
    })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // Quem reenvia é o morador dono do caso (admins podem, como apoio).
    const isOwner = reformCase.clientId === user.id
    if (!isOwner && !ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (reformCase.status !== "PENDING_CORRECTIONS") {
      throw new BusinessRuleViolationError(
        `Reenvio exige o caso em PENDING_CORRECTIONS. Status atual: ${reformCase.status}`,
      )
    }

    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    const triggeredBy = `user:${user.id}`
    machine.transition("HUMAN_REVIEW_REQUIRED", {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: "Documentos corrigidos reenviados pelo morador",
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: { status: "HUMAN_REVIEW_REQUIRED", updatedAt: new Date() },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: "HUMAN_REVIEW_REQUIRED",
          triggeredBy,
          reason: "Documentos corrigidos reenviados pelo morador",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          caseId,
          userId: user.id,
          action: "case.corrections.resubmitted",
          triggeredBy,
          details: { fromStatus: reformCase.status, toStatus: "HUMAN_REVIEW_REQUIRED" },
          aiReasoning: Prisma.JsonNull,
        },
      })

      return updated
    })

    const ref: CaseStakeholderRef = {
      id: reformCase.id,
      protocol: reformCase.protocol,
      tenantId: reformCase.tenantId,
      condominiumId: reformCase.condominiumId,
      clientId: reformCase.clientId,
    }
    await notifyCondominiumPartner(
      ref,
      "Caso reenviado para revisão",
      `Caso ${reformCase.protocol}: o morador reenviou os documentos corrigidos.`,
    )
    await notifyCondominiumManagers(
      ref,
      "Caso reenviado para revisão",
      `Caso ${reformCase.protocol} voltou para a fila de revisão técnica.`,
    )

    return NextResponse.json({ case: updatedCase })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
