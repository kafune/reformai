import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { TriageAgent } from "@/modules/case-intake/application/TriageAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClassifyScopeUseCase } from "@/modules/case-intake/application/ClassifyScopeUseCase"
import { createOrchestrator } from "@/modules/case-intake/application/ChatOrchestrator"
import type { PluginContext } from "@/modules/case-intake/domain/specialists/SpecialistPlugin"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"
import { NotFoundError } from "@/shared/errors/DomainError"

const MessageSchema = z.object({
  content: z.string().min(1).max(4000),
  specialistId: z.string().optional(),
})

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    await assertCaseAccess(user, ctx.params.caseId)
    const repo = new PrismaReformCaseRepository()
    const messages = await repo.listMessages(ctx.params.caseId, user.tenantId)
    return NextResponse.json({ messages })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const { content, specialistId } = MessageSchema.parse(await req.json())
    const repo = new PrismaReformCaseRepository()
    const docRepo = new PrismaDocumentRepository(prisma)
    const caseId = ctx.params.caseId

    await assertCaseAccess(user, caseId)
    const existing = await repo.findById(caseId, user.tenantId)
    if (!existing) throw new NotFoundError("ReformCase", caseId)

    await repo.appendMessage(caseId, user.tenantId, "USER", content)
    const history = await repo.listMessages(caseId, user.tenantId)
    const historyForAgent = history.filter((m) => m.content !== content || m.role !== "USER")

    // Load documents for PluginContext
    const docs = await docRepo.findByCaseId(caseId, user.tenantId)

    const pluginCtx: PluginContext = {
      caseId,
      tenantId: user.tenantId,
      message: content,
      history: historyForAgent.map((m) => ({ role: m.role, content: m.content })),
      reformCase: {
        status: existing.status,
        reformScope: existing.reformScope as ReformScope | null,
        evaluationResult: existing.evaluationResult as Record<string, unknown> | null,
        riskLevel: existing.riskLevel,
        condominiumId: existing.condominiumId,
        unitId: existing.unitId,
        clientId: existing.clientId,
      },
      documents: docs.map((d) => ({
        id: d.id,
        type: d.type,
        fileName: d.fileName,
        status: d.status,
        extractedData: d.extractedData,
        pendencies: d.pendencies,
        inconsistencies: d.inconsistencies,
      })),
    }

    const orchestrator = createOrchestrator()
    const specialist = await orchestrator.resolve(content, pluginCtx, specialistId)

    // ── Non-triage specialist path ──────────────────────────────────────────
    if (specialist.id !== "triage") {
      const pluginResult = await specialist.process(pluginCtx)
      await repo.appendMessage(
        caseId,
        user.tenantId,
        "ASSISTANT",
        pluginResult.text,
        {
          specialistId: pluginResult.metadata.specialistId,
          reportId: pluginResult.metadata.reportId,
          sources: pluginResult.metadata.sources,
          processSteps: pluginResult.metadata.processSteps,
        },
      )
      return NextResponse.json({
        text: pluginResult.text,
        specialistId: specialist.id,
        metadata: pluginResult.metadata,
      })
    }

    // ── Triage specialist path (original flow) ──────────────────────────────
    const agent = new TriageAgent(new AnthropicProvider())
    const { response, scope } = await agent.process(historyForAgent, content)

    await repo.appendMessage(
      caseId,
      user.tenantId,
      "ASSISTANT",
      response,
      scope
        ? { extractedScope: scope, specialistId: "triage" }
        : { specialistId: "triage" },
    )

    let evaluation = null
    if (scope && existing.status === "AWAITING_SCOPE_DETAILS") {
      const classify = new ClassifyScopeUseCase(repo)
      const result = await classify.execute({
        caseId,
        tenantId: user.tenantId,
        triggeredBy: "ai:triage",
        rawScope: scope,
      })
      evaluation = result.evaluation
    }

    return NextResponse.json({
      text: response,
      scope,
      evaluation,
      specialistId: "triage",
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
