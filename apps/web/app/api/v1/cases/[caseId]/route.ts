import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const repo = new PrismaReformCaseRepository()
    const found = await repo.findById(ctx.params.caseId, user.tenantId)
    if (!found) throw new NotFoundError("ReformCase", ctx.params.caseId)
    return NextResponse.json(found)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
