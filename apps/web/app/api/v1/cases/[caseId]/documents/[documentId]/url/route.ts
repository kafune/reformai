import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { GetDocumentUrlUseCase } from "@/modules/document-management/application/GetDocumentUrlUseCase"

export async function GET(
  _: Request,
  ctx: { params: { caseId: string; documentId: string } },
) {
  try {
    const user = await requireSessionUser()

    // Confirma tenant + posse antes de expor uma signed URL.
    await assertCaseAccess(user, ctx.params.caseId)

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
