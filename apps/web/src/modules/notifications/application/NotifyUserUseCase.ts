import { prisma } from "@/infrastructure/database/prisma"
import { buildEmailProvider } from "@/infrastructure/email/ResendEmailProvider"
import { notificationTemplate } from "@/infrastructure/email/templates"
import { buildWebPushProvider, type WebPushProvider } from "@/infrastructure/push/WebPushProvider"
import { logger } from "@/shared/logger"
import type { EmailProvider } from "@/infrastructure/email/EmailProvider"
import { PrismaNotificationRepository } from "../infrastructure/PrismaNotificationRepository"
import type {
  CreateNotificationInput,
  NotificationDTO,
  NotificationRepository,
} from "../domain/repositories/NotificationRepository"

export class NotifyUserUseCase {
  constructor(
    private readonly repo: NotificationRepository = new PrismaNotificationRepository(),
    private readonly email: EmailProvider | null = buildEmailProvider(),
    private readonly push: WebPushProvider | null = buildWebPushProvider(),
  ) {}

  async execute(input: CreateNotificationInput): Promise<NotificationDTO> {
    const notification = await this.repo.create(input)
    logger.info("notification.created", {
      tenantId: input.tenantId,
      userId: input.userId,
      notificationId: notification.id,
    })

    if (this.email) {
      this.sendEmail(input).catch((err) =>
        logger.warn("notification.email_failed", {
          userId: input.userId,
          message: err instanceof Error ? err.message : "erro desconhecido",
        }),
      )
    }

    if (this.push) {
      this.push
        .sendToUser(input.userId, { title: input.title, body: input.body })
        .catch((err) =>
          logger.warn("notification.push_failed", {
            userId: input.userId,
            message: err instanceof Error ? err.message : "erro desconhecido",
          }),
        )
    }

    return notification
  }

  private async sendEmail(input: CreateNotificationInput): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    })
    if (!user) return

    await this.email!.send({
      to: user.email,
      subject: input.title,
      html: notificationTemplate({
        recipientName: user.name,
        title: input.title,
        body: input.body,
      }),
    })
  }
}
