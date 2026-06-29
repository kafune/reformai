import type { CaseStatus } from "@reformai/database"

export interface ClientNotificationMessage {
  title: string
  body: string
}

/**
 * Mensagens in-app (e push) para o morador a cada transição de status.
 * Puro e testável — sem I/O. Retorna null para status que não geram
 * notificação ao morador (ex.: transições internas).
 *
 * O `protocol` é interpolado no corpo para dar contexto no sino.
 */
export function clientTransitionMessage(
  toStatus: CaseStatus,
  protocol: string,
): ClientNotificationMessage | null {
  switch (toStatus) {
    case "AWAITING_SYNDIC_APPROVAL":
      return {
        title: "Aguardando aprovação do síndico",
        body: `Seu caso ${protocol} foi enviado ao síndico para aprovação.`,
      }
    case "AWAITING_DOCUMENTS":
      return {
        title: "Envie os documentos",
        body: `Caso ${protocol}: já pode enviar os documentos necessários para continuar.`,
      }
    case "PENDING_CORRECTIONS":
      return {
        title: "Documentos precisam de correção",
        body: `Caso ${protocol}: alguns documentos precisam de ajustes. Toque para revisar.`,
      }
    case "ELIGIBLE_FOR_RELEASE":
      return {
        title: "Reforma apta para liberação",
        body: `Boa notícia! O caso ${protocol} está apto para liberação.`,
      }
    case "RELEASED_WITH_CONDITIONS":
      return {
        title: "Reforma liberada com condições",
        body: `Caso ${protocol}: liberado. Confira as condições no detalhe do caso.`,
      }
    case "COMMERCIAL_OFFER_SENT":
      return {
        title: "Proposta comercial disponível",
        body: `Caso ${protocol}: sua proposta está pronta. Toque para revisar e aceitar.`,
      }
    case "AWAITING_PAYMENT":
      return {
        title: "Aguardando pagamento",
        body: `Caso ${protocol}: proposta aceita. Confirme o pagamento para prosseguir.`,
      }
    case "ASSIGNED_TO_PARTNER":
      return {
        title: "Parceiro técnico atribuído",
        body: `Caso ${protocol}: um profissional habilitado foi atribuído à sua obra.`,
      }
    case "CONCLUDED":
      return {
        title: "Obra concluída",
        body: `Caso ${protocol} concluído! Que tal avaliar sua experiência?`,
      }
    case "ARCHIVED":
      return {
        title: "Caso arquivado",
        body: `Seu caso ${protocol} foi arquivado.`,
      }
    default:
      return null
  }
}
