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

  // PrismaClient mock: o worker chama prisma.$transaction e prisma.auditLog.
  // Os mocks de tx são compartilhados entre invocações para permitir asserções.
  const txMocks = {
    reformCase: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    caseTransitionLog: { create: vi.fn().mockResolvedValue(undefined) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  }
  const prisma = {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txMocks)),
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  } as unknown as PrismaClient

  const eventBus = vi.fn().mockResolvedValue(undefined)
  const notifications = vi.fn().mockResolvedValue(undefined)

  return {
    storage,
    repo,
    queue,
    documentAgent,
    analysisAgent,
    caseRepo,
    prisma,
    eventBus,
    notifications,
    txMocks,
  }
}

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    protocol: "RF-2026-0001",
    tenantId: "tenant-1",
    condominiumId: "condo-1",
    unitId: "unit-1",
    clientId: "client-1",
    status: "AWAITING_DOCUMENTS",
    riskLevel: "LOW",
    requiresART: false,
    triageScore: 10,
    reformScope: null,
    evaluationResult: null,
    partnerId: null,
    commercialPlanId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
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

  it("step 'validation': enfileira 'checklist' diretamente (sem status-update)", async () => {
    const deps = makeDeps()
    const doc = makeDocument({ extractedData: { art: "123" } })
    ;(deps.repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(doc)
    ;(deps.repo.findByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue([doc])
    ;(deps.analysisAgent.analyze as ReturnType<typeof vi.fn>).mockResolvedValue({
      consistent: true,
      inconsistencies: [],
      pendencies: [],
      recommendation: "approve",
      reasoning: "ok",
    })

    const worker = new DocumentWorker(deps)
    await worker.process(makeJob({ step: "validation" }))

    expect(deps.repo.updateStatus).toHaveBeenCalledWith("doc-1", "VALID", "tenant-1")
    const enqueued = (deps.queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(enqueued?.step).toBe("checklist")
  })

  describe("step 'emit-event': resolução determinística pós-análise", () => {
    function setupEmitEvent(
      deps: ReturnType<typeof makeDeps>,
      caseOverrides: Record<string, unknown>,
      docs: DocumentRecord[],
    ) {
      ;(deps.repo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(docs[0] ?? null)
      ;(deps.repo.findByCaseId as ReturnType<typeof vi.fn>).mockResolvedValue(docs)
      ;(deps.caseRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeCase(caseOverrides),
      )
    }

    it("risco LOW + tudo VALID: AWAITING_DOCUMENTS → DOCUMENTS_UNDER_REVIEW → ELIGIBLE_FOR_RELEASE", async () => {
      const deps = makeDeps()
      const doc = makeDocument({
        status: "VALID",
        pendencies: { recommendation: "approve", reasoning: "tudo ok" },
      })
      setupEmitEvent(deps, { status: "AWAITING_DOCUMENTS", riskLevel: "LOW" }, [doc])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      const calls = deps.txMocks.reformCase.updateMany.mock.calls
      expect(calls).toHaveLength(2)
      expect(calls[0]?.[0]).toEqual({
        where: { id: "case-1", status: "AWAITING_DOCUMENTS" },
        data: { status: "DOCUMENTS_UNDER_REVIEW" },
      })
      expect(calls[1]?.[0]).toEqual({
        where: { id: "case-1", status: "DOCUMENTS_UNDER_REVIEW" },
        data: { status: "ELIGIBLE_FOR_RELEASE" },
      })

      // Notificação fire-and-forget disparada para ambas as transições
      expect(deps.notifications).toHaveBeenCalledWith(
        expect.objectContaining({ toStatus: "ELIGIBLE_FOR_RELEASE", caseId: "case-1" }),
      )
    })

    it("risco HIGH + tudo VALID: vai para HUMAN_REVIEW_REQUIRED (nunca direto para release)", async () => {
      const deps = makeDeps()
      const docs = [
        makeDocument({ id: "d1", type: DocumentType.AUTHORIZATION, status: "VALID" }),
        makeDocument({ id: "d2", type: DocumentType.ART_RRT, status: "VALID" }),
        makeDocument({ id: "d3", type: DocumentType.MEMORIAL, status: "VALID" }),
      ]
      setupEmitEvent(deps, { status: "DOCUMENTS_UNDER_REVIEW", riskLevel: "HIGH" }, docs)

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      const calls = deps.txMocks.reformCase.updateMany.mock.calls
      expect(calls).toHaveLength(1)
      expect(calls[0]?.[0]).toEqual({
        where: { id: "case-1", status: "DOCUMENTS_UNDER_REVIEW" },
        data: { status: "HUMAN_REVIEW_REQUIRED" },
      })
    })

    it("documento INVALID em DOCUMENTS_UNDER_REVIEW: vai para PENDING_CORRECTIONS", async () => {
      const deps = makeDeps()
      const doc = makeDocument({ status: "INVALID" })
      setupEmitEvent(deps, { status: "DOCUMENTS_UNDER_REVIEW", riskLevel: "LOW" }, [doc])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      const calls = deps.txMocks.reformCase.updateMany.mock.calls
      expect(calls).toHaveLength(1)
      expect(calls[0]?.[0]).toEqual({
        where: { id: "case-1", status: "DOCUMENTS_UNDER_REVIEW" },
        data: { status: "PENDING_CORRECTIONS" },
      })
    })

    it("reenvio corrigido: INVALID antigo do mesmo tipo não bloqueia a liberação", async () => {
      const deps = makeDeps()
      const oldInvalid = makeDocument({
        id: "d-old",
        status: "INVALID",
        uploadedAt: new Date("2026-01-01T00:00:00Z"),
      })
      const newValid = makeDocument({
        id: "d-new",
        status: "VALID",
        uploadedAt: new Date("2026-01-02T00:00:00Z"),
      })
      setupEmitEvent(deps, { status: "PENDING_CORRECTIONS", riskLevel: "LOW" }, [
        oldInvalid,
        newValid,
      ])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      const statuses = deps.txMocks.reformCase.updateMany.mock.calls.map(
        (c) => (c[0] as { data: { status: string } }).data.status,
      )
      expect(statuses).toEqual(["DOCUMENTS_UNDER_REVIEW", "ELIGIBLE_FOR_RELEASE"])
    })

    it("algum VALID_WITH_CAVEATS (risco LOW): vai para RELEASED_WITH_CONDITIONS", async () => {
      const deps = makeDeps()
      const doc = makeDocument({ status: "VALID_WITH_CAVEATS" })
      setupEmitEvent(deps, { status: "DOCUMENTS_UNDER_REVIEW", riskLevel: "LOW" }, [doc])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      const calls = deps.txMocks.reformCase.updateMany.mock.calls
      expect(calls).toHaveLength(1)
      expect(calls[0]?.[0]).toEqual({
        where: { id: "case-1", status: "DOCUMENTS_UNDER_REVIEW" },
        data: { status: "RELEASED_WITH_CONDITIONS" },
      })
    })

    it("documento ainda PROCESSING: nenhuma transição é aplicada", async () => {
      const deps = makeDeps()
      const doc = makeDocument({ status: "PROCESSING" })
      setupEmitEvent(deps, { status: "DOCUMENTS_UNDER_REVIEW", riskLevel: "LOW" }, [doc])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      expect(deps.txMocks.reformCase.updateMany).not.toHaveBeenCalled()
    })

    it("transição concorrente (updateMany count 0): não grava log nem notifica", async () => {
      const deps = makeDeps()
      deps.txMocks.reformCase.updateMany.mockResolvedValue({ count: 0 })
      const doc = makeDocument({ status: "VALID" })
      setupEmitEvent(deps, { status: "AWAITING_DOCUMENTS", riskLevel: "LOW" }, [doc])

      const worker = new DocumentWorker(deps)
      await worker.process(makeJob({ step: "emit-event" }))

      expect(deps.txMocks.caseTransitionLog.create).not.toHaveBeenCalled()
      expect(deps.notifications).not.toHaveBeenCalled()
    })
  })
})
