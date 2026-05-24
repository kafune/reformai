import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

const forbidden = () => NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
const notFound = (msg: string) => NextResponse.json({ error: "NOT_FOUND", message: msg }, { status: 404 })
const business = (msg: string) =>
  NextResponse.json({ error: "BUSINESS_RULE_VIOLATION", message: msg }, { status: 422 })

/**
 * POST /api/v1/superadmin/users/:id/impersonate
 *
 * Valida que o chamador é SUPER_ADMIN, retorna os dados do usuário-alvo
 * e grava AuditLog. O frontend usa esses dados para chamar `session.update()`
 * e sobrescrever o JWT — toda a segurança real é feita no callback `jwt` de auth.ts.
 */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== "SUPER_ADMIN") return forbidden()

    const target = await prisma.user.findUnique({
      where: { id: ctx.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        condominiumId: true,
        active: true,
      },
    })
    if (!target) return notFound("Usuário não encontrado.")
    if (!target.active) return business("Não é possível visualizar como um usuário inativo.")
    if (target.id === sessionUser.id) return business("Você já está logado como este usuário.")

    // Auditoria: impersonação é uma ação crítica e deve ser sempre rastreável.
    await prisma.auditLog.create({
      data: {
        tenantId: sessionUser.tenantId,
        userId: sessionUser.id,
        action: "admin.impersonation.started",
        triggeredBy: `user:${sessionUser.id}`,
        details: {
          targetUserId: target.id,
          targetUserEmail: target.email,
          targetUserRole: target.role,
          targetUserName: target.name,
        },
      },
    })

    return NextResponse.json({ user: target })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
