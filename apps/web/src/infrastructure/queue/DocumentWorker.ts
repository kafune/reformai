import type { CaseStatus, DocStatus, PrismaClient, ReformCase } from "@reformai/database"
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
import { captureException } from "@/infrastructure/monitoring/sentry"
import { QueueManager } from "./QueueManager"
import {
  DOCUMENT_QUEUE,
  type DocumentJobData,
  type DocumentJobResult,
  type DocumentJobStep,
} from "./types"

/** Parâmetros de notificação de transição (mesma shape de CaseTransitionParams). */
export interface CaseTransitionNotification {
  caseId: string
  protocol: string
  toStatus: CaseStatus
  clientId: string
  tenantId: string
  condominiumId: string
}

export type CaseTransitionNotifier = (params: CaseTransitionNotification) => Promise<void>

export interface DocumentWorkerDeps {
  storage: StorageAdapter
  repo: DocumentRepository
  queue: QueueDocumentJob
  documentAgent: DocumentAgent
  analysisAgent: AnalysisAgent
  caseRepo: ReformCaseRepository
  prisma: PrismaClient
  eventBus?: (event: CaseDomainEvent) => Promise<void> | void
  /** Notificador fire-and-forget chamado após cada transição de caso aplicada. */
  notifications?: CaseTransitionNotifier
  /**
   * Fallback de extração de texto via leitura nativa do LLM — usado quando o
   * OCR local volta vazio (ex.: PDF escaneado, sem texto embutido).
   */
  documentTextFallback?: (buffer: Buffer, mimeType: string) => Promise<string>
  queueManager?: QueueManager
  /** Override do TTL (segundos) da signed URL usada para baixar o arquivo. */
  signedUrlTtlSeconds?: number
}

const DEFAULT_SIGNED_URL_TTL = 300

/** Tamanho máximo de arquivo enviado ao LLM no fallback de OCR (controle de custo). */
const MAX_LLM_OCR_BYTES = 10 * 1024 * 1024

/**
 * `pdf-parse@2.x` injeta separadores de página ("-- 1 of 2 --") entre as
 * páginas. Em PDF escaneado (sem camada de texto) esses marcadores são o ÚNICO
 * conteúdo retornado e mascaram o vazio — derrotando o gatilho do fallback de
 * OCR por visão (que dispara só quando o texto é vazio). Removê-los faz o PDF
 * sem texto ser corretamente tratado como vazio e limpa o ruído enviado à
 * etapa de extração.
 */
const PDF_PAGE_MARKER = /^[ \t]*--\s*\d+\s+of\s+\d+\s*--[ \t]*$/gim
export function stripPdfPageMarkers(text: string): string {
  return text.replace(PDF_PAGE_MARKER, "").replace(/\n{3,}/g, "\n\n").trim()
}

const FINAL_STATUSES: ReadonlySet<DocStatus> = new Set<DocStatus>([
  "VALID",
  "VALID_WITH_CAVEATS",
])

/** Há dados estruturados extraídos deste documento? (objeto não-vazio) */
function hasExtractedData(doc: DocumentRecord): boolean {
  const data = doc.extractedData
  return (
    data != null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Object.keys(data as Record<string, unknown>).length > 0
  )
}

/**
 * Status do DOCUMENTO — reflete a legibilidade/coerência do próprio documento,
 * não o veredito do conjunto do caso.
 *
 * - Documento sem dados extraídos é ilegível/vazio → INVALID, independente da
 *   recomendação de caso.
 * - `reject` é veredito sobre o documento (ex.: alteração de fachada,
 *   contradição) → INVALID.
 * - `request_corrections` é veredito de CASO (faltam/corrigir documentos do
 *   conjunto). Não invalida um documento legível: ele permanece VALID e o caso
 *   é roteado para PENDING_CORRECTIONS por `resolveReviewOutcome`.
 */
function resolveDocumentStatus(
  recommendation: DocumentAnalysisResult["recommendation"],
  documentReadable: boolean,
): DocStatus {
  if (!documentReadable) return "INVALID"
  switch (recommendation) {
    case "approve":
    case "request_corrections":
      return "VALID"
    case "approve_with_caveats":
      return "VALID_WITH_CAVEATS"
    case "reject":
      return "INVALID"
  }
}

/**
 * Recomendação da análise mais recente do caso. Cada validação reavalia o
 * conjunto inteiro e grava o resultado no documento que a disparou; o documento
 * enviado por último carrega o veredito de caso mais atual.
 */
function latestCaseRecommendation(latestDocs: DocumentRecord[]): string | null {
  let newest: DocumentRecord | null = null
  for (const d of latestDocs) {
    if (!newest || d.uploadedAt > newest.uploadedAt) newest = d
  }
  const pend = (newest?.pendencies ?? null) as { recommendation?: string } | null
  return pend?.recommendation ?? null
}

/**
 * Retorna o documento mais recente de cada tipo. Um reenvio corrigido
 * substitui o anterior do mesmo tipo na avaliação do caso — sem isso, um
 * documento INVALID antigo bloquearia a liberação para sempre.
 */
