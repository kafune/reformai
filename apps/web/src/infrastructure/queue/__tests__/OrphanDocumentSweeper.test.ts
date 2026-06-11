import { describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@reformai/database"
import type { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { OrphanDocumentSweeper } from "../OrphanDocumentSweeper"

function makeDeps(orphans: unknown[]) {
  const prisma = {
    document: { findMany: vi.fn().mockResolvedValue(orphans) },
  } as unknown as PrismaClient
  const queue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueueDocumentJob
  return { prisma, queue }
}

describe("OrphanDocumentSweeper", () => {
  it("reenfileira documentos PENDING antigos a partir do step 'ocr'", async () => {
    const deps = makeDeps([
      {
        id: "doc-1",
        caseId: "case-1",
        tenantId: "tenant-1",
        storageKey: "tenants/tenant-1/.../a.pdf",
        mimeType: "application/pdf",
      },
    ])
    const sweeper = new OrphanDocumentSweeper(deps)

    const requeued = await sweeper.sweep()

    expect(requeued).toBe(1)
    expect(deps.queue.enqueue).toHaveBeenCalledWith({
      caseId: "case-1",
      documentId: "doc-1",
      tenantId: "tenant-1",
      storageKey: "tenants/tenant-1/.../a.pdf",
      mimeType: "application/pdf",
      step: "ocr",
    })
  })

  it("sem órfãos: não enfileira nada", async () => {
    const deps = makeDeps([])
    const sweeper = new OrphanDocumentSweeper(deps)

    const requeued = await sweeper.sweep()

    expect(requeued).toBe(0)
    expect(deps.queue.enqueue).not.toHaveBeenCalled()
  })

  it("falha de enqueue (Redis fora): não lança e segue para os demais", async () => {
    const deps = makeDeps([
      { id: "d1", caseId: "c1", tenantId: "t1", storageKey: "k1", mimeType: "application/pdf" },
      { id: "d2", caseId: "c1", tenantId: "t1", storageKey: "k2", mimeType: "image/png" },
    ])
    ;(deps.queue.enqueue as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(undefined)
    const sweeper = new OrphanDocumentSweeper(deps)

    const requeued = await sweeper.sweep()

    expect(requeued).toBe(1)
    expect(deps.queue.enqueue).toHaveBeenCalledTimes(2)
  })
})
