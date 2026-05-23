const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 580px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: #1e3a2f; padding: 24px 32px; }
    .header h1 { margin: 0; color: #ffffff; font-size: 20px; font-weight: 600; letter-spacing: -0.3px; }
    .body { padding: 32px; color: #27272a; font-size: 15px; line-height: 1.6; }
    .body p { margin: 0 0 16px; }
    .cta { display: inline-block; margin-top: 8px; padding: 12px 24px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .footer { padding: 20px 32px; background: #f4f4f5; color: #71717a; font-size: 12px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>ReformAI</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      Você está recebendo este email porque é usuário da plataforma ReformAI.<br>
      Em caso de dúvidas, acesse <a href="${appUrl()}">${appUrl()}</a>.
    </div>
  </div>
</body>
</html>`
}

export function notificationTemplate(params: {
  recipientName: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `<a class="cta" href="${params.ctaUrl}">${params.ctaLabel}</a>`
      : `<a class="cta" href="${appUrl()}">Acessar plataforma</a>`

  const bodyHtml = `
    <p>Olá, <strong>${params.recipientName}</strong>.</p>
    <p>${params.body}</p>
    <p>${cta}</p>
  `
  return layout(params.title, bodyHtml)
}

export function newResidentTemplate(params: {
  sindicoName: string
  residentName: string
  unitLabel: string
  condominiumName: string
}): string {
  const body = `
    <p>Olá, <strong>${params.sindicoName}</strong>.</p>
    <p>
      Um novo morador se cadastrou na plataforma:
      <strong>${params.residentName}</strong>, unidade <strong>${params.unitLabel}</strong>
      em <strong>${params.condominiumName}</strong>.
    </p>
    <p>Acesse o painel para ver os detalhes do cadastro.</p>
    <p><a class="cta" href="${appUrl()}/sindico/dashboard">Ver painel</a></p>
  `
  return layout("Novo morador cadastrado", body)
}

export function passwordResetTemplate(params: {
  recipientName: string
  resetUrl: string
}): string {
  const body = `
    <p>Olá, <strong>${params.recipientName}</strong>.</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta na ReformAI.</p>
    <p>Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.</p>
    <p><a class="cta" href="${params.resetUrl}">Redefinir senha</a></p>
    <p style="color:#71717a;font-size:13px;">
      Se você não solicitou isso, ignore este e-mail — sua senha permanece inalterada.
    </p>
  `
  return layout("Redefinição de senha", body)
}

export function inviteTemplate(params: {
  recipientName: string
  inviteUrl: string
  roleLabel: string
}): string {
  const body = `
    <p>Olá, <strong>${params.recipientName}</strong>.</p>
    <p>Você foi convidado(a) para acessar a plataforma ReformAI como <strong>${params.roleLabel}</strong>.</p>
    <p>Clique no botão abaixo para criar sua senha e ativar a conta. O convite expira em 7 dias.</p>
    <p><a class="cta" href="${params.inviteUrl}">Aceitar convite</a></p>
  `
  return layout("Convite para a ReformAI", body)
}

export function triageDoneTemplate(params: {
  residentName: string
  protocol: string
  riskLevel: string
  triageScore: number
}): string {
  const riskPt: Record<string, string> = {
    LOW: "Baixo",
    MEDIUM: "Médio",
    HIGH: "Alto",
    CRITICAL: "Crítico",
  }
  const body = `
    <p>Olá, <strong>${params.residentName}</strong>.</p>
    <p>
      A triagem técnica do seu caso <strong>${params.protocol}</strong> foi concluída.
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;">
      <li>Nível de risco: <strong>${riskPt[params.riskLevel] ?? params.riskLevel}</strong></li>
      <li>Score de triagem: <strong>${params.triageScore}/100</strong></li>
    </ul>
    <p>Acesse o portal para ver os próximos passos da sua reforma.</p>
    <p><a class="cta" href="${appUrl()}/cases">Ver meu caso</a></p>
  `
  return layout("Triagem técnica concluída", body)
}
