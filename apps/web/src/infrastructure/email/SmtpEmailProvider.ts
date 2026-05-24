import nodemailer, { type Transporter } from "nodemailer"
import type { EmailProvider, SendEmailInput } from "./EmailProvider"

/**
 * Provider de e-mail via SMTP (servidor próprio na VPS — Postfix, etc.).
 * Configurado por SMTP_HOST/PORT/USER/PASS. Use SMTP_SECURE=true para porta 465
 * (TLS implícito); 587 usa STARTTLS automaticamente.
 */
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter
  private readonly from: string

  constructor(config: {
    host: string
    port: number
    secure: boolean
    user?: string
    pass?: string
    from: string
  }) {
    this.from = config.from
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
    })
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
  }
}

export function buildSmtpEmailProvider(): EmailProvider | null {
  const host = process.env.SMTP_HOST
  if (!host) return null

  const port = Number(process.env.SMTP_PORT ?? 587)
  const secure = process.env.SMTP_SECURE === "true" || port === 465
  const from = process.env.EMAIL_FROM ?? "ReformAI <noreply@reformai.com.br>"

  return new SmtpEmailProvider({
    host,
    port,
    secure,
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from,
  })
}
