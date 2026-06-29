import { NextRequest } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { enforceUserRateLimit, BUCKETS } from "@/infrastructure/rate-limiter/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { buildEmailProvider } from "@/infrastructure/email/ResendEmailProvider"
import { triageDoneTemplate } from "@/infrastructure/email/templates"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { TriageAgent } from "@/modules/case-intake/application/TriageAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { ClassifyScopeUseCase } from "@/modules/case-intake/application/ClassifyScopeUseCase"
import { NotifyUserUseCase } from "@/modules/notifications/application/NotifyUserUseCase"
import { createOrchestrator } from "@/modules/case-intake/application/ChatOrchestrator"
import type { PluginContext } from "@/modules/case-intake/domain/specialists/SpecialistPlugin"
import type { ReformScope } from "@/shared/schemas/ReformScopeSchema"
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
 * O specialist pode ser passado como `specialistId` (opcional).
 */
export async function GET(req: NextRequest, ctx: { params: { caseId: string } }) {
  let user
  try {
    user = await requireSessionUser()
  } catch {
    return jsonError("UNAUTHORIZED", 401)
  }

  // Rate-limit por usuário: protege custo de tokens da IA contra abuso.
  const limited = await enforceUserRateLimit(user.id, BUCKETS.aiChat)
  if (limited) return limited

  const caseId = ctx.params.caseId
  const content = req.nextUrl.searchParams.get("content")?.trim()
  if (!content) return jsonError("VALIDATION", 400)
  if (content.length > MAX_CONTENT) return jsonError("VALIDATION", 400)

  // Optional: explicit specialist selection
  const explicitSpecialistId = req.nextUrl.searchParams.get("specialistId")

  const tenantId = user.tenantId
  try {
    await assertCaseAccess(user, caseId)
  } catch (err) {
    return jsonError(
      (err as Error & { code?: string }).code === "FORBIDDEN" ? "FORBIDDEN" : "NOT_FOUND",
      (err as Error & { code?: string }).code === "FORBIDDEN" ? 403 : 404,
    )
  }

  const repo = new PrismaReformCaseRepository()
  const docRepo = new PrismaDocumentRepository(prisma)

  const reformCase = await repo.findById(caseId, tenantId)
  if (!reformCase) return jsonError("NOT_FOUND", 404)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const userMsg = await repo.appendMessage(caseId, tenantId, "USER", content)
        controller.enqueue(sse({ type: "user_message", message: userMsg }))
        controller.enqueue(sse({ type: "ack" }))

        const history = await repo.listMessages(caseId, tenantId)
        const priorHistory = history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }))

        // Load documents for PluginContext
        const docs = await docRepo.findByCaseId(caseId, tenantId)

        const pluginCtx: PluginContext = {
          caseId,
          tenantId,
          message: content,
          history: priorHistory,
          reformCase: {
            status: reformCase.status,
            reformScope: reformCase.reformScope as ReformScope | null,
            evaluationResult: reformCase.evaluationResult as Record<string, unknown> | null,
            riskLevel: reformCase.riskLevel,
            condominiumId: reformCase.condominiumId,
            unitId: reformCase.unitId,
            clientId: reformCase.clientId,
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
        const specialist = await orchestrator.resolve(content, pluginCtx, explicitSpecialistId)

        // ── Non-triage specialist path ────────────────────────────────────────
        if (specialist.id !== "triage") {
          const { textChunks, result } = specialist.processStream(pluginCtx)

          let fullText = ""
          for await (const chunk of textChunks) {
            fullText += chunk
            controller.enqueue(sse({ type: "chunk", content: chunk }))
          }

          const pluginResult = await result
          const assistantMsg = await repo.appendMessage(
            caseId,
            tenantId,
            "ASSISTANT",
            pluginResult.text || fullText,
            {
              specialistId: pluginResult.metadata.specialistId,
              reportId: pluginResult.metadata.reportId,
              sources: pluginResult.metadata.sources,
              processSteps: pluginResult.metadata.processSteps,
            },
          )

          controller.enqueue(
            sse({ type: "done", message: assistantMsg, specialistId: specialist.id }),
          )
          return
        }

        // ── Triage specialist path (original flow) ────────────────────────────
        const agent = new TriageAgent(new AnthropicProvider())
        const { textChunks, scopePromise } = agent.processStream(priorHistory, content)

        let fullText = ""
        for await (const chunk of textChunks) {
          fullText += chunk
          controller.enqueue(sse({ type: "chunk", content: chunk }))
        }

        const scope = await scopePromise

        const assistantText =
          fullText || (scope ? `Escopo registrado: ${scope.services.join(", ")}.` : "")
        const assistantMsg = await repo.appendMessage(
          caseId,
          tenantId,
          "ASSISTANT",
          assistantText,
          scope
            ? { extractedScope: scope, specialistId: "triage" }
            : { specialistId: "triage" },
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
              caseId: reformCase.id,
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

        controller.enqueue(
          sse({
            type: "done",
            scopeClassified,
            message: assistantMsg,
            specialistId: "triage",
          }),
        )
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
