import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { DocumentWorker } from "@/infrastructure/queue/DocumentWorker"
import { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { ClaudeDocumentAgent } from "@/modules/document-intelligence/application/ClaudeDocumentAgent"
import { ClaudeAnalysisAgent } from "@/modules/document-intelligence/application/ClaudeAnalysisAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { getCaseNotificationService } from "@/modules/case-intake/application/CaseNotificationService"
import { logger } from "@/shared/logger"
import { initMonitoring, captureException } from "@/infrastructure/monitoring/sentry"
import { logConfigStatus } from "@/infrastructure/config/configStatus"

// Modelos por etapa do pipeline (configuráveis por env):
//  - extração: tarefa estruturada e de alto volume → modelo econômico
//  - análise cruzada: exige raciocínio entre documentos → modelo mais capaz
//  - fotos: precisão extra quando o tipo do documento é PHOTOS
const EXTRACTION_MODEL = process.env.ANTHROPIC_MODEL_EXTRACTION?.trim() || "claude-haiku-4-5"
const ANALYSIS_MODEL = process.env.ANTHROPIC_MODEL_ANALYSIS?.trim() || "claude-sonnet-4-6"
const PHOTOS_MODEL = process.env.ANTHROPIC_MODEL_PHOTOS?.trim() || ANALYSIS_MODEL

async function main() {
  initMonitoring()
  logConfigStatus()
  const llm = new AnthropicProvider()
  const worker = new DocumentWorker({
    storage: createStorageAdapter(),
    repo: new PrismaDocumentRepository(prisma),
    queue: new QueueDocumentJob(),
    documentAgent: new ClaudeDocumentAgent(llm, {
      model: EXTRACTION_MODEL,
      photosModel: PHOTOS_MODEL,
    }),
    analysisAgent: new ClaudeAnalysisAgent(llm, { model: ANALYSIS_MODEL }),
    caseRepo: new PrismaReformCaseRepository(),
    prisma,
    notifications: (params) => getCaseNotificationService().onTransition(params),
  })

  const handle = worker.start()
  logger.info("worker.started", {
    queue: "document-processing",
    models: { extraction: EXTRACTION_MODEL, analysis: ANALYSIS_MODEL, photos: PHOTOS_MODEL },
  })

  const shutdown = async (signal: string) => {
    logger.info("worker.shutdown", { signal })
    await handle.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on("SIGTERM", () => void shutdown("SIGTERM"))
  process.on("SIGINT", () => void shutdown("SIGINT"))
}

main().catch((err) => {
  logger.error("worker.fatal", { message: (err as Error).message, stack: (err as Error).stack })
  captureException(err, { route: "worker.fatal" })
  process.exit(1)
})
