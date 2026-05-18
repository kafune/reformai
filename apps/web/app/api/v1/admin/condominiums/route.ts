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
})

/** Lista os condomínios do tenant do usuário, com contagem de unidades e casos. */
export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const condominiums = await prisma.condominium.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { units: true, cases: true } } },
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
        createdAt: c.createdAt,
        unitCount: c._count.units,
        caseCount: c._count.cases,
      })),
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/** Cria um condomínio no tenant do usuário. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = CreateCondominiumSchema.parse(await req.json())

    const condominium = await prisma.condominium.create({
      data: {
        tenantId: user.tenantId,
        name: body.name.trim(),
        cnpj: body.cnpj?.trim() || null,
        address: body.address.trim(),
        city: body.city.trim(),
        state: body.state.trim().toUpperCase(),
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
          createdAt: condominium.createdAt,
          unitCount: 0,
          caseCount: 0,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
