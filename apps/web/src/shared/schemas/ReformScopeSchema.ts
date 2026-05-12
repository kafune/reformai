import { z } from "zod"

export const KNOWN_SERVICES = [
  "Pintura simples",
  "Troca de piso sem demolição",
  "Troca de piso com demolição",
  "Elétrica",
  "Hidráulica",
  "Gás",
  "Impermeabilização",
  "Ar-condicionado (split)",
  "Mudança de layout",
  "Demolição de alvenaria",
  "Impacto estrutural/prumadas",
  "Fachada",
  "Esquadrias externas",
  "Equipamentos fixos pesados",
] as const

export const ReformScopeSchema = z.object({
  services: z.array(z.string()).min(1),
  areasAffected: z.array(z.string()).default([]),
  estimatedDurationDays: z.number().int().positive().optional(),
  workforceType: z.enum(["proprio", "terceirizado", "indefinido"]).default("indefinido"),
  affectsCommonAreas: z.boolean().default(false),
  affectsNeighbors: z.boolean().default(false),
  notes: z.string().optional(),
})

export type ReformScope = z.infer<typeof ReformScopeSchema>
