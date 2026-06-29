/**
 * Traduz o campo `triggeredBy` de um CaseTransitionLog (ex.: "user:abc",
 * "system", "ai", "reviewer:xyz") em um rótulo amigável ao morador.
 * NUNCA expõe IDs internos.
 *
 * Quando o ator é um usuário e coincide com o usuário atual, mostra "Você";
 * caso contrário, generaliza para "Equipe".
 */
export function sanitizeActor(triggeredBy: string, currentUserId: string): string {
  if (triggeredBy === "system") return "Sistema"
  if (triggeredBy === "ai") return "Assistente IA"
  if (triggeredBy.startsWith("ai:")) return "Assistente IA"
  if (triggeredBy.startsWith("reviewer:")) return "Equipe técnica"
  if (triggeredBy.startsWith("user:")) {
    const id = triggeredBy.slice("user:".length)
    return id === currentUserId ? "Você" : "Equipe"
  }
  return "Sistema"
}
