import { logger } from "@/shared/logger"
import { PrismaNotificationRepository } from "../infrastructure/PrismaNotificationRepository"
import type {
  CreateNotificationInput,
  NotificationDTO,
  NotificationRepository,
} from "../domain/repositories/NotificationRepository"

/**
 * Cria uma notificação para um usuário.
 * Ponto de entrada único para outros módulos emitirem notificações
 * sem depender da infraestrutura Prisma diretamente.
 */
export class NotifyUserUseCase {
  constructor(
    private readonly repo: NotificationRepository = new PrismaNotificationRepository(),
  ) {}

  async execute(input: CreateNotificationInput): Promise<NotificationDTO> {
    const notification = await this.repo.create(input)
    logger.info("notification.created", {
      tenantId: input.tenantId,
      userId: input.userId,
      notificationId: notification.id,
    })
    return notification
  }
}