function latestDocsPerType(docs: DocumentRecord[]): DocumentRecord[] {
  const byType = new Map<string, DocumentRecord>()
  for (const doc of docs) {
    const current = byType.get(doc.type)
    if (!current || doc.uploadedAt > current.uploadedAt) {
      byType.set(doc.type, doc)
    }
  }
  return [...byType.values()]
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
 * Após esgotar tentativas, o hook `failed` marca o documento como INVALID
 * (ou PENDING, se a falha foi no step "validation" — análise indisponível não
 * é veredito) e registra `document.processing.failed` no AuditLog.
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
  private readonly notifications?: CaseTransitionNotifier
  private readonly documentTextFallback?: (buffer: Buffer, mimeType: string) => Promise<string>
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
    this.notifications = deps.notifications
    this.documentTextFallback = deps.documentTextFallback
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

    // PDF escaneado (sem texto embutido): pdf-parse volta vazio. Fallback de
    // leitura nativa pelo LLM, com teto de tamanho para controlar custo.
    // Sem try/catch que engula o erro: uma falha (transitória) do fallback deve
    // ser re-tentada pelo BullMQ (3x, backoff) — não virar texto vazio e, em
    // seguida, um veredito INVALID silencioso sobre o documento. Esgotadas as
    // tentativas, `handlePermanentFailure` registra o erro no AuditLog.
    if (
      extractedText.trim().length === 0 &&
      data.mimeType === "application/pdf" &&
      this.documentTextFallback &&
      buffer.length <= MAX_LLM_OCR_BYTES
    ) {
      extractedText = await this.documentTextFallback(buffer, data.mimeType)
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
    doc: DocumentRecord,
  ): Promise<DocumentJobResult> {
    const allDocs = await this.repo.findByCaseId(data.caseId, data.tenantId)
    const inputs: AnalysisAgentInput[] = allDocs
      .filter((d) => d.extractedData !== null && d.extractedData !== undefined)
      .map((d) => ({
        type: d.type,
        extractedData: d.extractedData as Record<string, unknown>,
      }))

    // O escopo declarado na triagem é a base de comparação: a análise avalia
    // impacto predial e cobertura documental, não a qualidade da obra.
    const reformCase = await this.caseRepo.findById(data.caseId, data.tenantId)
    const analysis = await this.analysisAgent.analyze(inputs, {
      reformScope: (reformCase?.reformScope as Record<string, unknown> | null) ?? null,
      riskLevel: reformCase?.riskLevel ?? null,
    })

    if (analysis.degraded) {
      // Falha técnica da análise (LLM indisponível/resposta inválida) — não é
      // veredito sobre o documento. Persiste o motivo para auditoria/UI e
      // lança para o BullMQ re-tentar (3x, backoff exponencial). Esgotadas as
      // tentativas, handlePermanentFailure devolve o documento a PENDING.
      await this.repo.updateExtractedData(
        data.documentId,
        {
          pendencies: {
            items: analysis.pendencies,
            inconsistencies: analysis.inconsistencies,
            recommendation: null,
            reasoning: analysis.reasoning,
            degraded: true,
          },
        },
        data.tenantId,
      )
      throw new Error(analysis.reasoning)
    }

    const nextStatus = resolveDocumentStatus(analysis.recommendation, hasExtractedData(doc))

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

    // O status já foi gravado acima — o step "status-update" era no-op e foi
    // retirado do fluxo. Segue direto para "checklist".
    await this.queue.enqueue({ ...data, step: "checklist" })

    return { success: true, documentId: data.documentId, step: "validation" }
  }

  /**
   * Step legado, mantido apenas para compatibilidade com jobs já enfileirados
   * antes do deploy. Novos fluxos vão de `validation` direto para `checklist`.
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
    // A avaliação considera o documento mais recente de cada tipo: um reenvio
    // corrigido substitui o anterior (que permanece no histórico do caso).
    const latestDocs = latestDocsPerType(docs)
    const checklist = DocumentChecklist.evaluate(reformCase.riskLevel ?? "LOW", docs)
    const allValid =
      checklist.complete &&
      latestDocs.length > 0 &&
      latestDocs.every((d) => FINAL_STATUSES.has(d.status))

    let currentStatus = reformCase.status
    if (
      (currentStatus === "AWAITING_DOCUMENTS" || currentStatus === "PENDING_CORRECTIONS") &&
      allValid
    ) {
      const applied = await this.transitionCase(
        reformCase,
        currentStatus,
        "DOCUMENTS_UNDER_REVIEW",
        "documents.processed",
        doc,
      )
      if (applied) currentStatus = "DOCUMENTS_UNDER_REVIEW"
    }

    // IA sugere → regra determinística valida → CaseStateMachine executa.
    if (currentStatus === "DOCUMENTS_UNDER_REVIEW") {
      const next = this.resolveReviewOutcome(reformCase, latestDocs, checklist.complete)
      if (next) {
        await this.transitionCase(
          reformCase,
          currentStatus,
          next,
          "documents.analysis.resolved",
          doc,
        )
      }
    }

    return { success: true, documentId: data.documentId, step: "emit-event" }
  }

  /**
   * Decide, de forma determinística, o destino de um caso em
   * DOCUMENTS_UNDER_REVIEW após o processamento dos documentos:
   *
   *   - algum documento INVALID ou checklist incompleto → PENDING_CORRECTIONS
   *   - risco HIGH/CRITICAL ou regra requiresHumanReview → HUMAN_REVIEW_REQUIRED
   *   - tudo VALID                                       → ELIGIBLE_FOR_RELEASE
   *   - algum VALID_WITH_CAVEATS                         → RELEASED_WITH_CONDITIONS
   *
   * Retorna null enquanto houver documento ainda em processamento.
   */
  private resolveReviewOutcome(
    reformCase: ReformCase,
    latestDocs: DocumentRecord[],
    checklistComplete: boolean,
  ): CaseStatus | null {
    if (latestDocs.length === 0) return null
    const processed = latestDocs.every(
      (d) => d.status !== "PENDING" && d.status !== "PROCESSING",
    )
    if (!processed) return null

    // `request_corrections` é veredito de CASO: o documento pode estar legível
    // (VALID), mas o conjunto precisa de correções/documentos. Roteia o caso
    // sem depender de um documento marcado INVALID.
    const hasInvalid = latestDocs.some((d) => d.status === "INVALID")
    const needsCorrections = latestCaseRecommendation(latestDocs) === "request_corrections"
    if (hasInvalid || needsCorrections || !checklistComplete) return "PENDING_CORRECTIONS"

    const evaluation = reformCase.evaluationResult as { requiresHumanReview?: boolean } | null
    const isHighRisk = reformCase.riskLevel === "HIGH" || reformCase.riskLevel === "CRITICAL"
    if (isHighRisk || evaluation?.requiresHumanReview === true) {
      return "HUMAN_REVIEW_REQUIRED"
    }

    const hasCaveats = latestDocs.some((d) => d.status === "VALID_WITH_CAVEATS")
    return hasCaveats ? "RELEASED_WITH_CONDITIONS" : "ELIGIBLE_FOR_RELEASE"
  }

  /**
   * Aplica uma transição de caso de forma idempotente entre jobs concorrentes:
   * o UPDATE é condicionado ao status de origem (`updateMany` + count). Se
   * outro job já transicionou o caso, retorna false sem efeito colateral.
   */
  private async transitionCase(
    reformCase: ReformCase,
    fromStatus: CaseStatus,
    toStatus: CaseStatus,
    reason: string,
    doc?: DocumentRecord,
  ): Promise<boolean> {
    const machine = new CaseStateMachine(fromStatus, reformCase.riskLevel)
    machine.transition(toStatus, {
      triggeredBy: "system",
      previousStatus: fromStatus,
      reason,
    })

    const analysis = (doc?.pendencies ?? null) as {
      recommendation?: string
      reasoning?: string
    } | null

    const applied = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.reformCase.updateMany({
        where: { id: reformCase.id, status: fromStatus },
        data: { status: toStatus },
      })
      if (updated.count === 0) return false

      await tx.caseTransitionLog.create({
        data: {
          caseId: reformCase.id,
          fromStatus,
          toStatus,
          triggeredBy: "system",
          reason,
        },
      })

      await tx.auditLog.create({
        data: {
          tenantId: reformCase.tenantId,
          caseId: reformCase.id,
          action: "case.status.changed",
          triggeredBy: "system",
          details: { from: fromStatus, to: toStatus, reason },
          ...(analysis?.recommendation || analysis?.reasoning
            ? {
                aiReasoning: {
                  recommendation: analysis.recommendation ?? null,
                  reasoning: analysis.reasoning ?? null,
                },
              }
            : {}),
        },
      })

      return true
    })

    if (applied && this.notifications) {
      this.notifications({
        caseId: reformCase.id,
        protocol: reformCase.protocol,
        toStatus,
        clientId: reformCase.clientId,
        tenantId: reformCase.tenantId,
        condominiumId: reformCase.condominiumId,
      }).catch(() => {
        // Notificação é fire-and-forget — falha nunca derruba o job.
      })
    }

    return applied
  }

  // ─── failure handling ───────────────────────────────────────────────

  private async handlePermanentFailure(
    data: DocumentJobData,
    err: Error,
  ): Promise<void> {
    captureException(err, {
      route: "worker.document.permanent_failure",
      tenantId: data.tenantId,
      caseId: data.caseId,
      documentId: data.documentId,
      step: data.step,
    })
    // Falha permanente em "validation" significa análise automática
    // indisponível — não é veredito sobre o documento. Volta a PENDING para
    // permitir reanálise (POST /documents/analyze re-enfileira PENDING).
    // Falhas nos demais steps (ex.: arquivo ilegível no OCR) seguem INVALID.
    const failureStatus: DocStatus = data.step === "validation" ? "PENDING" : "INVALID"
    await this.repo.updateStatus(data.documentId, failureStatus, data.tenantId)
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
      return stripPdfPageMarkers(result.text ?? "")
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
