import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { NotFoundError } from "@/shared/errors/DomainError"
import { prisma } from "@/infrastructure/database/prisma"

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    await assertCaseAccess(user, ctx.params.caseId)

    const found = await prisma.reformCase.findFirst({
      where: { id: ctx.params.caseId, tenantId: user.tenantId },
      include: {
        partner: {
          select: {
            id: true,
            user: { select: { name: true } },
          },
        },
      },
    })
    if (!found) throw new NotFoundError("ReformCase", ctx.params.caseId)
    return NextResponse.json(found)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
