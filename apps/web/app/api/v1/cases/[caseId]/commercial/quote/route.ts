import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaCommercialRepository } from "@/modules/commercial-offers/infrastructure/PrismaCommercialRepository"
import { CommercialAgent } from "@/modules/commercial-offers/application/CommercialAgent"
import { QuoteCaseUseCase } from "@/modules/commercial-offers/application/QuoteCaseUseCase"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const QuoteBodySchema = z.object({
  planId: z.string().min(1),
  extraInspections: z.number().int().min(0).optional().default(0),
})

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const QUOTE_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "CONDOMINIUM"])

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!QUOTE_ROLES.has(user.role)) return forbidden()
    const caseId = ctx.params.caseId

    const body = await req.json()
    const { planId, extraInspections } = QuoteBodySchema.parse(body)

    await assertCaseAccess(user, caseId)

    const caseRepo = new PrismaReformCaseRepository()
    const commercialRepo = new PrismaCommercialRepository()
    const llm = new AnthropicProvider()
    const agent = new CommercialAgent(llm)

    const useCase = new QuoteCaseUseCase(caseRepo, commercialRepo, agent)

    const result = await useCase.execute({
      caseId,
      tenantId: user.tenantId,
      planId,
      extraInspections,
      triggeredBy: `user:${user.id}`,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
