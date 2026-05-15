import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])

const CreatePolicySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function GET() {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const policies = await prisma.policy.findMany({
      where: { tenantId: user.tenantId },
      include: { rules: true },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ policies })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()

    if (!ADMIN_ROLES.has(user.role)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = CreatePolicySchema.parse(await req.json())

    const policy = await prisma.policy.create({
      data: {
        tenantId: user.tenantId,
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
