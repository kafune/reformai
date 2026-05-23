import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ReportType } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClaudeReportAgent } from "@/modules/document-generation/application/ClaudeReportAgent"
import { GenerateReportUseCase } from "@/modules/document-generation/application/GenerateReportUseCase"
import { PrismaReportRepository } from "@/modules/document-generation/infrastructure/PrismaReportRepository"
import { loadCaseRelations } from "@/modules/document-generation/infrastructure/loadCaseRelations"

const BodySchema = z.object({
  reportType: z.nativeEnum(ReportType),
  enrichWithAI: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    const body = BodySchema.parse(await req.json())

    // Verifica tenant + posse antes de prosseguir
    await assertCaseAccess(user, caseId)

    const caseRepo = new PrismaReformCaseRepository()
    const docRepo = new PrismaDocumentRepository(prisma)
    const reportRepo = new PrismaReportRepository(prisma)
    const storage = createStorageAdapter()
    const llm = new AnthropicProvider()
    const reportAgent = new ClaudeReportAgent(llm)

    const useCase = new GenerateReportUseCase({
      caseRepo,
      docRepo,
      reportRepo,
      storage,
      reportAgent,
      loadRelations: loadCaseRelations,
    })

    const report = await useCase.execute({
      caseId,
      tenantId: user.tenantId,
      reportType: body.reportType,
      generatedBy: `user:${user.id}`,
      enrichWithAI: body.enrichWithAI,
    })

    // Return the report without `content` — client fetches markdown via /url
    const { content: _omit, ...meta } = report
    void _omit

    return NextResponse.json(meta, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
