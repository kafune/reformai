import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/infrastructure/database/prisma"
import { handleError } from "@/interfaces/http/respond"
import { RegisterClientUseCase } from "@/modules/identity/application/RegisterClientUseCase"
import { NotifyUserUseCase } from "@/modules/notifications/application/NotifyUserUseCase"
import { logger } from "@/shared/logger"

const RegisterSchema = z.object({
  name: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  condominiumId: z.string().min(1),
  unitId: z.string().min(1),
})

export async function POST(req: Request) {
  try {
    const input = RegisterSchema.parse(await req.json())
    const client = await new RegisterClientUseCase().execute(input)

    // Notifica os síndicos do condomínio — não-fatal para o cadastro.
    try {
      const sindicos = await prisma.user.findMany({
        where: { condominiumId: client.condominiumId, role: "CONDOMINIUM", active: true },
        select: { id: true },
      })
      const notify = new NotifyUserUseCase()
      for (const sindico of sindicos) {
        await notify.execute({
          userId: sindico.id,
          tenantId: client.tenantId,
          title: "Novo morador cadastrado",
          body: `${client.name} cadastrou-se na unidade ${client.unitIdentifier}.`,
        })
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
