import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { NotFoundError } from "@/shared/errors/DomainError"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { GetDocumentUrlUseCase } from "@/modules/document-management/application/GetDocumentUrlUseCase"

export async function GET(
  _: Request,
  ctx: { params: { caseId: string; documentId: string } },
) {
  try {
    const user = await requireSessionUser()

    // Confirm the case belongs to the tenant before exposing a signed URL.
    const caseRepo = new PrismaReformCaseRepository()
    const reformCase = await caseRepo.findById(ctx.params.caseId, user.tenantId)
    if (!reformCase) throw new NotFoundError("ReformCase", ctx.params.caseId)

    const storage = createStorageAdapter()
    const repo = new PrismaDocumentRepository(prisma)
    const useCase = new GetDocumentUrlUseCase({ storage, repo })

    const { url, expiresAt } = await useCase.execute({
      documentId: ctx.params.documentId,
      tenantId: user.tenantId,
    })

    return NextResponse.json({ url, expiresAt })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
