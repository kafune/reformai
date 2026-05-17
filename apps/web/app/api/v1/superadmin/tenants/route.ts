import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens."),
  type: z.enum(["ADMIN", "ADMINISTRADORA", "STANDALONE"]),
})

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

export async function GET() {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") return forbidden()

    const tenants = await prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { users: true, condominiums: true, cases: true } } },
    })

    return NextResponse.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        type: t.type,
        active: t.active,
        createdAt: t.createdAt,
        userCount: t._count.users,
        condominiumCount: t._count.condominiums,
        caseCount: t._count.cases,
      })),
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") return forbidden()

    const body = CreateTenantSchema.parse(await req.json())

    const existing = await prisma.tenant.findUnique({ where: { slug: body.slug } })
    if (existing) {
      return NextResponse.json(
        { error: "CONFLICT", message: "Slug já está em uso." },
        { status: 409 },
      )
    }

    const tenant = await prisma.tenant.create({
      data: { name: body.name, slug: body.slug, type: body.type, active: true },
    })

    return NextResponse.json(
      {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          active: tenant.active,
          createdAt: tenant.createdAt,
          userCount: 0,
          condominiumCount: 0,
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
