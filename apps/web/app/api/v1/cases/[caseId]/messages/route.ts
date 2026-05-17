import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { TriageAgent } from "@/modules/case-intake/application/TriageAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClassifyScopeUseCase } from "@/modules/case-intake/application/ClassifyScopeUseCase"
import { NotFoundError } from "@/shared/errors/DomainError"

const MessageSchema = z.object({ content: z.string().min(1).max(4000) })

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
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
    const { content } = MessageSchema.parse(await req.json())
    const repo = new PrismaReformCaseRepository()
    const caseId = ctx.params.caseId

    const existing = await repo.findById(caseId, user.tenantId)
    if (!existing) throw new NotFoundError("ReformCase", caseId)

    await repo.appendMessage(caseId, user.tenantId, "USER", content)
    const history = await repo.listMessages(caseId, user.tenantId)
    const historyForAgent = history.filter((m) => m.content !== content || m.role !== "USER")

    const agent = new TriageAgent(new AnthropicProvider())
    const { response, scope } = await agent.process(historyForAgent, content)

    await repo.appendMessage(caseId, user.tenantId, "ASSISTANT", response, scope ? { extractedScope: scope } : undefined)

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

    return NextResponse.json({ text: response, scope, evaluation })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
