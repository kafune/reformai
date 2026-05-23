import { NextResponse } from "next/server"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"
import { RequestPasswordResetUseCase } from "@/modules/identity/application/RequestPasswordResetUseCase"
import { buildEmailProvider } from "@/infrastructure/email/ResendEmailProvider"
import { passwordResetTemplate } from "@/infrastructure/email/templates"
import { logger } from "@/shared/logger"

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

/** SUPER_ADMIN dispara um e-mail de redefinição de senha para o usuário alvo. */
export async function POST(_req: Request, ctx: { params: { id: string } }) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const target = await prisma.user.findUnique({
      where: { id: ctx.params.id },
      select: { email: true, active: true },
    })
    if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

    const result = await new RequestPasswordResetUseCase().execute(target.email)

    const emailProvider = buildEmailProvider()
    if (result && emailProvider) {
      const resetUrl = `${appUrl()}/reset-password?token=${result.rawToken}`
      await emailProvider.send({
        to: result.email,
        subject: "Redefinição de senha — ReformAI",
        html: passwordResetTemplate({ recipientName: result.name, resetUrl }),
      })
    } else if (result && !emailProvider) {
      logger.warn("admin.reset_password.no_email_provider", { targetId: ctx.params.id })
    }

    // emailSent indica se o link chegou a ser enviado (provedor configurado + usuário ativo).
    return NextResponse.json({ ok: true, emailSent: Boolean(result && emailProvider) })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
