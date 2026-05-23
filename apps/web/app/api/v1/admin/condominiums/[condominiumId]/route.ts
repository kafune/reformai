import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
const notFound = () => NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

/** Edita campos do condomínio, alterna status e (SUPER_ADMIN) move entre tenants. */
const UpdateCondominiumSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  cnpj: z.string().max(20).nullable().optional(),
  address: z.string().min(1).max(240).optional(),
  city: z.string().min(1).max(120).optional(),
  state: z.string().length(2).optional(),
  active: z.boolean().optional(),
  tenantId: z.string().min(1).optional(), // só SUPER_ADMIN: move o condomínio
})

const serialize = (c: {
  id: string
  name: string
  cnpj: string | null
  address: string
  city: string
  state: string
  active: boolean
  createdAt: Date
  tenantId: string
  tenant?: { id: string; name: string } | null
  _count: { units: number; cases: number }
}) => ({
  id: c.id,
  name: c.name,
  cnpj: c.cnpj,
  address: c.address,
  city: c.city,
  state: c.state,
  active: c.active,
  createdAt: c.createdAt,
  tenantId: c.tenantId,
  tenant: c.tenant ? { id: c.tenant.id, name: c.tenant.name } : null,
  unitCount: c._count.units,
  caseCount: c._count.cases,
})

export async function PATCH(req: NextRequest, ctx: { params: { condominiumId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = UpdateCondominiumSchema.parse(await req.json())
    const isSuperAdmin = user.role === "SUPER_ADMIN"

    // ADMIN só enxerga o próprio tenant; SUPER_ADMIN enxerga qualquer um.
    const existing = await prisma.condominium.findFirst({
      where: {
        id: ctx.params.condominiumId,
        ...(isSuperAdmin ? {} : { tenantId: user.tenantId }),
      },
      include: { _count: { select: { cases: true } } },
    })
    if (!existing) return notFound()

    // Mover entre tenants: exclusivo do SUPER_ADMIN e só sem casos vinculados.
    const moving =
      isSuperAdmin && body.tenantId !== undefined && body.tenantId !== existing.tenantId
    if (body.tenantId !== undefined && !isSuperAdmin) return forbidden()
    if (moving && existing._count.cases > 0) {
      return NextResponse.json(
        {
          error: "CONFLICT",
          message:
            "Não é possível mover: o condomínio possui casos vinculados. Mover só é permitido antes de existirem casos.",
        },
        { status: 409 },
      )
    }
    if (moving) {
      const tenant = await prisma.tenant.findUnique({ where: { id: body.tenantId! } })
      if (!tenant) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "Tenant de destino não encontrado." },
          { status: 404 },
        )
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (moving) {
        // Migra síndicos/usuários vinculados e remove links de política do tenant antigo.
        await tx.user.updateMany({
          where: { condominiumId: existing.id },
          data: { tenantId: body.tenantId! },
        })
        await tx.condominiumPolicy.deleteMany({ where: { condominiumId: existing.id } })
      }
      return tx.condominium.update({
        where: { id: existing.id },
        data: {
          name: body.name?.trim(),
          cnpj: body.cnpj === undefined ? undefined : body.cnpj?.trim() || null,
          address: body.address?.trim(),
          city: body.city?.trim(),
          state: body.state?.trim().toUpperCase(),
          active: body.active,
          tenantId: moving ? body.tenantId! : undefined,
        },
        include: {
          tenant: { select: { id: true, name: true } },
          _count: { select: { units: true, cases: true } },
        },
      })
    })

    return NextResponse.json({ condominium: serialize(updated) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/** Exclui o condomínio — permitido apenas quando não há unidades nem casos. */
export async function DELETE(_req: NextRequest, ctx: { params: { condominiumId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const existing = await prisma.condominium.findFirst({
      where: {
        id: ctx.params.condominiumId,
        ...(user.role === "SUPER_ADMIN" ? {} : { tenantId: user.tenantId }),
      },
      include: { _count: { select: { units: true, cases: true } } },
    })
    if (!existing) return notFound()

    if (existing._count.units > 0 || existing._count.cases > 0) {
      return NextResponse.json(
        {
          error: "CONFLICT",
          message: "Não é possível excluir: o condomínio possui unidades ou casos. Desative-o.",
        },
        { status: 409 },
      )
    }

    await prisma.condominiumPolicy.deleteMany({ where: { condominiumId: existing.id } })
    await prisma.condominium.delete({ where: { id: existing.id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
