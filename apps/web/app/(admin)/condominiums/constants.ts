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
  partnerId: string | null
  partnerName: string | null
  partnerCasePrice: number | null
}

/** Parceiro disponível para vincular a um condomínio. */
export interface PartnerOption {
  id: string
  name: string
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
