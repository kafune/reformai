import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"

/** Rota pública (sem auth) — usada no autocadastro de morador. */
export async function GET(req: NextRequest) {
  const tenantSlug = req.nextUrl.searchParams.get("tenant")
  const condominiums = await prisma.condominium.findMany({
    where: {
      active: true,
      tenant: { active: true, ...(tenantSlug ? { slug: tenantSlug } : {}) },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, state: true },
  })
  return NextResponse.json({ condominiums })
}
