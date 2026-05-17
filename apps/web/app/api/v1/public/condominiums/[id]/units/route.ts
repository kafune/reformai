import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

/** Rota pública (sem auth) — lista as unidades de um condomínio para o autocadastro. */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const units = await prisma.unit.findMany({
    where: { condominiumId: ctx.params.id, condominium: { active: true } },
    orderBy: [{ floor: "asc" }, { identifier: "asc" }],
    select: { id: true, identifier: true, floor: true },
  })
  return NextResponse.json({ units })
}
