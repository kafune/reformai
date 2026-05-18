import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CaseStatus, Prisma } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import { NotFoundError, BusinessRuleViolationError } from "@/shared/errors/DomainError"
import {
  notifyCondominiumManagers,
  notifyCaseClient,
  type CaseStakeholderRef,
} from "@/modules/notifications/application/notifyCase"

const BodySchema = z.object({
  decision: z.enum(["approve", "request_corrections"]),
  notes: z.string().min(10, "Descreva o motivo da decisão (mín. 10 caracteres)."),
})

/**
 * Decisão de revisão do parceiro sobre um caso em HUMAN_REVIEW_REQUIRED.
 * - approve            → COMMERCIAL_OFFER_SENT (com agreedCasePrice do condomínio)
 * - request_corrections → PENDING_CORRECTIONS  (devolve ao morador)
 */
export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "PARTNER") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!partner) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = BodySchema.parse(await req.json())
    const { caseId } = ctx.params

    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId: user.tenantId },
      include: {
        condominium: { select: { partnerId: true, partnerCasePrice: true } },
      },
    })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // O parceiro só revisa casos dos condomínios sob sua responsabilidade.
    if (reformCase.condominium.partnerId !== partner.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (reformCase.status !== "HUMAN_REVIEW_REQUIRED") {
      throw new BusinessRuleViolationError(
        `Caso deve estar em HUMAN_REVIEW_REQUIRED para revisão. Status atual: ${reformCase.status}`,
      )
    }

    const toStatus: CaseStatus =
      body.decision === "approve" ? "COMMERCIAL_OFFER_SENT" : "PENDING_CORRECTIONS"

    // Aprovar exige o valor por caso configurado no condomínio.
    if (body.decision === "approve" && reformCase.condominium.partnerCasePrice == null) {
      throw new BusinessRuleViolationError(
        "Defina o valor por caso do condomínio antes de aprovar (painel de Condomínios).",
      )
    }

    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    const triggeredBy = `partner:${partner.id}`
    machine.transition(toStatus, {
      previousStatus: reformCase.status,
      triggeredBy,
      reason: body.notes,
    })

    const updatedCase = await prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.update({
        where: { id: caseId },
        data: {
          status: toStatus,
          updatedAt: new Date(),
          // Na aprovação o parceiro assume o caso e o valor é fixado.
          ...(body.decision === "approve"
            ? {
                partnerId: partner.id,
                agreedCasePrice: reformCase.condominium.partnerCasePrice,
              }
            : {}),
        },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId,
          fromStatus: reformCase.status,
          toStatus,
          triggeredBy,
          reason: body.notes,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: user.tenantId,
          caseId,
          userId: user.id,
          action: "case.partner.review.completed",
          triggeredBy,
          details: { decision: body.decision, notes: body.notes },
          aiReasoning: Prisma.JsonNull,
        },
      })

      return updated
    })

    // Notifica morador e síndico — falhas aqui não abortam a decisão.
    const ref: CaseStakeholderRef = {
      id: reformCase.id,
      protocol: reformCase.protocol,
      tenantId: reformCase.tenantId,
      condominiumId: reformCase.condominiumId,
      clientId: reformCase.clientId,
    }
    if (body.decision === "approve") {
      await notifyCaseClient(
        ref,
        "Triagem aprovada pelo responsável técnico",
        `Caso ${reformCase.protocol}: aprovado. Veja a proposta na aba Proposta para prosseguir.`,
      )
      await notifyCondominiumManagers(
        ref,
        "Caso aprovado pelo parceiro",
        `Caso ${reformCase.protocol} foi aprovado e teve a proposta enviada ao morador.`,
      )
    } else {
      await notifyCaseClient(
        ref,
        "Triagem precisa de correções",
        `Caso ${reformCase.protocol}: o responsável técnico solicitou correções. Motivo: ${body.notes}`,
      )
      await notifyCondominiumManagers(
        ref,
        "Caso devolvido para correções",
        `Caso ${reformCase.protocol} foi devolvido ao morador para correções.`,
      )
    }

    return NextResponse.json({ case: updatedCase })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
