import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
const notFound = () => NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

const PARTNER_INCLUDE = {
  user: { select: { name: true, email: true } },
  _count: { select: { cases: true, inspections: true } },
} as const

interface SerializablePartner {
  id: string
  creaNumber: string
  type: string
  specialties: string[]
  cities: string[]
  states: string[]
  basePrice: unknown
  rating: unknown
  slaHours: number | null
  active: boolean
  createdAt: Date
  user: { name: string; email: string }
  _count: { cases: number; inspections: number }
}

function serializePartner(p: SerializablePartner) {
  return {
    id: p.id,
    name: p.user.name,
    email: p.user.email,
    creaNumber: p.creaNumber,
    type: p.type,
    specialties: p.specialties,
    cities: p.cities,
    states: p.states,
    basePrice: Number(p.basePrice),
    rating: p.rating == null ? null : Number(p.rating),
    slaHours: p.slaHours,
    active: p.active,
    createdAt: p.createdAt,
    caseCount: p._count.cases,
    inspectionCount: p._count.inspections,
  }
}

const UpdatePartnerSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  creaNumber: z.string().min(1).max(60).optional(),
  type: z.enum(["ENGINEER", "ARCHITECT"]).optional(),
  specialties: z.array(z.string().min(1)).optional(),
  cities: z.array(z.string().min(1)).optional(),
  states: z.array(z.string().min(1)).optional(),
  basePrice: z.number().nonnegative().optional(),
  slaHours: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})

type Params = { params: { partnerId: string } }

export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const existing = await prisma.partner.findFirst({
      where: { id: ctx.params.partnerId, tenantId: user.tenantId },
    })
    if (!existing) return notFound()

    const body = UpdatePartnerSchema.parse(await req.json())

    const updated = await prisma.$transaction(async (tx) => {
      if (body.name) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { name: body.name.trim() },
        })
      }
      return tx.partner.update({
        where: { id: existing.id },
        data: {
          creaNumber: body.creaNumber?.trim(),
          type: body.type,
          specialties: body.specialties,
          cities: body.cities,
          states: body.states?.map((s) => s.toUpperCase()),
          basePrice: body.basePrice,
          slaHours: body.slaHours,
          active: body.active,
        },
        include: PARTNER_INCLUDE,
      })
    })

    return NextResponse.json({ partner: serializePartner(updated) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/**
 * Exclui o parceiro — permitido apenas sem casos/vistorias vinculados.
 * Remove o registro Partner e desativa o usuário associado (o User é
 * preservado por integridade de logs de auditoria).
 */
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const existing = await prisma.partner.findFirst({
      where: { id: ctx.params.partnerId, tenantId: user.tenantId },
      include: { _count: { select: { cases: true, inspections: true } } },
    })
    if (!existing) return notFound()

    if (existing._count.cases > 0 || existing._count.inspections > 0) {
      return NextResponse.json(
        {
          error: "CONFLICT",
          message: "Não é possível excluir: o parceiro possui casos ou vistorias. Desative-o.",
        },
        { status: 409 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.partner.delete({ where: { id: existing.id } })
      await tx.user.update({ where: { id: existing.userId }, data: { active: false } })
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
