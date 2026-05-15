import {
  Queue,
  Worker,
  type ConnectionOptions,
  type Job,
  type QueueOptions,
  type WorkerOptions,
} from "bullmq"

export interface QueueManagerOptions {
  redisUrl?: string
  connection?: ConnectionOptions
}

/**
 * Singleton para criação cacheada de `Queue` e `Worker` BullMQ.
 *
 * Garante uma única instância de conexão por nome de fila/worker no processo,
 * evitando múltiplos clients Redis para a mesma queue.
 *
 * Conexão é derivada de `REDIS_URL` (mesma lógica usada por
 * `QueueDocumentJob`), permitindo passar por options para testes.
 */
export class QueueManager {
  private static instance: QueueManager | null = null

  private readonly connection: ConnectionOptions
  private readonly queues = new Map<string, Queue<unknown>>()
  private readonly workers = new Map<string, Worker<unknown>>()

  private constructor(options: QueueManagerOptions) {
    this.connection =
      options.connection ??
      QueueManager.buildConnectionFromUrl(
        options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379",
      )
  }

  static getInstance(options: QueueManagerOptions = {}): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager(options)
    }
    return QueueManager.instance
  }

  /**
   * Reseta o singleton. Útil em testes para garantir isolamento entre suites.
   */
  static resetInstance(): void {
    QueueManager.instance = null
  }

  getQueue<T = unknown>(name: string, opts?: Omit<QueueOptions, "connection">): Queue<T> {
    const existing = this.queues.get(name)
    if (existing) return existing as Queue<T>

    const queue = new Queue<T>(name, { ...opts, connection: this.connection })
    this.queues.set(name, queue as unknown as Queue<unknown>)
    return queue
  }

  getWorker<T = unknown>(
    name: string,
    processor: (job: Job<T>) => Promise<unknown>,
    opts?: Omit<WorkerOptions, "connection">,
  ): Worker<T> {
    const existing = this.workers.get(name)
    if (existing) return existing as Worker<T>

    const worker = new Worker<T>(name, processor as (job: Job<T>) => Promise<unknown>, {
      concurrency: 1,
      ...opts,
      connection: this.connection,
    })
    this.workers.set(name, worker as unknown as Worker<unknown>)
    return worker
  }

  async closeAll(): Promise<void> {
    const workerCloses = Array.from(this.workers.values()).map((w) => w.close())
    const queueCloses = Array.from(this.queues.values()).map((q) => q.close())
    await Promise.all([...workerCloses, ...queueCloses])
    this.workers.clear()
    this.queues.clear()
  }

  private static buildConnectionFromUrl(url: string): ConnectionOptions {
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
