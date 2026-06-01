import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized, forbidden } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { getConfigStatus } from "@/infrastructure/config/configStatus"

export const dynamic = "force-dynamic"

const ALLOWED = new Set(["ADMIN", "SUPER_ADMIN", "MANAGER"])

/**
 * GET /api/v1/admin/system-status — visibilidade operacional dos subsistemas.
 *
 * Combina o status de CONFIGURAÇÃO (variáveis de ambiente presentes) com uma
 * checagem de LIVENESS do banco. Torna explícito quando e-mail/push/monitoramento
 * estão desativados — que, em produção, falham de forma silenciosa.
 */
export async function GET() {
  try {
    const user = await requireSessionUser()
    if (!ALLOWED.has(user.role)) return forbidden()

    const config = getConfigStatus()

    let databaseLive = false
    try {
      await prisma.$queryRaw`SELECT 1`
      databaseLive = true
    } catch {
      databaseLive = false
    }

    // Subsistemas opcionais ausentes — funcionalidades que não operarão.
    const degraded: string[] = []
    if (!config.email) degraded.push("email")
    if (!config.push) degraded.push("push")
    if (!config.monitoring) degraded.push("monitoring")
    if (!config.redis) degraded.push("redis")

    const critical: string[] = []
    if (!config.database || !databaseLive) critical.push("database")
    if (!config.anthropic) critical.push("anthropic")
    if (!config.storage) critical.push("storage")
    if (process.env.NODE_ENV === "production" && !config.authSecret) critical.push("authSecret")

    return NextResponse.json({
      environment: process.env.NODE_ENV ?? "development",
      config,
      liveness: { database: databaseLive },
      degraded,
      critical,
      healthy: critical.length === 0,
    })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
