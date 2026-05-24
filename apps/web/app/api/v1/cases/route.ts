import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { forbidden, handleError, unauthorized } from "@/interfaces/http/respond"
import { CreateCaseUseCase } from "@/modules/case-intake/application/CreateCaseUseCase"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"
import { prisma } from "@/infrastructure/database/prisma"

const CreateCaseSchema = z.object({ unitId: z.string().min(1) })

/** Somente moradores (CLIENT) iniciam casos de reforma. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()

    if (user.role !== "CLIENT") return forbidden()

    const body = CreateCaseSchema.parse(await req.json())
    const repo = new PrismaReformCaseRepository()
    const useCase = new CreateCaseUseCase(repo)
    const created = await useCase.execute({
      tenantId: user.tenantId,
      clientId: user.id,
      unitId: body.unitId,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}

export async function GET() {
  try {
    const user = await requireSessionUser()
    const repo = new PrismaReformCaseRepository()

    let filters: { clientId?: string; condominiumId?: string; partnerId?: string } | undefined

    if (user.role === "CLIENT") {
      // Morador vê só os próprios casos
      filters = { clientId: user.id }
    } else if (user.role === "CONDOMINIUM") {
      // Síndico vê só os casos do seu condomínio
      filters = { condominiumId: user.condominiumId ?? undefined }
    } else if (user.role === "PARTNER") {
      // Parceiro vê só os casos atribuídos a ele
      const partner = await prisma.partner.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!partner) return NextResponse.json({ cases: [] })
      filters = { partnerId: partner.id }
    }
    // ADMIN, MANAGER, SUPER_ADMIN: todos os casos do tenant (sem filtro)

    const cases = await repo.listByTenant(user.tenantId, filters)
    return NextResponse.json({ cases })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
