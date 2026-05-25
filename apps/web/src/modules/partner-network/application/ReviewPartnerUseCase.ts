import { z } from "zod"
import { prisma } from "@/infrastructure/database/prisma"
import {
  BusinessRuleViolationError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/shared/errors/DomainError"

// ─── Input schema ──────────────────────────────────────────────────────────

export const ReviewPartnerInputSchema = z.object({
  caseId: z.string().min(1),
  clientId: z.string().min(1),
  tenantId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

export type ReviewPartnerInput = z.infer<typeof ReviewPartnerInputSchema>

// ─── Use Case ─────────────────────────────────────────────────────────────

export class ReviewPartnerUseCase {
  async execute(input: ReviewPartnerInput): Promise<void> {
    // Validate input via Zod
    const parsed = ReviewPartnerInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new ValidationError("Dados de avaliação inválidos", parsed.error.issues)
    }

    const { caseId, clientId, tenantId, score, comment } = parsed.data

    // 1. Buscar caso com isolamento de tenant
    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId },
    })
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    // 2. Verificar que o caso está CONCLUDED
    if (reformCase.status !== "CONCLUDED") {
      throw new BusinessRuleViolationError(
        `Avaliação só é permitida em casos CONCLUDED. Estado atual: ${reformCase.status}`,
      )
    }

    // 3. Verificar que clientId é dono do caso
    if (reformCase.clientId !== clientId) {
      throw new ForbiddenError("Apenas o dono do caso pode avaliá-lo")
    }

    // 4. Verificar que o caso tem parceiro atribuído
    if (!reformCase.partnerId) {
      throw new BusinessRuleViolationError("Caso não possui parceiro atribuído para avaliação")
    }

    const partnerId = reformCase.partnerId

    // 5. Verificar que não existe avaliação para este caseId (unique constraint)
    const existing = await prisma.partnerReview.findUnique({
      where: { caseId },
    })
    if (existing) {
      throw new BusinessRuleViolationError("Já existe uma avaliação para este caso")
    }

    // 6. Criar PartnerReview e atualizar rating do parceiro em transação
    await prisma.$transaction(async (tx) => {
      // Criar avaliação
      await tx.partnerReview.create({
        data: {
          partnerId,
          caseId,
          clientId,
          tenantId,
          score,
          comment,
        },
      })

      // Recalcular rating: média de todos os scores do parceiro
      const aggregate = await tx.partnerReview.aggregate({
        where: { partnerId },
        _avg: { score: true },
      })

      const newRating = aggregate._avg.score ?? score

      await tx.partner.update({
        where: { id: partnerId },
        data: { rating: newRating },
      })

      // Gravar AuditLog
      await tx.auditLog.create({
        data: {
          tenantId,
          caseId,
          userId: clientId,
          action: "partner.reviewed",
          triggeredBy: `user:${clientId}`,
          details: {
            partnerId,
            score,
            comment: comment ?? null,
            newRating,
          },
        },
      })
    })
  }
}
