import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionUser } from "@/infrastructure/auth/getSessionUser"
import { handleError, unauthorized } from "@/interfaces/http/respond"
import { prisma } from "@/infrastructure/database/prisma"

/** Tipos de relatório gerados via Anthropic Agent Skill. */
const SKILL_TYPES = ["MEMORIAL_DESCRITIVO", "CRONOGRAMA"] as const
type SkillType = (typeof SKILL_TYPES)[number]

const UpsertSchema = z.object({
  skillId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
})

/** Cria ou atualiza a configuração de skill de um tipo de relatório. */
export async function PUT(req: NextRequest, ctx: { params: { type: string } }) {
  try {
    const user = await requireSessionUser()
    if (user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const { type } = ctx.params
    if (!SKILL_TYPES.includes(type as SkillType)) {
      return NextResponse.json(
        { error: "VALIDATION", message: "Tipo de relatório inválido." },
        { status: 400 },
      )
    }

    const data = UpsertSchema.parse(await req.json())

    const skill = await prisma.reportSkill.upsert({
      where: { type: type as SkillType },
      update: data,
      create: {
        type: type as SkillType,
        skillId: data.skillId ?? "",
        name: data.name ?? type,
        active: data.active ?? true,
      },
    })

    return NextResponse.json({ skill })
  } catch (err) {
    if ((err as Error).message === "UNAUTHORIZED") return unauthorized()
    return handleError(err)
  }
}
