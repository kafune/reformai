import { NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

/** Rota pública (sem auth) — dados de um condomínio para o autocadastro por link/QR. */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const condominium = await prisma.condominium.findFirst({
    where: { id: ctx.params.id, active: true, tenant: { active: true } },
    select: { id: true, name: true, city: true, state: true },
  })
  if (!condominium) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 })
  }
  return NextResponse.json({ condominium })
}
