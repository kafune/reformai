import webpush from "web-push"
import { prisma } from "@/infrastructure/database/prisma"
import { logger } from "@/shared/logger"

export interface PushPayload {
  title: string
  body: string
  url?: string
}

export interface WebPushProvider {
  /** Envia para todas as assinaturas do usuário; remove as mortas (404/410). */
  sendToUser(userId: string, payload: PushPayload): Promise<void>
}

let configured = false

function ensureConfigured(): boolean {
  if (configured) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? "mailto:contato@reformai.local"
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

class WebPushProviderImpl implements WebPushProvider {
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } })
    if (subs.length === 0) return

    const json = JSON.stringify(payload)

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            json,
          )
        } catch (err) {
          const statusCode = (err as { statusCode?: number }).statusCode
          // 404/410: assinatura expirada/cancelada — remove para não reenviar.
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
          } else {
            logger.warn("webpush.send_failed", { userId, statusCode })
          }
        }
      }),
    )
  }
}

/** Retorna o provider se as chaves VAPID estiverem configuradas; senão null. */
export function buildWebPushProvider(): WebPushProvider | null {
  if (!ensureConfigured()) return null
  return new WebPushProviderImpl()
}
