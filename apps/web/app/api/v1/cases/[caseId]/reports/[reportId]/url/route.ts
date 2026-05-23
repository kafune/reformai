import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter, SIGNED_URL_TTL_SECONDS } from "@/infrastructure/storage/StorageFactory"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"
import { GenerateReportUseCase } from "@/modules/document-generation/application/GenerateReportUseCase"

export async function GET(
  _: Request,
  ctx: { params: { caseId: string; reportId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { caseId, reportId } = ctx.params

    // Verifica tenant + posse
    const reformCase = await assertCaseAccess(user, caseId)

    // Verify the report belongs to the same case and tenant
    const reportRepo = new PrismaReportRepository(prisma)
    const report = await reportRepo.findById(reportId, user.tenantId)
    if (!report || report.caseId !== caseId) throw new NotFoundError("Report", reportId)

    // Reconstruct the deterministic storage key (no storageKey column in Report)
    const storageKey = GenerateReportUseCase.buildReportStorageKey(
      user.tenantId,
      reformCase.condominiumId,
      reformCase.unitId,
      caseId,
      reportId,
    )

    const storage = createStorageAdapter()
    const url = await storage.getSignedUrl(storageKey, SIGNED_URL_TTL_SECONDS)
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString()

    return NextResponse.json({ url, expiresAt })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
