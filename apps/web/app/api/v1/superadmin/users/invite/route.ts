import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { CreateInviteUseCase } from "@/modules/identity/application/CreateInviteUseCase"
import { buildEmailProvider } from "@/infrastructure/email/EmailFactory"
import { inviteTemplate } from "@/infrastructure/email/templates"
import { logger } from "@/shared/logger"

const InviteSchema = z
  .object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "CONDOMINIUM", "CLIENT"]),
    tenantId: z.string().min(1),
    condominiumId: z.string().min(1).optional(),
  })
  .refine((d) => d.role !== "CONDOMINIUM" || !!d.condominiumId, {
    message: "Síndico precisa estar vinculado a um condomínio.",
    path: ["condominiumId"],
  })

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  CONDOMINIUM: "Síndico",
  CLIENT: "Morador",
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireSessionUser()
    if (sessionUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = InviteSchema.parse(await req.json())
    const result = await new CreateInviteUseCase().execute(body)

    const emailProvider = buildEmailProvider()
    if (emailProvider) {
      const inviteUrl = `${appUrl()}/reset-password?token=${result.rawToken}&invite=1`
      await emailProvider.send({
        to: result.email,
        subject: "Você foi convidado para a ReformAI",
        html: inviteTemplate({
          recipientName: result.name,
          inviteUrl,
          roleLabel: ROLE_LABEL[body.role] ?? body.role,
        }),
      })
    } else {
      logger.warn("user.invite.no_email_provider", { userId: result.userId })
    }

    return NextResponse.json(
      { ok: true, userId: result.userId, emailSent: Boolean(emailProvider) },
      { status: 201 },
    )
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
