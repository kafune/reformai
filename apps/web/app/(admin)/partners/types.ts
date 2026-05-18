export interface Partner {
  id: string
  name: string
  email: string
  creaNumber: string
  type: "ENGINEER" | "ARCHITECT" | string
  specialties: string[]
  cities: string[]
  states: string[]
  basePrice: number
  rating: number | null
  slaHours: number | null
  active: boolean
  createdAt: string
  caseCount: number
  inspectionCount: number
}

export const PARTNER_TYPE_LABELS: Record<string, string> = {
  ENGINEER: "Engenheiro",
  ARCHITECT: "Arquiteto",
}

/** Converte uma lista para texto separado por vírgula (para inputs). */
export const toCsv = (arr: string[]): string => arr.join(", ")

/** Converte texto separado por vírgula em lista limpa, sem itens vazios. */
export const fromCsv = (text: string): string[] =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
