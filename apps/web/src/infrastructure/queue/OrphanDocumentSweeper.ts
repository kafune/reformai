import type { PrismaClient } from "@reformai/database"
import type { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { logger } from "@/shared/logger"

export interface OrphanDocumentSweeperDeps {
  prisma: PrismaClient
  queue: QueueDocumentJob
  /** Idade mínima (minutos) de um documento PENDING para ser considerado órfão. */
  thresholdMinutes?: number
  /** Intervalo entre varreduras (ms). */
  intervalMs?: number
  /** Máximo de documentos reenfileirados por varredura. */
  batchSize?: number
}

const DEFAULT_THRESHOLD_MINUTES = 15
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000
const DEFAULT_BATCH_SIZE = 50

/**
 * Reenfileira documentos "zumbis": registros que ficaram em PENDING porque o
 * job nunca entrou na fila (ex.: Redis fora do ar no momento do upload) ou se
 * perdeu no meio do pipeline. O pipeline é idempotente, então reprocessar do
 * passo `ocr` é seguro — documentos que falham de forma permanente saem de
 * PENDING (viram INVALID) e deixam de ser varridos.
 */
export class OrphanDocumentSweeper {
  private readonly prisma: PrismaClient
  private readonly queue: QueueDocumentJob
  private readonly thresholdMinutes: number
  private readonly intervalMs: number
  private readonly batchSize: number
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(deps: OrphanDocumentSweeperDeps) {
    this.prisma = deps.prisma
    this.queue = deps.queue
    this.thresholdMinutes = deps.thresholdMinutes ?? DEFAULT_THRESHOLD_MINUTES
    this.intervalMs = deps.intervalMs ?? DEFAULT_INTERVAL_MS
    this.batchSize = deps.batchSize ?? DEFAULT_BATCH_SIZE
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => {
      void this.sweep()
    }, this.intervalMs)
    // Primeira varredura logo na subida do worker — cobre janelas de downtime.
    void this.sweep()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async sweep(): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - this.thresholdMinutes * 60 * 1000)
      const orphans = await this.prisma.document.findMany({
        where: { status: "PENDING", uploadedAt: { lt: cutoff } },
        select: {
          id: true,
          caseId: true,
          tenantId: true,
          storageKey: true,
          mimeType: true,
        },
        orderBy: { uploadedAt: "asc" },
        take: this.batchSize,
      })

      if (orphans.length === 0) return 0

      let requeued = 0
      for (const doc of orphans) {
        try {
          await this.queue.enqueue({
            caseId: doc.caseId,
            documentId: doc.id,
            tenantId: doc.tenantId,
            storageKey: doc.storageKey,
            mimeType: doc.mimeType,
            step: "ocr",
          })
          requeued += 1
        } catch (err) {
          logger.warn("worker.orphan_sweep.enqueue_failed", {
            documentId: doc.id,
            error: (err as Error).message,
          })
        }
      }

      logger.info("worker.orphan_sweep.completed", {
        found: orphans.length,
        requeued,
        thresholdMinutes: this.thresholdMinutes,
      })
      return requeued
    } catch (err) {
      logger.warn("worker.orphan_sweep.failed", { error: (err as Error).message })
      return 0
    }
  }
}
