import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

/** Alterna o status ativo/inativo do usuário. */
export async function PATCH(_req: Request, ctx: { params: { id: string } }) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    if (ctx.params.id === sessionUser.id) {
      return NextResponse.json(
        { error: "BUSINESS_RULE_VIOLATION", message: "Você não pode desativar a própria conta." },
        { status: 422 },
      )
    }

    const target = await prisma.user.findUnique({ where: { id: ctx.params.id } })
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { active: !target.active },
      select: { id: true, name: true, active: true },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
