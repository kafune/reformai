import { NextRequest } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { buildEmailProvider } from "@/infrastructure/email/ResendEmailProvider"
import { triageDoneTemplate } from "@/infrastructure/email/templates"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { TriageAgent } from "@/modules/case-intake/application/TriageAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClassifyScopeUseCase } from "@/modules/case-intake/application/ClassifyScopeUseCase"
import { NotifyUserUseCase } from "@/modules/notifications/application/NotifyUserUseCase"
import { logger } from "@/shared/logger"

export const dynamic = "force-dynamic"

const MAX_CONTENT = 4000

function sse(data: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

/**
 * Triagem via chat com streaming SSE.
 * EventSource só faz GET — o conteúdo da mensagem vai como query param `content`.
 */
export async function GET(req: NextRequest, ctx: { params: { caseId: string } }) {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return jsonError("UNAUTHORIZED", 401)
  }

  const caseId = ctx.params.caseId
  const content = req.nextUrl.searchParams.get("content")?.trim()
  if (!content) return jsonError("VALIDATION", 400)
  if (content.length > MAX_CONTENT) return jsonError("VALIDATION", 400)

  const tenantId = user.tenantId
  try {
    await assertCaseAccess(user, caseId)
  } catch (err) {
    return jsonError((err as Error & { code?: string }).code === "FORBIDDEN" ? "FORBIDDEN" : "NOT_FOUND", (err as Error & { code?: string }).code === "FORBIDDEN" ? 403 : 404)
  }
  const repo = new PrismaReformCaseRepository()
  const reformCase = await repo.findById(caseId, tenantId)
  if (!reformCase) return jsonError("NOT_FOUND", 404)

  const agent = new TriageAgent(new AnthropicProvider())

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const userMsg = await repo.appendMessage(caseId, tenantId, "USER", content)
        controller.enqueue(sse({ type: "user_message", message: userMsg }))

        const history = await repo.listMessages(caseId, tenantId)
        const priorHistory = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))

        const { textChunks, scopePromise } = agent.processStream(priorHistory, content)

        let fullText = ""
        for await (const chunk of textChunks) {
          fullText += chunk
          controller.enqueue(sse({ type: "chunk", content: chunk }))
        }

        const scope = await scopePromise

        const assistantText =
          fullText ||
          (scope ? `Escopo registrado: ${scope.services.join(", ")}.` : "")
        const assistantMsg = await repo.appendMessage(
          caseId,
          tenantId,
          "ASSISTANT",
          assistantText,
          scope ? { extractedScope: scope } : undefined,
        )

        let scopeClassified = false
        if (scope && reformCase.status === "AWAITING_SCOPE_DETAILS") {
          const classify = new ClassifyScopeUseCase(repo)
          const { evaluation } = await classify.execute({
            caseId,
            tenantId,
            triggeredBy: "ai:triage",
            rawScope: scope,
          })
          scopeClassified = true

          // Notifica o morador — falha aqui não deve abortar a triagem já concluída.
          try {
            await new NotifyUserUseCase().execute({
              userId: reformCase.clientId,
              tenantId,
              title: "Triagem técnica concluída",
              body: `Caso ${reformCase.protocol}: risco ${evaluation.riskLevel}, score ${evaluation.triageScore}.`,
            })

            // Email com template específico de triagem
            const emailProvider = buildEmailProvider()
            if (emailProvider) {
              const client = await prisma.user.findUnique({
                where: { id: reformCase.clientId },
                select: { email: true, name: true },
              })
              if (client) {
                emailProvider
                  .send({
                    to: client.email,
                    subject: `Triagem técnica concluída — ${reformCase.protocol}`,
                    html: triageDoneTemplate({
                      residentName: client.name,
                      protocol: reformCase.protocol,
                      riskLevel: evaluation.riskLevel,
                      triageScore: evaluation.triageScore,
                    }),
                  })
                  .catch((err) =>
                    logger.warn("case.triage.email_failed", {
                      tenantId,
                      caseId,
                      message: err instanceof Error ? err.message : "erro desconhecido",
                    }),
                  )
              }
            }
          } catch (notifyErr) {
            logger.warn("case.triage.notify_failed", {
              tenantId,
              caseId,
              message: notifyErr instanceof Error ? notifyErr.message : "erro desconhecido",
            })
          }
        }

        controller.enqueue(sse({ type: "done", scopeClassified, message: assistantMsg }))
      } catch (err) {
        logger.error("case.triage.stream_error", {
          tenantId,
          caseId,
          message: err instanceof Error ? err.message : "erro desconhecido",
        })
        controller.enqueue(
          sse({ type: "error", message: err instanceof Error ? err.message : "Erro interno" }),
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
