import { describe, expect, it, vi, beforeEach } from "vitest"
import { DocumentType, DocOrigin } from "@reformai/database"
import { ValidationError } from "@/shared/errors/DomainError"
import type { StorageAdapter } from "@/infrastructure/storage/StorageAdapter"
import type {
  CreateDocumentInput,
  DocumentRecord,
  DocumentRepository,
} from "../../domain/repositories/DocumentRepository"
import type { QueueDocumentJob } from "../../infrastructure/QueueDocumentJob"
import { UploadDocumentUseCase } from "../UploadDocumentUseCase"

function makeDeps() {
  const storage = {
    upload: vi.fn<StorageAdapter["upload"]>().mockResolvedValue(undefined),
    getSignedUrl: vi.fn<StorageAdapter["getSignedUrl"]>().mockResolvedValue("https://example/signed"),
    delete: vi.fn<StorageAdapter["delete"]>().mockResolvedValue(undefined),
  } satisfies StorageAdapter

  const created: DocumentRecord = {
    id: "doc-1",
    caseId: "case-1",
    tenantId: "tenant-1",
    type: DocumentType.PROJECT,
    version: 1,
    fileName: "memorial.pdf",
    storageKey: "irrelevant-in-mock",
    mimeType: "application/pdf",
    status: "PENDING",
    origin: DocOrigin.CLIENT,
    extractedText: null,
    extractedData: null,
    inconsistencies: null,
    pendencies: null,
    uploadedAt: new Date("2026-01-01T00:00:00Z"),
  } as unknown as DocumentRecord

  const repo: DocumentRepository = {
    create: vi.fn<DocumentRepository["create"]>().mockImplementation(async (input: CreateDocumentInput) => ({
      ...created,
      tenantId: input.tenantId,
      caseId: input.caseId,
      fileName: input.fileName,
      storageKey: input.storageKey,
      mimeType: input.mimeType,
      type: input.type,
      origin: input.origin,
    })),
    findById: vi.fn(),
    findByCaseId: vi.fn(),
    updateStatus: vi.fn(),
    updateExtractedData: vi.fn(),
  }

  const queue = {
    enqueue: vi.fn<QueueDocumentJob["enqueue"]>().mockResolvedValue(undefined),
  } as unknown as QueueDocumentJob

  return { storage, repo, queue }
}

const baseInput = {
  caseId: "case-1",
  tenantId: "tenant-1",
  condominiumId: "cond-1",
  unitId: "unit-1",
  buffer: Buffer.from("conteudo"),
  fileName: "memorial.pdf",
  mimeType: "application/pdf",
  documentType: DocumentType.MEMORIAL,
  origin: DocOrigin.CLIENT,
}

describe("UploadDocumentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("faz upload no storage, persiste o documento e enfileira step 'ocr'", async () => {
    const { storage, repo, queue } = makeDeps()
    const useCase = new UploadDocumentUseCase({ storage, repo, queue })

    const doc = await useCase.execute(baseInput)

    expect(storage.upload).toHaveBeenCalledTimes(1)
    const uploadArgs = (storage.upload as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(uploadArgs?.[0]).toMatch(
      /^tenants\/tenant-1\/condominiums\/cond-1\/units\/unit-1\/cases\/case-1\/incoming\/[0-9a-f-]+\/memorial\.pdf$/,
    )
    expect(uploadArgs?.[1]).toBe(baseInput.buffer)
    expect(uploadArgs?.[2]).toBe("application/pdf")

    expect(repo.create).toHaveBeenCalledTimes(1)
    const createArg = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(createArg.tenantId).toBe("tenant-1")
    expect(createArg.caseId).toBe("case-1")
    expect(createArg.type).toBe(DocumentType.MEMORIAL)
    expect(createArg.origin).toBe(DocOrigin.CLIENT)
    expect(createArg.storageKey).toBe(uploadArgs?.[0])

    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    const jobArg = (queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(jobArg).toEqual({
      caseId: "case-1",
      documentId: doc.id,
      tenantId: "tenant-1",
      storageKey: uploadArgs?.[0],
      mimeType: "application/pdf",
      step: "ocr",
    })
  })

  it("rejeita mimeType não permitido com ValidationError e não toca storage/repo/queue", async () => {
    const { storage, repo, queue } = makeDeps()
    const useCase = new UploadDocumentUseCase({ storage, repo, queue })

    await expect(
      useCase.execute({ ...baseInput, mimeType: "application/exe" }),
    ).rejects.toBeInstanceOf(ValidationError)

    expect(storage.upload).not.toHaveBeenCalled()
    expect(repo.create).not.toHaveBeenCalled()
    expect(queue.enqueue).not.toHaveBeenCalled()
  })

  it("propaga tenantId para storageKey, repo.create e queue.enqueue (isolamento multi-tenant)", async () => {
    const { storage, repo, queue } = makeDeps()
    const useCase = new UploadDocumentUseCase({ storage, repo, queue })

    await useCase.execute({ ...baseInput, tenantId: "tenant-XYZ" })

    const uploadArgs = (storage.upload as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(uploadArgs?.[0]).toContain("tenants/tenant-XYZ/")

    const createArg = (repo.create as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(createArg.tenantId).toBe("tenant-XYZ")
    expect(createArg.storageKey).toContain("tenants/tenant-XYZ/")

    const jobArg = (queue.enqueue as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]
    expect(jobArg.tenantId).toBe("tenant-XYZ")
    expect(jobArg.storageKey).toContain("tenants/tenant-XYZ/")
  })

  it("aceita os mimeTypes permitidos (pdf, jpeg, png, webp)", async () => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"]
    for (const mimeType of allowed) {
      const { storage, repo, queue } = makeDeps()
      const useCase = new UploadDocumentUseCase({ storage, repo, queue })
      await expect(useCase.execute({ ...baseInput, mimeType })).resolves.toBeDefined()
    }
  })
})
