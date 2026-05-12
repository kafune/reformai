import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { CreateCaseUseCase } from "@/modules/case-intake/application/CreateCaseUseCase"
import { PrismaReformCaseRepository } from "@/modules/case-intake/infrastructure/repositories/PrismaReformCaseRepository"

const CreateCaseSchema = z.object({ unitId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const user = await requireSessionUser()
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
    const filters = user.role === "CLIENT" ? { clientId: user.id } : undefined
    const cases = await repo.listByTenant(user.tenantId, filters)
    return NextResponse.json({ cases })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
