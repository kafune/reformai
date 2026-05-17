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

/** Alias para o naming usado pelo TriageAgent ao restringir a tool submit_scope. */
export const CANONICAL_SERVICES = KNOWN_SERVICES

export const ReformScopeSchema = z.object({
  // núcleo
  services: z.array(z.string()).min(1),
  areasAffected: z.array(z.string()).default([]),
  affectsCommonAreas: z.boolean().default(false),

  // dimensionamento
  estimatedArea: z.number().positive().optional(),
  estimatedDurationDays: z.number().int().positive().optional(),
  workforceType: z.enum(["proprio", "terceirizado", "indefinido"]).default("indefinido"),

  // impactos
  affectsStructure: z.boolean().default(false),
  affectsExternalFacade: z.boolean().default(false),
  affectsNeighbors: z.boolean().default(false),

  // contexto
  city: z.string().optional(),
  urgency: z.enum(["normal", "urgent"]).default("normal"),
  description: z.string().optional(),
  notes: z.string().optional(),
})

export type ReformScope = z.infer<typeof ReformScopeSchema>

/** Alias compatível com o naming do build de referência. */
export type ValidatedReformScope = ReformScope
