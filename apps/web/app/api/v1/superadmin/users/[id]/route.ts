import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const USER_SELECT = {
  id: true,
  name: true,
  active: true,
  condominium: { select: { id: true, name: true } },
} as const

// condominiumId: string → vincula; null → desvincula. Ausente → apenas toggle de active.
const UpdateUserSchema = z.object({
  condominiumId: z.string().min(1).nullable().optional(),
})

/**
 * Atualiza o usuário. Com `condominiumId` no body, define/remove o vínculo de
 * condomínio (síndico). Sem body, alterna o status ativo/inativo.
 */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const target = await prisma.user.findUnique({ where: { id: ctx.params.id } })
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const raw = await req.json().catch(() => ({}))
    const body = UpdateUserSchema.parse(raw)

    if (body.condominiumId !== undefined) {
      if (target.role !== "CONDOMINIUM") {
        return NextResponse.json(
          { error: "BUSINESS_RULE_VIOLATION", message: "Vínculo de condomínio só se aplica a síndicos." },
          { status: 422 },
        )
      }
      if (body.condominiumId) {
        const condominium = await prisma.condominium.findUnique({
          where: { id: body.condominiumId },
        })
        if (!condominium || condominium.tenantId !== target.tenantId) {
          return NextResponse.json(
            { error: "NOT_FOUND", message: "Condomínio não encontrado neste tenant." },
            { status: 404 },
          )
        }
      }

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { condominiumId: body.condominiumId },
        select: USER_SELECT,
      })
      return NextResponse.json({ user: updated })
    }

    if (ctx.params.id === sessionUser.id) {
      return NextResponse.json(
        { error: "BUSINESS_RULE_VIOLATION", message: "Você não pode desativar a própria conta." },
        { status: 422 },
      )
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: { active: !target.active },
      select: USER_SELECT,
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
