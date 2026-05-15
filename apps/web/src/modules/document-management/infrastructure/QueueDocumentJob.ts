import { Queue, type ConnectionOptions } from "bullmq"
import {
  DOCUMENT_QUEUE,
  type DocumentJobData,
} from "@/infrastructure/queue/types"

export interface QueueDocumentJobOptions {
  connection?: ConnectionOptions
  redisUrl?: string
}

/**
 * Encapsula o BullMQ `Queue` para o pipeline documental.
 *
 * Construtor aceita `ConnectionOptions` ou `redisUrl`. Se nenhum for
 * fornecido, lê de `process.env.REDIS_URL` (default `redis://localhost:6379`).
 */
export class QueueDocumentJob {
  private readonly queue: Queue<DocumentJobData>

  constructor(options: QueueDocumentJobOptions = {}) {
    const connection: ConnectionOptions =
      options.connection ??
      this.buildConnectionFromUrl(
        options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379",
      )

    this.queue = new Queue<DocumentJobData>(DOCUMENT_QUEUE, { connection })
  }

  async enqueue(data: DocumentJobData): Promise<void> {
    await this.queue.add(data.step, data)
  }

  async close(): Promise<void> {
    await this.queue.close()
  }

  private buildConnectionFromUrl(url: string): ConnectionOptions {
    const parsed = new URL(url)
    const port = parsed.port ? Number(parsed.port) : 6379
    return {
      host: parsed.hostname,
      port,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
    }
  }
}
