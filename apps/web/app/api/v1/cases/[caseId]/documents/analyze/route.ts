import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { enforceUserRateLimit, BUCKETS } from "@/infrastructure/rate-limiter/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { GetDocumentsByCase } from "@/modules/document-management/application/GetDocumentsByCase"

const ALLOWED_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "CONDOMINIUM", "MANAGER"])

export async function POST(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()

    if (!ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    // Rate-limit por usuário: dispara OCR + extração/análise por IA na fila.
    const limited = await enforceUserRateLimit(user.id, BUCKETS.aiAnalyze)
    if (limited) return limited

    const caseId = ctx.params.caseId

    await assertCaseAccess(user, caseId)

    const repo = new PrismaDocumentRepository(prisma)
    const queue = new QueueDocumentJob()
    const getDocs = new GetDocumentsByCase({ repo })
    const docs = await getDocs.execute({ caseId, tenantId: user.tenantId })

    const pending = docs.filter((d) => d.status === "PENDING")

    for (const doc of pending) {
      await queue.enqueue({
        caseId,
        documentId: doc.id,
        tenantId: user.tenantId,
        storageKey: doc.storageKey,
        mimeType: doc.mimeType,
        step: "ocr",
      })
    }

    return NextResponse.json({ queued: pending.length })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
