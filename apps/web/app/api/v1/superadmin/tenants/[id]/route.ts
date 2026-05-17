import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

/** Alterna o status ativo/inativo do tenant. */
export async function PATCH(_req: Request, ctx: { params: { id: string } }) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: ctx.params.id } })
    if (!tenant) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { active: !tenant.active },
      select: { id: true, name: true, active: true },
    })

    return NextResponse.json({ tenant: updated })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
