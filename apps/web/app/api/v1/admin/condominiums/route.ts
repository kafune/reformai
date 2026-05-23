import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

const CreateCondominiumSchema = z.object({
  name: z.string().min(1).max(160),
  cnpj: z.string().max(20).optional(),
  address: z.string().min(1).max(240),
  city: z.string().min(1).max(120),
  state: z.string().length(2),
  tenantId: z.string().min(1).optional(), // só SUPER_ADMIN; ADMIN usa o próprio tenant
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
  _count?: { units: number; cases: number }
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
  unitCount: c._count?.units ?? 0,
  caseCount: c._count?.cases ?? 0,
})

/**
 * Lista condomínios. ADMIN vê apenas os do próprio tenant; SUPER_ADMIN vê os de
 * todos os tenants (ou de um tenant específico via `?tenantId=`).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const filterTenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined
    const where =
      user.role === "SUPER_ADMIN"
        ? filterTenantId
          ? { tenantId: filterTenantId }
          : {}
        : { tenantId: user.tenantId }

    const condominiums = await prisma.condominium.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        tenant: { select: { id: true, name: true } },
        _count: { select: { units: true, cases: true } },
      },
    })

    return NextResponse.json({ condominiums: condominiums.map(serialize) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/** Cria um condomínio. SUPER_ADMIN pode escolher o tenant; ADMIN usa o próprio. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = CreateCondominiumSchema.parse(await req.json())

    const tenantId =
      user.role === "SUPER_ADMIN" && body.tenantId ? body.tenantId : user.tenantId

    if (tenantId !== user.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
      if (!tenant) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "Tenant não encontrado." },
          { status: 404 },
        )
      }
    }

    const condominium = await prisma.condominium.create({
      data: {
        tenantId,
        name: body.name.trim(),
        cnpj: body.cnpj?.trim() || null,
        address: body.address.trim(),
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
      },
      include: { tenant: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ condominium: serialize(condominium) }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
