import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

const CreateCondominiumSchema = z.object({
  name: z.string().min(1).max(160),
  cnpj: z.string().max(20).optional(),
  address: z.string().min(1).max(240),
  city: z.string().min(1).max(120),
  state: z.string().length(2),
  /** Apenas SUPER_ADMIN: permite atribuir o condomínio a um tenant específico. */
  tenantId: z.string().min(1).optional(),
})

/**
 * Lista os condomínios.
 * SUPER_ADMIN vê todos; filtro opcional via ?tenantId=.
 * ADMIN vê apenas o próprio tenant.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const { searchParams } = new URL(req.url)
    const filterTenantId = searchParams.get("tenantId")

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
        _count: { select: { units: true, cases: true } },
        tenant: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({
      condominiums: condominiums.map((c) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        address: c.address,
        city: c.city,
        state: c.state,
        active: c.active,
        requiresSyndicApproval: c.requiresSyndicApproval,
        createdAt: c.createdAt,
        unitCount: c._count.units,
        caseCount: c._count.cases,
        tenantId: c.tenantId,
        tenantName: c.tenant.name,
      })),
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/**
 * Cria um condomínio.
 * SUPER_ADMIN pode especificar tenantId; ADMIN usa o próprio tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = CreateCondominiumSchema.parse(await req.json())

    let targetTenantId = user.tenantId

    if (user.role === "SUPER_ADMIN" && body.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: body.tenantId } })
      if (!tenant) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "Tenant não encontrado." },
          { status: 404 },
        )
      }
      targetTenantId = body.tenantId
    }

    const condominium = await prisma.condominium.create({
      data: {
        tenantId: targetTenantId,
        name: body.name.trim(),
        cnpj: body.cnpj?.trim() || null,
        address: body.address.trim(),
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
      },
      include: {
        tenant: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(
      {
        condominium: {
          id: condominium.id,
          name: condominium.name,
          cnpj: condominium.cnpj,
          address: condominium.address,
          city: condominium.city,
          state: condominium.state,
          active: condominium.active,
          requiresSyndicApproval: condominium.requiresSyndicApproval,
          createdAt: condominium.createdAt,
          unitCount: 0,
          caseCount: 0,
          tenantId: condominium.tenantId,
          tenantName: condominium.tenant.name,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
