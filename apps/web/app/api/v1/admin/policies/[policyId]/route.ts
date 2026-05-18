import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { NotFoundError } from "@/shared/errors/DomainError"
import type { SessionUser } from "@/infrastructure/auth/getSessionUser"

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"])
const forbidden = (message?: string) =>
  NextResponse.json({ error: "FORBIDDEN", message }, { status: 403 })

const UpdatePolicySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
})

type Params = { params: { policyId: string } }

/**
 * Carrega a política e valida acesso. Políticas globais só para SUPER_ADMIN;
 * políticas de tenant só para usuários do mesmo tenant.
 * `forbidden` indica política global sem permissão; `policy` nulo sem `forbidden`
 * significa inexistente/de outro tenant (tratado como 404 para não vazar dados).
 */
async function loadAccessiblePolicy(policyId: string, user: SessionUser) {
  const policy = await prisma.policy.findUnique({ where: { id: policyId } })
  if (!policy) return { policy: null, forbidden: false } as const
  if (policy.tenantId === null && user.role !== "SUPER_ADMIN") {
    return { policy: null, forbidden: true } as const
  }
  if (policy.tenantId !== null && policy.tenantId !== user.tenantId) {
    return { policy: null, forbidden: false } as const
  }
  return { policy, forbidden: false } as const
}

const GLOBAL_DENY = "Apenas o Super Admin pode alterar políticas globais."

export async function PATCH(req: NextRequest, ctx: Params) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const { policy, forbidden: isForbidden } = await loadAccessiblePolicy(
      ctx.params.policyId,
      user,
    )
    if (isForbidden) return forbidden(GLOBAL_DENY)
    if (!policy) throw new NotFoundError("Policy", ctx.params.policyId)

    const body = UpdatePolicySchema.parse(await req.json())

    const updated = await prisma.policy.update({
      where: { id: policy.id },
      data: {
        name: body.name?.trim(),
        description: body.description === undefined ? undefined : body.description,
        active: body.active,
      },
      include: { rules: { orderBy: { priority: "asc" } } },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

/** Exclui a política e todas as suas regras. */
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const user = await requireSessionUser()
    if (!ADMIN_ROLES.has(user.role)) return forbidden()

    const { policy, forbidden: isForbidden } = await loadAccessiblePolicy(
      ctx.params.policyId,
      user,
    )
    if (isForbidden) return forbidden(GLOBAL_DENY)
    if (!policy) throw new NotFoundError("Policy", ctx.params.policyId)

    const links = await prisma.condominiumPolicy.count({ where: { policyId: policy.id } })
    if (links > 0) {
      return NextResponse.json(
        {
          error: "CONFLICT",
          message: "Política vinculada a condomínios. Remova os vínculos antes de excluir.",
        },
        { status: 409 },
      )
    }

    await prisma.$transaction([
      prisma.rule.deleteMany({ where: { policyId: policy.id } }),
      prisma.policy.delete({ where: { id: policy.id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
