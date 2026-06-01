import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { captureException, isMonitoringEnabled } from "@/infrastructure/monitoring/sentry"
import { checkRateLimit, getClientIp } from "@/infrastructure/rate-limiter/RateLimiter"
import { logger } from "@/shared/logger"

export const dynamic = "force-dynamic"

const ClientErrorSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
})

/**
 * Beacon de erros do cliente (error boundaries). Encaminha ao monitoramento
 * server-side (mesmo DSN). Público, mas com rate-limit por IP para evitar abuso.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = await checkRateLimit(`client-error:${ip}`, 20, 60)
    if (!rl.allowed) return new NextResponse(null, { status: 429 })

    const body = ClientErrorSchema.parse(await req.json())

    const error = new Error(body.message)
    error.name = "ClientError"
    if (body.stack) error.stack = body.stack

    if (isMonitoringEnabled()) {
      captureException(error, { route: "client", digest: body.digest, url: body.url })
    } else {
      logger.error("client.error", { message: body.message, digest: body.digest, url: body.url })
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    // Beacon nunca deve falhar de forma significativa para o cliente.
    return new NextResponse(null, { status: 204 })
  }
}
