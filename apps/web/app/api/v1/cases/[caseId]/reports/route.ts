import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    // Verifica tenant + posse antes de listar relatórios
    await assertCaseAccess(user, caseId)

    const reportRepo = new PrismaReportRepository(prisma)
    const reports = await reportRepo.findByCaseId(caseId, user.tenantId)

    return NextResponse.json({ reports })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
