import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/infrastructure/database/prisma"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/infrastructure/rate-limiter/RateLimiter"

/** Rota pública (sem auth) — dados de um condomínio para o autocadastro por link/QR. */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`public:condominiums:${ip}`, 60, 60) // shared bucket with listing
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  const condominium = await prisma.condominium.findFirst({
    where: { id: ctx.params.id, active: true, tenant: { active: true } },
    select: { id: true, name: true, city: true, state: true },
  })
  if (!condominium) {
    return NextResponse.json({ error: "Condomínio não encontrado." }, { status: 404 })
  }
  return NextResponse.json({ condominium })
}
