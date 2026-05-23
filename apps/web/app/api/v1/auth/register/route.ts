import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/infrastructure/database/prisma"
import { handleError } from "@/interfaces/http/respond"
import { RegisterClientUseCase } from "@/modules/identity/application/RegisterClientUseCase"
import { NotifyUserUseCase } from "@/modules/notifications/application/NotifyUserUseCase"
import { buildEmailProvider } from "@/infrastructure/email/ResendEmailProvider"
import { newResidentTemplate } from "@/infrastructure/email/templates"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/infrastructure/rate-limiter/RateLimiter"
import { logger } from "@/shared/logger"

const RegisterSchema = z.object({
  name: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  condominiumId: z.string().min(1),
  block: z.string().max(60).optional(),
  unitIdentifier: z.string().min(1).max(60),
})

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const rl = await checkRateLimit(`register:${ip}`, 5, 900) // 5 per 15 min per IP
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  try {
    const input = RegisterSchema.parse(await req.json())

    // Also rate-limit by email to prevent account enumeration at scale.
    const rlEmail = await checkRateLimit(`register:email:${input.email}`, 3, 3600) // 3 per hour per email
    if (!rlEmail.allowed) return rateLimitResponse(rlEmail.retryAfter)

    const client = await new RegisterClientUseCase().execute(input)

    // Notify sindicos — non-fatal. Use dedicated template with richer context.
    try {
      const condominium = await prisma.condominium.findUnique({
        where: { id: client.condominiumId },
        select: { name: true },
      })
      const sindicos = await prisma.user.findMany({
        where: { condominiumId: client.condominiumId, role: "CONDOMINIUM", active: true },
        select: { id: true, name: true, email: true },
      })

      const emailProvider = buildEmailProvider()
      const notify = new NotifyUserUseCase()

      for (const sindico of sindicos) {
        // In-app notification (always)
        await notify.execute({
          userId: sindico.id,
          tenantId: client.tenantId,
          title: "Novo morador cadastrado",
          body: `${client.name} cadastrou-se na unidade ${client.unitLabel}.`,
        })

        // Email with richer template (only if provider configured)
        if (emailProvider && condominium) {
          emailProvider
            .send({
              to: sindico.email,
              subject: "Novo morador cadastrado",
              html: newResidentTemplate({
                sindicoName: sindico.name,
                residentName: client.name,
                unitLabel: client.unitLabel,
                condominiumName: condominium.name,
              }),
            })
            .catch((err) =>
              logger.warn("client.register.email_sindico_failed", {
                sindicoId: sindico.id,
                message: err instanceof Error ? err.message : "erro desconhecido",
              }),
            )
        }
      }
    } catch (notifyErr) {
      logger.warn("client.register.notify_failed", {
        message: notifyErr instanceof Error ? notifyErr.message : "erro desconhecido",
      })
    }

    return NextResponse.json(
      { user: { id: client.id, name: client.name, email: client.email, role: client.role } },
      { status: 201 },
    )
  } catch (err) {
    return handleError(err)
  }
}
