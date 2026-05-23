import type { DocOrigin } from "@reformai/database"

/**
 * Mapeia o papel do usuário que fez o upload para a origem do documento.
 * Parceiros enviam como PARTNER (ex.: ART final, relatórios de vistoria),
 * moradores como CLIENT, e demais papéis administrativos como SYSTEM.
 */
export function originForRole(role: string): DocOrigin {
  switch (role) {
    case "PARTNER":
      return "PARTNER"
    case "CLIENT":
      return "CLIENT"
    default:
      return "SYSTEM"
  }
}
