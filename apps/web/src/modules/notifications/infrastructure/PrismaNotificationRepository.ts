import { prisma } from "@/infrastructure/database/prisma"
import type {
  CreateNotificationInput,
  NotificationDTO,
  NotificationRepository,
} from "../domain/repositories/NotificationRepository"

const SELECT = { id: true, title: true, body: true, read: true, createdAt: true } as const

export class PrismaNotificationRepository implements NotificationRepository {
  async create(input: CreateNotificationInput): Promise<NotificationDTO> {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        title: input.title,
        body: input.body,
      },
      select: SELECT,
    })
  }

  async listForUser(userId: string, limit = 30): Promise<NotificationDTO[]> {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: SELECT,
    })
  }

  async markRead(id: string, userId: string): Promise<NotificationDTO | null> {
    const owner = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true },
    })
    if (!owner || owner.userId !== userId) return null
    return prisma.notification.update({
      where: { id },
      data: { read: true },
      select: SELECT,
    })
  }
}
