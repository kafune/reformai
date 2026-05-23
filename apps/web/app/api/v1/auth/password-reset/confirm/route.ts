import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleError } from "@/interfaces/http/respond"
import { ConfirmPasswordResetUseCase } from "@/modules/identity/application/ConfirmPasswordResetUseCase"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/infrastructure/rate-limiter/RateLimiter"

const ConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`pwreset:confirm:${ip}`, 10, 900) // 10 / 15 min por IP
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  try {
    const { token, password } = ConfirmSchema.parse(await req.json())
    await new ConfirmPasswordResetUseCase().execute({ token, newPassword: password })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err)
  }
}
