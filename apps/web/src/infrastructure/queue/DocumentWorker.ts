import type { DocStatus, PrismaClient, ReformCase } from "@reformai/database"
import type { Job, Worker } from "bullmq"
import { CaseStateMachine } from "@/modules/case-intake/domain/entities/CaseStateMachine"
import type { ReformCaseRepository } from "@/modules/case-intake/domain/repositories/ReformCaseRepository"
import { DocumentChecklist } from "@/modules/document-management/domain/DocumentChecklist"
import type {
  DocumentRecord,
  DocumentRepository,
} from "@/modules/document-management/domain/repositories/DocumentRepository"
import type { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import type {
  AnalysisAgent,
  AnalysisAgentInput,
  DocumentAnalysisResult,
} from "@/modules/document-intelligence/domain/AnalysisAgent"
import type { DocumentAgent } from "@/modules/document-intelligence/domain/DocumentAgent"
import type { StorageAdapter } from "@/infrastructure/storage/StorageAdapter"
import type { CaseDomainEvent } from "@/shared/events/CaseEvents"
import { QueueManager } from "./QueueManager"
import {
  DOCUMENT_QUEUE,
  type DocumentJobData,
  type DocumentJobResult,
  type DocumentJobStep,
} from "./types"

export interface DocumentWorkerDeps {
  storage: StorageAdapter
  repo: DocumentRepository
  queue: QueueDocumentJob
  documentAgent: DocumentAgent
  analysisAgent: AnalysisAgent
  caseRepo: ReformCaseRepository
  prisma: PrismaClient
  eventBus?: (event: CaseDomainEvent) => Promise<void> | void
  queueManager?: QueueManager
  /** Override do TTL (segundos) da signed URL usada para baixar o arquivo. */
  signedUrlTtlSeconds?: number
}

const DEFAULT_SIGNED_URL_TTL = 300

const FINAL_STATUSES: ReadonlySet<DocStatus> = new Set<DocStatus>([
  "VALID",
  "VALID_WITH_CAVEATS",
])

function recommendationToStatus(
  recommendation: DocumentAnalysisResult["recommendation"],
): DocStatus {
  switch (recommendation) {
    case "approve":
      return "VALID"
    case "approve_with_caveats":
      return "VALID_WITH_CAVEATS"
    case "reject":
    case "request_corrections":
      return "INVALID"
  }
}

/**
 * Worker BullMQ que executa o pipeline documental.
 *
 * Pipeline:
 *   ocr → extraction → validation → status-update → checklist → emit-event
 *
 * Cada step é idempotente: o primeiro passo é verificar se o documento ainda
 * existe (`repo.findById`). Se não existir, retorna sem erro (skip).
 *
 * Retentativas são tratadas pelo BullMQ (3 tentativas, backoff exponencial).
 * Após esgotar tentativas, o hook `failed` marca o documento como INVALID e
 * registra `document.processing.failed` no AuditLog.
 */
export class DocumentWorker {
  private readonly storage: StorageAdapter
  private readonly repo: DocumentRepository
  private readonly queue: QueueDocumentJob
  private readonly documentAgent: DocumentAgent
  private readonly analysisAgent: AnalysisAgent
  private readonly caseRepo: ReformCaseRepository
  private readonly prisma: PrismaClient
  private readonly eventBus?: (event: CaseDomainEvent) => Promise<void> | void
  private readonly queueManager: QueueManager
  private readonly signedUrlTtl: number

  constructor(deps: DocumentWorkerDeps) {
    this.storage = deps.storage
    this.repo = deps.repo
    this.queue = deps.queue
    this.documentAgent = deps.documentAgent
    this.analysisAgent = deps.analysisAgent
    this.caseRepo = deps.caseRepo
    this.prisma = deps.prisma
    this.eventBus = deps.eventBus
    this.queueManager = deps.queueManager ?? QueueManager.getInstance()
    this.signedUrlTtl = deps.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL
  }

  /**
   * Registra o worker BullMQ na fila `DOCUMENT_QUEUE` com a configuração de
   * retries (3 tentativas + backoff exponencial). A configuração de retries
   * é injetada via `defaultJobOptions` da `Queue` (não no Worker — Worker
   * apenas lê `job.opts`).
   */
  start(): Worker<DocumentJobData> {
    // Garante que a Queue exista com defaultJobOptions de retry.
    this.queueManager.getQueue<DocumentJobData>(DOCUMENT_QUEUE, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    })

    const worker = this.queueManager.getWorker<DocumentJobData>(
      DOCUMENT_QUEUE,
      (job) => this.process(job),
      { concurrency: 1 },
    )

    worker.on("failed", async (job, err) => {
      if (!job) return
      const attempts = job.opts.attempts ?? 1
      if (job.attemptsMade < attempts) return
      try {
        await this.handlePermanentFailure(job.data, err)
      } catch {
        // Log já é tentado dentro de handlePermanentFailure; se falhou aqui,
        // não há nada que possamos fazer com segurança.
      }
    })

    return worker
  }

  async process(job: Job<DocumentJobData>): Promise<DocumentJobResult> {
    const { step } = job.data

    // Idempotência: se o documento não existe mais, encerra com sucesso.
    const doc = await this.repo.findById(job.data.documentId, job.data.tenantId)
    if (!doc) {
      return {
        success: true,
        documentId: job.data.documentId,
        step,
      }
    }

    switch (step) {
      case "ocr":
        return this.runOcr(job.data, doc)
      case "extraction":
        return this.runExtraction(job.data, doc)
      case "validation":
        return this.runValidation(job.data, doc)
      case "status-update":
        return this.runStatusUpdate(job.data, doc)
      case "checklist":
        return this.runChecklist(job.data, doc)
      case "emit-event":
        return this.runEmitEvent(job.data, doc)
      default: {
        const exhaustive: never = step
        throw new Error(`Unknown DocumentJobStep: ${String(exhaustive)}`)
      }
    }
  }

  // ─── steps ──────────────────────────────────────────────────────────

  private async runOcr(
    data: DocumentJobData,
    _doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    const url = await this.storage.getSignedUrl(data.storageKey, this.signedUrlTtl)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Falha ao baixar documento: HTTP ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let extractedText = ""
    if (data.mimeType === "application/pdf") {
      extractedText = await this.extractTextFromPdf(buffer)
    } else if (data.mimeType.startsWith("image/")) {
      extractedText = await this.extractTextFromImage(buffer)
    }

    await this.repo.updateExtractedData(
      data.documentId,
      { extractedText },
      data.tenantId,
    )

    await this.queue.enqueue({ ...data, step: "extraction" })

    return { success: true, documentId: data.documentId, step: "ocr" }
  }

  private async runExtraction(
    data: DocumentJobData,
    doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    const text = doc.extractedText ?? ""
    if (text.trim().length === 0) {
      // Sem texto extraído: pipeline segue assim mesmo; a análise saberá lidar.
      await this.queue.enqueue({ ...data, step: "validation" })
      return { success: true, documentId: data.documentId, step: "extraction" }
    }

    const result = await this.documentAgent.extract(text, doc.type)

    await this.repo.updateExtractedData(
      data.documentId,
      {
        extractedData: result.extractedFields,
        inconsistencies: {
          warnings: result.warnings,
          confidence: result.confidence,
        },
      },
      data.tenantId,
    )

    await this.queue.enqueue({ ...data, step: "validation" })

    return { success: true, documentId: data.documentId, step: "extraction" }
  }

  private async runValidation(
    data: DocumentJobData,
    _doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    const allDocs = await this.repo.findByCaseId(data.caseId, data.tenantId)
    const inputs: AnalysisAgentInput[] = allDocs
      .filter((d) => d.extractedData !== null && d.extractedData !== undefined)
      .map((d) => ({
        type: d.type,
        extractedData: d.extractedData as Record<string, unknown>,
      }))

    const analysis = await this.analysisAgent.analyze(inputs)
    const nextStatus = recommendationToStatus(analysis.recommendation)

    await this.repo.updateExtractedData(
      data.documentId,
      {
        pendencies: {
          items: analysis.pendencies,
          inconsistencies: analysis.inconsistencies,
          recommendation: analysis.recommendation,
          reasoning: analysis.reasoning,
        },
      },
      data.tenantId,
    )

    await this.repo.updateStatus(data.documentId, nextStatus, data.tenantId)

    await this.queue.enqueue({ ...data, step: "status-update" })

    return { success: true, documentId: data.documentId, step: "validation" }
  }

  /**
   * Mantido como step explícito por fazer parte do contrato em
   * `queue/types.ts`. Hoje é no-op idempotente: o status já foi gravado em
   * `validation`. Apenas re-lê e enfileira `checklist`.
   */
  private async runStatusUpdate(
    data: DocumentJobData,
    _doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    await this.queue.enqueue({ ...data, step: "checklist" })
    return { success: true, documentId: data.documentId, step: "status-update" }
  }

  private async runChecklist(
    data: DocumentJobData,
    _doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    const reformCase = await this.caseRepo.findById(data.caseId, data.tenantId)
    const riskLevel = reformCase?.riskLevel ?? "LOW"

    const docs = await this.repo.findByCaseId(data.caseId, data.tenantId)
    const checklist = DocumentChecklist.evaluate(riskLevel, docs)

    const allValid =
      checklist.complete && docs.every((d) => FINAL_STATUSES.has(d.status))

    if (this.eventBus) {
      await this.eventBus({
        type: "checklist.updated",
        caseId: data.caseId,
        tenantId: data.tenantId,
        allDocumentsValid: allValid,
        pendingDocuments: checklist.missing.map(String),
        timestamp: new Date(),
      })
    }

    await this.queue.enqueue({ ...data, step: "emit-event" })

    return { success: true, documentId: data.documentId, step: "checklist" }
  }

  private async runEmitEvent(
    data: DocumentJobData,
    doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    if (this.eventBus) {
      await this.eventBus({
        type: "document.processed",
        caseId: data.caseId,
        tenantId: data.tenantId,
        documentId: data.documentId,
        status: doc.status,
        timestamp: new Date(),
      })
    }

    const reformCase = await this.caseRepo.findById(data.caseId, data.tenantId)
    if (!reformCase) {
      return { success: true, documentId: data.documentId, step: "emit-event" }
    }

    const docs = await this.repo.findByCaseId(data.caseId, data.tenantId)
    const allValid = docs.length > 0 && docs.every((d) => FINAL_STATUSES.has(d.status))

    if (reformCase.status === "AWAITING_DOCUMENTS" && allValid) {
      await this.transitionToUnderReview(reformCase)
    }

    return { success: true, documentId: data.documentId, step: "emit-event" }
  }

  private async transitionToUnderReview(reformCase: ReformCase): Promise<void> {
    const machine = new CaseStateMachine(reformCase.status, reformCase.riskLevel)
    const nextStatus = machine.transition("DOCUMENTS_UNDER_REVIEW", {
      triggeredBy: "system",
      previousStatus: reformCase.status,
    })

    await this.prisma.$transaction(async (tx) => {
      await tx.reformCase.update({
        where: { id: reformCase.id },
        data: { status: nextStatus },
      })

      await tx.caseTransitionLog.create({
        data: {
          caseId: reformCase.id,
          fromStatus: reformCase.status,
          toStatus: nextStatus,
          triggeredBy: "system",
          reason: "documents.processed",
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: reformCase.tenantId,
          caseId: reformCase.id,
          action: "case.status.changed",
          triggeredBy: "system",
          details: {
            from: reformCase.status,
            to: nextStatus,
            reason: "documents.processed",
          },
        },
      })
    })
  }

  // ─── failure handling ───────────────────────────────────────────────

  private async handlePermanentFailure(
    data: DocumentJobData,
    err: Error,
  ): Promise<void> {
    await this.repo.updateStatus(data.documentId, "INVALID", data.tenantId)
    await this.prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        caseId: data.caseId,
        action: "document.processing.failed",
        triggeredBy: "system",
        details: {
          documentId: data.documentId,
          step: data.step satisfies DocumentJobStep,
          error: err.message,
        },
      },
    })
  }

  // ─── OCR helpers ────────────────────────────────────────────────────

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    // `pdf-parse@2.x` expõe a classe `PDFParse`. Import dinâmico evita
    // carregar o módulo (e suas dependências de canvas) até o primeiro uso.
    const { PDFParse } = await import("pdf-parse")
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const result = await parser.getText()
      return result.text ?? ""
    } finally {
      try {
        await parser.destroy()
      } catch {
        // ignore destroy errors
      }
    }
  }

  private async extractTextFromImage(buffer: Buffer): Promise<string> {
    const tesseract = await import("tesseract.js")
    const result = await tesseract.recognize(buffer, "por")
    return result.data.text ?? ""
  }
}
