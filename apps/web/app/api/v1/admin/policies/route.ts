import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])
const forbidden = (message?: string) =>
  NextResponse.json({ error: "FORBIDDEN", message }, { status: 403 })

const CreatePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  /** "tenant" = política do tenant; "global" = vale para todos (só SUPER_ADMIN). */
  scope: z.enum(["tenant", "global"]).default("tenant"),
})

/** Lista as políticas do tenant E as globais (tenantId null). */
export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const policies = await prisma.policy.findMany({
      where: { OR: [{ tenantId: user.tenantId }, { tenantId: null }] },
      include: { rules: { orderBy: { priority: "asc" } } },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ policies })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/**
 * Cria uma política. Políticas de tenant ficam ligadas ao tenant do usuário.
 * Políticas globais (tenantId null) só podem ser criadas por SUPER_ADMIN.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const body = CreatePolicySchema.parse(await req.json())

    if (body.scope === "global" && user.role !== "SUPER_ADMIN") {
      return forbidden("Apenas o Super Admin pode criar políticas globais.")
    }

    const policy = await prisma.policy.create({
      data: {
        tenantId: body.scope === "global" ? null : user.tenantId,
        name: body.name,
        description: body.description,
      },
      include: { rules: true },
    })

    return NextResponse.json(policy, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
