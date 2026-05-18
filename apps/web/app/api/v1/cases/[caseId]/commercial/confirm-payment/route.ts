import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import { NotFoundError, BusinessRuleViolationError } from "@/shared/errors/DomainError"
import {
  notifyCaseClient,
  notifyCondominiumPartner,
  type CaseStakeholderRef,
} from "@/modules/notifications/application/notifyCase"

const ALLOWED_ROLES = new Set(["CONDOMINIUM", "ADMIN", "SUPER_ADMIN"])

/**
 * Confirma o recebimento do pagamento do caso.
 * O morador paga o condomínio; o síndico confirma o recebimento aqui.
 * Transição: AWAITING_PAYMENT → ASSIGNED_TO_PARTNER.
 */
export async function POST(_req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const { caseId } = ctx.params

    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId: user.tenantId },
    })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // O síndico só confirma pagamentos de casos do seu condomínio.
    if (user.role === "CONDOMINIUM" && reformCase.condominiumId !== user.condominiumId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (reformCase.status !== "AWAITING_PAYMENT") {
      throw new BusinessRuleViolationError(
        `Confirmação de pagamento exige o caso em AWAITING_PAYMENT. Status atual: ${reformCase.status}`,
      )
    }

    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    const triggeredBy = `user:${user.id}`
    machine.transition("ASSIGNED_TO_PARTNER", {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: "Pagamento confirmado pelo condomínio",
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: { status: "ASSIGNED_TO_PARTNER", updatedAt: new Date() },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus: "ASSIGNED_TO_PARTNER",
          triggeredBy,
          reason: "Pagamento confirmado pelo condomínio",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          caseId,
          userId: user.id,
          action: "commercial.payment.confirmed",
          triggeredBy,
          details: { fromStatus: reformCase.status, toStatus: "ASSIGNED_TO_PARTNER" },
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
    await notifyCaseClient(
      ref,
      "Pagamento confirmado",
      `Caso ${reformCase.protocol}: pagamento confirmado. O responsável técnico dará andamento.`,
    )
    await notifyCondominiumPartner(
      ref,
      "Caso liberado para execução",
      `Caso ${reformCase.protocol}: pagamento confirmado — pronto para emissão de ART e vistorias.`,
    )

    return NextResponse.json({ case: updatedCase })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
