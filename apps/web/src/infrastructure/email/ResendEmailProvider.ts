import { Resend } from "resend"
import type { EmailProvider, SendEmailInput } from "./EmailProvider"

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend
  private readonly from: string

  constructor(apiKey: string, from: string) {
    this.resend = new Resend(apiKey)
    this.from = from
  }

  async send(input: SendEmailInput): Promise<void> {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
    if (error) throw new Error(`Resend: ${error.message}`)
  }
}

export function buildEmailProvider(): EmailProvider | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  const from = process.env.EMAIL_FROM ?? "ReformAI <noreply@reformai.com.br>"
  return new ResendEmailProvider(apiKey, from)
}
