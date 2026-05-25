import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { ReviewPartnerUseCase } from "@/modules/partner-network/application/ReviewPartnerUseCase"
import { BusinessRuleViolationError } from "@/shared/errors/DomainError"

const ReviewBodySchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()

    // Apenas CLIENT pode avaliar
    if (user.role !== "CLIENT") return forbidden()

    const { caseId } = ctx.params

    const body = ReviewBodySchema.parse(await req.json())

    const useCase = new ReviewPartnerUseCase()

    try {
      await useCase.execute({
        caseId,
        clientId: user.id,
        tenantId: user.tenantId,
        score: body.score,
        comment: body.comment,
      })
    } catch (err) {
      if (
        err instanceof BusinessRuleViolationError &&
        err.message.includes("Já existe uma avaliação")
      ) {
        return NextResponse.json(
          { error: "CONFLICT", message: "Já existe uma avaliação para este caso." },
          { status: 409 },
        )
      }
      throw err
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function GET(_: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const { caseId } = ctx.params

    const { prisma } = await import("@/infrastructure/database/prisma")

    const review = await prisma.partnerReview.findUnique({
      where: { caseId },
      select: {
        id: true,
        score: true,
        comment: true,
        createdAt: true,
        clientId: true,
      },
    })

    // Só dono do caso ou admin pode ver a avaliação
    const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "CONDOMINIUM"])
    if (!ADMIN_ROLES.has(user.role)) {
      // Para CLIENT: verificar que é dono do caso
      if (review && review.clientId !== user.id) return forbidden()
    }

    return NextResponse.json({ review: review ?? null })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
