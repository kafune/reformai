export interface NotificationDTO {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: Date
}

export interface CreateNotificationInput {
  userId: string
  tenantId: string
  title: string
  body: string
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationDTO>
  /** Lista as notificações mais recentes do usuário (limite padrão: 30). */
  listForUser(userId: string, limit?: number): Promise<NotificationDTO[]>
  /** Marca como lida. Retorna null se a notificação não existe ou não pertence ao usuário. */
  markRead(id: string, userId: string): Promise<NotificationDTO | null>
}
