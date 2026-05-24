import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { handleError } from "@/interfaces/http/respond"
import { RequestPasswordResetUseCase } from "@/modules/identity/application/RequestPasswordResetUseCase"
import { buildEmailProvider } from "@/infrastructure/email/EmailFactory"
import { passwordResetTemplate } from "@/infrastructure/email/templates"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/infrastructure/rate-limiter/RateLimiter"
import { logger } from "@/shared/logger"

const RequestSchema = z.object({ email: z.string().email() })

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`pwreset:ip:${ip}`, 5, 900) // 5 / 15 min por IP
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  try {
    const { email } = RequestSchema.parse(await req.json())

    const rlEmail = await checkRateLimit(`pwreset:email:${email}`, 3, 3600) // 3 / hora por e-mail
    if (!rlEmail.allowed) return rateLimitResponse(rlEmail.retryAfter)

    const result = await new RequestPasswordResetUseCase().execute(email)

    // Envia o e-mail apenas se houver usuário e provedor configurado.
    if (result) {
      const emailProvider = buildEmailProvider()
      if (emailProvider) {
        const resetUrl = `${appUrl()}/reset-password?token=${result.rawToken}`
        emailProvider
          .send({
            to: result.email,
            subject: "Redefinição de senha — ReformAI",
            html: passwordResetTemplate({ recipientName: result.name, resetUrl }),
          })
          .catch((err) =>
            logger.warn("password_reset.email_failed", {
              message: err instanceof Error ? err.message : "erro desconhecido",
            }),
          )
      } else {
        logger.warn("password_reset.no_email_provider")
      }
    }

    // Resposta idêntica exista ou não a conta — evita enumeração.
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleError(err)
  }
}
