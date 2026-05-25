import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { hashPassword } from "@/infrastructure/auth/password"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER"])
const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })

const CreatePartnerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  creaNumber: z.string().min(1).max(60),
  type: z.enum(["ENGINEER", "ARCHITECT"]),
  specialties: z.array(z.string().min(1)).default([]),
  cities: z.array(z.string().min(1)).default([]),
  states: z.array(z.string().min(1)).default([]),
  basePrice: z.number().nonnegative(),
  slaHours: z.number().int().positive().optional(),
})

/** Serializa um Partner (com seu User) para JSON. */
interface PartnerWithUser {
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
  _count: { cases: number; inspections: number; reviews: number }
}

function serializePartner(p: PartnerWithUser) {
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
    reviewCount: p._count.reviews,
    slaHours: p.slaHours,
    active: p.active,
    createdAt: p.createdAt,
    caseCount: p._count.cases,
    inspectionCount: p._count.inspections,
  }
}

const PARTNER_INCLUDE = {
  user: { select: { name: true, email: true } },
  _count: { select: { cases: true, inspections: true, reviews: true } },
} as const

/** Lista os parceiros do tenant do usuário. */
export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const partners = await prisma.partner.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      include: PARTNER_INCLUDE,
    })

    return NextResponse.json({ partners: partners.map(serializePartner) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/** Cria um parceiro: usuário com papel PARTNER + registro Partner, em transação. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = CreatePartnerSchema.parse(await req.json())
    const email = body.email.trim().toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "CONFLICT", message: "E-mail já cadastrado." },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(body.password)

    const partner = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: body.name.trim(),
          email,
          passwordHash,
          role: "PARTNER",
          tenantId: user.tenantId,
          active: true,
        },
      })

      return tx.partner.create({
        data: {
          tenantId: user.tenantId,
          userId: createdUser.id,
          creaNumber: body.creaNumber.trim(),
          type: body.type,
          specialties: body.specialties,
          cities: body.cities,
          states: body.states.map((s) => s.toUpperCase()),
          basePrice: body.basePrice,
          slaHours: body.slaHours,
          active: true,
        },
        include: PARTNER_INCLUDE,
      })
    })

    return NextResponse.json({ partner: serializePartner(partner) }, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
