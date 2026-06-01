import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { DocumentType } from "@reformai/database"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { enforceUserRateLimit, BUCKETS } from "@/infrastructure/rate-limiter/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { originForRole } from "@/modules/document-management/domain/documentOrigin"
import { PrismaDocumentRepository } from "@/modules/document-management/infrastructure/PrismaDocumentRepository"
import { QueueDocumentJob } from "@/modules/document-management/infrastructure/QueueDocumentJob"
import { UploadDocumentUseCase } from "@/modules/document-management/application/UploadDocumentUseCase"
import { GetDocumentsByCase } from "@/modules/document-management/application/GetDocumentsByCase"
import type { DocumentRecord } from "@/modules/document-management/domain/repositories/DocumentRepository"

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

const DocumentTypeSchema = z.nativeEnum(DocumentType)

/**
 * Returns a public-safe projection of a document, omitting `storageKey`.
 * Internal storage keys must never leak to clients (CLAUDE.md §11/§13).
 */
function toPublicDocument(doc: DocumentRecord) {
  // Explicit destructuring keeps `storageKey` out of the response.
  const { storageKey: _omit, ...rest } = doc
  void _omit
  return rest
}

export async function POST(req: NextRequest, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    // Rate-limit por usuário: protege storage e fila contra upload abusivo.
    const limited = await enforceUserRateLimit(user.id, BUCKETS.upload)
    if (limited) return limited

    const form = await req.formData()
    const fileEntry = form.get("file")
    const documentTypeRaw = form.get("documentType")

    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Campo 'file' obrigatório" },
        { status: 400 },
      )
    }
    if (typeof documentTypeRaw !== "string" || documentTypeRaw.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Campo 'documentType' obrigatório" },
        { status: 400 },
      )
    }

    const documentType = DocumentTypeSchema.parse(documentTypeRaw)

    const mimeType = fileEntry.type
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json(
        {
          error: "VALIDATION",
          message: `mimeType não suportado: ${mimeType}`,
          details: { allowed: ALLOWED_MIME_TYPES },
        },
        { status: 400 },
      )
    }

    if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "PAYLOAD_TOO_LARGE",
          message: `Arquivo excede o limite de ${MAX_FILE_SIZE_BYTES} bytes`,
        },
        { status: 413 },
      )
    }

    // Resolve condominiumId + unitId from the case enforcing tenant + posse.
    const reformCase = await assertCaseAccess(user, caseId)

    const buffer = Buffer.from(await fileEntry.arrayBuffer())

    const storage = createStorageAdapter()
    const repo = new PrismaDocumentRepository(prisma)
    const queue = new QueueDocumentJob()
    const useCase = new UploadDocumentUseCase({ storage, repo, queue })

    const doc = await useCase.execute({
      caseId,
      tenantId: user.tenantId,
      condominiumId: reformCase.condominiumId,
      unitId: reformCase.unitId,
      buffer,
      fileName: fileEntry.name,
      mimeType,
      documentType,
      origin: originForRole(user.role),
    })

    return NextResponse.json(toPublicDocument(doc), { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function GET(_: Request, ctx: { params: { caseId: string } }) {
  try {
    const user = await requireSessionUser()
    const caseId = ctx.params.caseId

    await assertCaseAccess(user, caseId)

    const repo = new PrismaDocumentRepository(prisma)
    const useCase = new GetDocumentsByCase({ repo })
    const docs = await useCase.execute({ caseId, tenantId: user.tenantId })

    return NextResponse.json({ documents: docs.map(toPublicDocument) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
