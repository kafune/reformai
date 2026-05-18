import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
const notFound = () => NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

/** Edita campos do condomínio e/ou alterna seu status ativo. */
const UpdateCondominiumSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  cnpj: z.string().max(20).nullable().optional(),
  address: z.string().min(1).max(240).optional(),
  city: z.string().min(1).max(120).optional(),
  state: z.string().length(2).optional(),
  active: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: { condominiumId: string } }) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = UpdateCondominiumSchema.parse(await req.json())

    // Isolamento de tenant: só edita condomínios do próprio tenant.
    const existing = await prisma.condominium.findFirst({
      where: { id: ctx.params.condominiumId, tenantId: user.tenantId },
    })
    if (!existing) return notFound()

    const updated = await prisma.condominium.update({
      where: { id: existing.id },
      data: {
        name: body.name?.trim(),
        cnpj: body.cnpj === undefined ? undefined : body.cnpj?.trim() || null,
        address: body.address?.trim(),
        city: body.city?.trim(),
        state: body.state?.trim().toUpperCase(),
        active: body.active,
      },
      include: { _count: { select: { units: true, cases: true } } },
    })

    return NextResponse.json({
      condominium: {
        id: updated.id,
        name: updated.name,
        cnpj: updated.cnpj,
        address: updated.address,
        city: updated.city,
        state: updated.state,
        active: updated.active,
        createdAt: updated.createdAt,
        unitCount: updated._count.units,
        caseCount: updated._count.cases,
      },
    })
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
      where: { id: ctx.params.condominiumId, tenantId: user.tenantId },
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
