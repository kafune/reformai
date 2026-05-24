import type { EmailProvider } from "./EmailProvider"
import { buildSmtpEmailProvider } from "./SmtpEmailProvider"
import { buildEmailProvider as buildResendEmailProvider } from "./ResendEmailProvider"

/**
 * Seleciona o provedor de e-mail conforme o ambiente:
 *   1. SMTP (servidor próprio na VPS) — se SMTP_HOST estiver definido;
 *   2. Resend — se RESEND_API_KEY estiver definido;
 *   3. nenhum — envio desativado (notificações in-app seguem funcionando).
 *
 * EMAIL_PROVIDER=smtp|resend força explicitamente um dos dois.
 */
export function buildEmailProvider(): EmailProvider | null {
  const forced = process.env.EMAIL_PROVIDER?.toLowerCase()

  if (forced === "smtp") return buildSmtpEmailProvider()
  if (forced === "resend") return buildResendEmailProvider()

  return buildSmtpEmailProvider() ?? buildResendEmailProvider()
}
