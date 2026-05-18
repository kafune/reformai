/** Unidades federativas do Brasil — usadas nos selects de estado. */
export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const

export interface Condominium {
  id: string
  name: string
  cnpj: string | null
  address: string
  city: string
  state: string
  active: boolean
  createdAt: string
  unitCount: number
  caseCount: number
}

export interface Unit {
  id: string
  identifier: string
  floor: string | null
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  caseCount: number
}
