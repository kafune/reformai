import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    // Verify the case belongs to the tenant before listing reports
    const caseRepo = new PrismaReformCaseRepository()
    const reformCase = await caseRepo.findById(caseId, user.tenantId)
    if (!reformCase) throw new NotFoundError("ReformCase", caseId)

    const reportRepo = new PrismaReportRepository(prisma)
    const reports = await reportRepo.findByCaseId(caseId, user.tenantId)

    return NextResponse.json({ reports })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
