import { NextRequest, NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { assertCaseAccess } from "@/interfaces/http/guards"
import { prisma } from "@/infrastructure/database/prisma"
import { createStorageAdapter } from "@/infrastructure/storage/StorageFactory"
import { buildStorageKey } from "@/infrastructure/storage/StorageAdapter"
import { NotFoundError } from "@/shared/errors/DomainError"

const SIGNED_URL_EXPIRES_SECONDS = 3600 // 1h (CLAUDE.md §11)

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 // 15 MB por foto
const UPLOAD_ROLES = new Set(["PARTNER", "ADMIN", "SUPER_ADMIN"])

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Upload de fotos de vistoria (parceiro/admin). Armazena no storage e anexa as
 * chaves a Inspection.photoKeys. As chaves retornadas podem ser usadas no
 * fechamento da vistoria (.../complete).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { caseId: string; inspectionId: string } },
) {
  try {
    const user = await requireSessionUser()
    if (!UPLOAD_ROLES.has(user.role)) return forbidden()

    const { caseId, inspectionId } = ctx.params
    const access = await assertCaseAccess(user, caseId)

    const inspection = await prisma.inspection.findFirst({
      where: { id: inspectionId, caseId, tenantId: user.tenantId },
      select: { id: true },
    })
    if (!inspection) throw new NotFoundError("Inspection", inspectionId)

    const form = await req.formData()
    const files = form.getAll("file").filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Envie ao menos um arquivo no campo 'file'." },
        { status: 400 },
      )
    }

    // Geolocalização opcional (mesma ordem dos arquivos): campos lat/lng/accuracy.
    const lats = form.getAll("lat").map((v) => Number(v))
    const lngs = form.getAll("lng").map((v) => Number(v))
    const accs = form.getAll("accuracy").map((v) => Number(v))

    const existing = await prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: { photoMeta: true },
    })
    const photoMeta: Record<string, unknown> = {
      ...((existing?.photoMeta as Record<string, unknown> | null) ?? {}),
    }

    const storage = createStorageAdapter()
    const newKeys: string[] = []

    let idx = -1
    for (const file of files) {
      idx++
      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
        return NextResponse.json(
          { error: "VALIDATION", message: `mimeType não suportado: ${file.type}`, details: { allowed: ALLOWED_MIME } },
          { status: 400 },
        )
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "PAYLOAD_TOO_LARGE", message: `Arquivo excede ${MAX_FILE_SIZE_BYTES} bytes` },
          { status: 413 },
        )
      }
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
      const key = buildStorageKey(
        user.tenantId,
        access.condominiumId,
        access.unitId,
        caseId,
        "inspections",
        `${inspectionId}/photos`,
        `${randomId()}.${ext}`,
      )
      const buffer = Buffer.from(await file.arrayBuffer())
      await storage.upload(key, buffer, file.type)
      newKeys.push(key)

      const lat = lats[idx]
      const lng = lngs[idx]
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        photoMeta[key] = {
          lat,
          lng,
          accuracy: Number.isFinite(accs[idx]) ? accs[idx] : null,
          takenAt: new Date().toISOString(),
        }
      }
    }

    await prisma.inspection.update({
      where: { id: inspectionId },
      data: { photoKeys: { push: newKeys }, photoMeta: photoMeta as object },
    })

    return NextResponse.json({ uploaded: newKeys.length, photoKeys: newKeys }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/**
 * GET /api/v1/cases/:caseId/inspections/:inspectionId/photos
 *
 * Retorna URLs assinadas (1h) para todas as fotos da vistoria.
 * storageKey nunca é exposta — apenas signed URLs.
 */
export async function GET(
  _: Request,
  ctx: { params: { caseId: string; inspectionId: string } },
) {
  try {
    const user = await requireSessionUser()
    const { caseId, inspectionId } = ctx.params

    await assertCaseAccess(user, caseId)

    const inspection = await prisma.inspection.findFirst({
      where: { id: inspectionId, caseId, tenantId: user.tenantId },
      select: { id: true, photoKeys: true },
    })
    if (!inspection) throw new NotFoundError("Inspection", inspectionId)

    if (inspection.photoKeys.length === 0) {
      return NextResponse.json({ photos: [] })
    }

    const storage = createStorageAdapter()
    const photos = await Promise.all(
      inspection.photoKeys.map(async (key, idx) => {
        const url = await storage.getSignedUrl(key, SIGNED_URL_EXPIRES_SECONDS)
        return { index: idx, url }
      }),
    )

    return NextResponse.json({ photos })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
