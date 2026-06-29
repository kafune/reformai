import { prisma } from "@/infrastructure/database/prisma"
import {
  assembleOffer,
  OFFER_VISIBLE_STATUSES,
  type CaseOfferView,
} from "./offer-assembler"

export type {
  CaseOfferView,
  CaseOfferQuote,
  OfferBreakdownItem,
} from "./offer-assembler"

export class GetCaseOfferUseCase {
  async execute(params: {
    caseId: string
    tenantId: string
  }): Promise<CaseOfferView | null> {
    const { caseId, tenantId } = params

    const reformCase = await prisma.reformCase.findFirst({
      where: { id: caseId, tenantId },
      select: { status: true, commercialPlanId: true },
    })
    if (!reformCase) return null
    if (!OFFER_VISIBLE_STATUSES.has(reformCase.status)) return null

    const audit = await prisma.auditLog.findFirst({
      where: { caseId, tenantId, action: "commercial.quote.generated" },
      orderBy: { createdAt: "desc" },
      select: { details: true, createdAt: true },
    })
    if (!audit) return null

    const plan = reformCase.commercialPlanId
      ? await prisma.commercialPlan.findFirst({
          where: { id: reformCase.commercialPlanId, tenantId },
          select: { name: true, description: true },
        })
      : null

    return assembleOffer({
      auditDetails: (audit.details as Record<string, unknown> | null) ?? null,
      planName: plan?.name ?? null,
      planDescription: plan?.description ?? null,
      status: reformCase.status,
      generatedAt: audit.createdAt,
    })
  }
}
