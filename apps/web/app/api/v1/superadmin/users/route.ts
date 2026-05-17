import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/auth/password"

const CreateUserSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "CONDOMINIUM", "CLIENT", "PARTNER"]),
  tenantId: z.string().min(1),
})

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true,
  tenant: { select: { id: true, name: true, slug: true } },
} as const

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

export async function GET(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") return forbidden()

    const tenantId = req.nextUrl.searchParams.get("tenantId") ?? undefined

    const users = await prisma.user.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: [{ tenantId: "asc" }, { name: "asc" }],
      select: USER_SELECT,
    })

    return NextResponse.json({ users })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") return forbidden()

    const body = CreateUserSchema.parse(await req.json())
    const email = body.email.trim().toLowerCase()

    const tenant = await prisma.tenant.findUnique({ where: { id: body.tenantId } })
    if (!tenant) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Tenant não encontrado." }, { status: 404 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "CONFLICT", message: "E-mail já cadastrado." },
        { status: 409 },
      )
    }

    const created = await prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        tenantId: body.tenantId,
        active: true,
      },
      select: USER_SELECT,
    })

    return NextResponse.json({ user: created }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
