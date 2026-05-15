import { beforeEach, describe, expect, it, vi } from "vitest"
import { DocumentType, DocOrigin, type PrismaClient } from "@reformai/database"
import type { Job } from "bullmq"
import type { ReformCaseRepository } from "@/modules/case-intake/domain/repositories/ReformCaseRepository"
import type {
  DocumentRecord,
  DocumentRepository,
} from "@/modules/document-management/domain/repositories/DocumentRepository"
import type { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import type { AnalysisAgent } from "@/modules/document-intelligence/domain/AnalysisAgent"
import type { DocumentAgent } from "@/modules/document-intelligence/domain/DocumentAgent"
import type { StorageAdapter } from "@/infrastructure/storage/StorageAdapter"
import { DocumentWorker } from "../DocumentWorker"
import type { DocumentJobData, DocumentJobStep } from "../types"

function makeDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "doc-1",
    caseId: "case-1",
    tenantId: "tenant-1",
    type: DocumentType.ART_RRT,
    version: 1,
    fileName: "art.pdf",
    storageKey: "tenants/tenant-1/.../art.pdf",
    mimeType: "application/pdf",
    status: "PENDING",
    origin: DocOrigin.CLIENT,
    extractedText: null,
    extractedData: null,
    inconsistencies: null,
    pendencies: null,
    uploadedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as unknown as DocumentRecord
}

function makeJob(data: Partial<DocumentJobData> & { step: DocumentJobStep }): Job<DocumentJobData> {
  const merged: DocumentJobData = {
    caseId: "case-1",
    documentId: "doc-1",
    tenantId: "tenant-1",
    storageKey: "tenants/tenant-1/.../art.pdf",
    mimeType: "application/pdf",
    ...data,
  }
  return { data: merged } as unknown as Job<DocumentJobData>
}

function makeDeps() {
  const storage: StorageAdapter = {
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue("https://example/signed"),
    delete: vi.fn().mockResolvedValue(undefined),
  }

  const repo: DocumentRepository = {
    create: vi.fn(),
    findById: vi.fn(),
    findByCaseId: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    updateExtractedData: vi.fn().mockResolvedValue(undefined),
  }

  const queue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueueDocumentJob

  const documentAgent: DocumentAgent = {
    extract: vi.fn(),
  }

  const analysisAgent: AnalysisAgent = {
    analyze: vi.fn(),
  }

  const caseRepo: ReformCaseRepository = {
    create: vi.fn(),
    findById: vi.fn().mockResolvedValue(null),
    listByTenant: vi.fn().mockResolvedValue([]),
    applyScopeClassification: vi.fn(),
    appendMessage: vi.fn(),
    listMessages: vi.fn(),
  }

  // PrismaClient mock: o worker chama prisma.$transaction e prisma.auditLog
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        reformCase: { update: vi.fn().mockResolvedValue(undefined) },
        caseTransitionLog: { create: vi.fn().mockResolvedValue(undefined) },
        auditLog: { create: vi.fn().mockResolvedValue(undefined) },
      }),
    ),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  } as unknown as PrismaClient

  const eventBus = vi.fn().mockResolvedValue(undefined)

  return { storage, repo, queue, documentAgent, analysisAgent, caseRepo, prisma, eventBus }
}

describe("DocumentWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("step 'extraction': extrai dados, persiste e enfileira 'validation'", async () => {
    const deps = makeDeps()
    const doc = makeDocument({
      extractedText: "algum texto",
      type: DocumentType.ART_RRT,
    })
    ;(deps.repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc)
    ;(deps.documentAgent.extract as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentType: "ART_RRT",
      extractedFields: { art: "123" },
      confidence: 0.9,
      warnings: [],
    })

    const worker = new DocumentWorker(deps)
    const job = makeJob({ step: "extraction" })

    const result = await worker.process(job)

    expect(result.success).toBe(true)
    expect(result.step).toBe("extraction")

    expect(deps.documentAgent.extract).toHaveBeenCalledWith("algum texto", DocumentType.ART_RRT)

    const updateCall = (deps.repo.updateExtractedData as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(updateCall?.[0]).toBe("doc-1")
    expect(updateCall?.[1]).toEqual({
      extractedData: { art: "123" },
      inconsistencies: { warnings: [], confidence: 0.9 },
    })
    expect(updateCall?.[2]).toBe("tenant-1")

    expect(deps.queue.enqueue).toHaveBeenCalledTimes(1)
    const enqueued = (deps.queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(enqueued).toMatchObject({
      caseId: "case-1",
      documentId: "doc-1",
      tenantId: "tenant-1",
      step: "validation",
    })
  })

  it("step 'extraction' com confiança zero e warnings: ainda persiste e enfileira 'validation'", async () => {
    const deps = makeDeps()
    const doc = makeDocument({
      extractedText: "texto ruidoso",
      type: DocumentType.MEMORIAL,
    })
    ;(deps.repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc)
    ;(deps.documentAgent.extract as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentType: "MEMORIAL",
      extractedFields: {},
      confidence: 0,
      warnings: ["parse error"],
    })

    const worker = new DocumentWorker(deps)
    const job = makeJob({ step: "extraction" })

    await worker.process(job)

    expect(deps.repo.updateExtractedData).toHaveBeenCalledTimes(1)
    const updateCall = (deps.repo.updateExtractedData as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(updateCall?.[1]).toEqual({
      extractedData: {},
      inconsistencies: { warnings: ["parse error"], confidence: 0 },
    })

    expect(deps.queue.enqueue).toHaveBeenCalledTimes(1)
    const enqueued = (deps.queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(enqueued?.step).toBe("validation")
  })

  it("step 'ocr' quando documento não existe: skip, sem chamadas a storage", async () => {
    const deps = makeDeps()
    ;(deps.repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const worker = new DocumentWorker(deps)
    const job = makeJob({ step: "ocr" })

    const result = await worker.process(job)

    expect(result.success).toBe(true)
    expect(deps.storage.getSignedUrl).not.toHaveBeenCalled()
    expect(deps.queue.enqueue).not.toHaveBeenCalled()
    expect(deps.repo.updateExtractedData).not.toHaveBeenCalled()
  })
})
