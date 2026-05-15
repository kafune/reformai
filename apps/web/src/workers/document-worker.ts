import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { DocumentWorker } from "@/infrastructure/queue/DocumentWorker"
import { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { ClaudeDocumentAgent } from "@/modules/document-intelligence/application/ClaudeDocumentAgent"
import { ClaudeAnalysisAgent } from "@/modules/document-intelligence/application/ClaudeAnalysisAgent"
import { AnthropicProvider } from "@/modules/document-intelligence/infrastructure/llm/AnthropicProvider"
import { logger } from "@/shared/logger"

async function main() {
  const llm = new AnthropicProvider()
  const worker = new DocumentWorker({
    storage: createStorageAdapter(),
    repo: new PrismaDocumentRepository(prisma),
    queue: new QueueDocumentJob(),
    documentAgent: new ClaudeDocumentAgent(llm),
    analysisAgent: new ClaudeAnalysisAgent(llm),
    caseRepo: new PrismaReformCaseRepository(),
    prisma,
  })

  const handle = worker.start()
  logger.info("worker.started", { queue: "document-processing" })

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
  process.exit(1)
})
