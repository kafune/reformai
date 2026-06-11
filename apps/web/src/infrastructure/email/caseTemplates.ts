/**
 * Templates de e-mail por status do caso.
 *
 * Cada entrada define: destinatários, assunto e corpo HTML.
 * Todos incluem protocolo, link contextual e disclaimer LGPD/ART-RRT.
 */

import type { CaseStatus } from "@reformai/database"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmailTarget = "CLIENT" | "CONDOMINIUM" | "ADMIN" | "PARTNER"

export interface CaseEmailParams {
  protocol: string
  caseUrl: string
  recipientName: string
  /** Status em português — preenchido automaticamente pelo serviço */
  statusLabel?: string
}

export interface CaseEmailTemplate {
  subject: (protocol: string) => string
  targets: EmailTarget[]
  html: (params: CaseEmailParams) => string
  /** Assunto/corpo específicos por destinatário (fallback: subject/html acima). */
  overrides?: Partial<
    Record<
      EmailTarget,
      { subject?: (protocol: string) => string; html?: (params: CaseEmailParams) => string }
    >
  >
}

// ---------------------------------------------------------------------------
// Layout base (reutiliza o padrão visual de templates.ts)
// ---------------------------------------------------------------------------

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
    .protocol-badge { display: inline-block; background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; border-radius: 4px; padding: 4px 10px; font-size: 13px; font-weight: 600; font-family: monospace; margin-bottom: 16px; }
    .cta { display: inline-block; margin-top: 8px; padding: 12px 24px; background: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .alert { background: #fef9c3; border-left: 4px solid #ca8a04; padding: 12px 16px; border-radius: 0 4px 4px 0; margin: 16px 0; font-size: 14px; }
    .alert-red { background: #fef2f2; border-left-color: #dc2626; }
    .footer { padding: 20px 32px; background: #f4f4f5; color: #71717a; font-size: 12px; line-height: 1.6; }
    .disclaimer { margin-top: 8px; font-style: italic; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h1>ReformAI</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      Você está recebendo este e-mail porque está cadastrado na plataforma ReformAI.<br>
      <span class="disclaimer">
        Esta é uma mensagem automática. Documentos e análises gerados por IA são assistivos
        e não substituem a responsabilidade técnica do profissional habilitado (ART/RRT).
      </span>
    </div>
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Templates por status
// ---------------------------------------------------------------------------

export const CASE_STATUS_TEMPLATES: Partial<Record<CaseStatus, CaseEmailTemplate>> = {

  // ── Síndico: aguardando aprovação ──────────────────────────────────────
  AWAITING_SYNDIC_APPROVAL: {
    targets: ["CONDOMINIUM", "CLIENT"],
    subject: (p) => `[${p}] Reforma aguarda sua aprovação`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Reforma aguarda aprovação do síndico",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <div class="alert">
          <strong>Ação necessária:</strong> uma reforma solicitada no seu condomínio
          aguarda a sua aprovação antes de prosseguir para a análise técnica.
        </div>
        <p>
          Acesse o painel do síndico para revisar os detalhes da reforma, o escopo
          declarado e o nível de risco calculado. Você pode aprovar ou recusar
          com um comentário.
        </p>
        <p><a class="cta" href="${caseUrl}">Revisar reforma agora</a></p>
        `,
      ),
  },

  // ── Morador: enviar documentos ──────────────────────────────────────────
  AWAITING_DOCUMENTS: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Documentos necessários para sua reforma`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Documentos necessários para sua reforma",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          O escopo da sua reforma foi classificado com sucesso. Para avançar,
          precisamos que você envie os documentos solicitados.
        </p>
        <p>
          Acesse o portal, vá até o seu caso e faça o upload dos documentos indicados
          no checklist. Quanto antes você enviar, mais rápido o processo avança.
        </p>
        <p><a class="cta" href="${caseUrl}">Enviar documentos agora</a></p>
        `,
      ),
  },

  // ── Morador: corrigir documentos ────────────────────────────────────────
  PENDING_CORRECTIONS: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Corrija os documentos da sua reforma`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Corrija os documentos da sua reforma",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <div class="alert alert-red">
          <strong>Atenção:</strong> foram identificadas pendências nos documentos enviados
          para o seu caso de reforma.
        </div>
        <p>
          Acesse o portal para verificar as pendências detalhadas e reenviar os documentos
          corrigidos. O caso só poderá avançar após a correção.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver pendências e corrigir</a></p>
        `,
      ),
  },

  // ── Morador + Síndico: apto para liberação ──────────────────────────────
  ELIGIBLE_FOR_RELEASE: {
    targets: ["CLIENT", "CONDOMINIUM"],
    overrides: {
      CONDOMINIUM: {
        subject: (p) => `[${p}] Reforma no seu condomínio liberada`,
        html: ({ protocol, caseUrl, recipientName }) =>
          layout(
            "Reforma liberada no seu condomínio",
            `
            <p>Olá, <strong>${recipientName}</strong>!</p>
            <div class="protocol-badge">${protocol}</div>
            <p>
              A documentação de uma reforma no seu condomínio foi analisada e o caso
              está <strong>apto para liberação</strong>.
            </p>
            <p>
              Acesse o painel do síndico para acompanhar o caso e os próximos passos.
            </p>
            <p><a class="cta" href="${caseUrl}">Acompanhar caso</a></p>
            `,
          ),
      },
    },
    subject: (p) => `[${p}] Sua reforma está apta para liberação`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Reforma apta para liberação",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Ótima notícia! Todos os documentos do seu caso foram analisados e a reforma
          está <strong>apta para liberação</strong>.
        </p>
        <p>
          Os próximos passos serão comunicados em breve. Acesse o portal para
          acompanhar o andamento.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver caso</a></p>
        `,
      ),
  },

  // ── Morador + Síndico: liberação com condições ──────────────────────────
  RELEASED_WITH_CONDITIONS: {
    targets: ["CLIENT", "CONDOMINIUM"],
    overrides: {
      CONDOMINIUM: {
        subject: (p) => `[${p}] Reforma no seu condomínio liberada com condições`,
        html: ({ protocol, caseUrl, recipientName }) =>
          layout(
            "Reforma liberada com condições no seu condomínio",
            `
            <p>Olá, <strong>${recipientName}</strong>!</p>
            <div class="protocol-badge">${protocol}</div>
            <div class="alert">
              Uma reforma no seu condomínio foi liberada com <strong>condições
              específicas</strong> que devem ser observadas durante a execução.
            </div>
            <p>
              Acesse o painel do síndico para conhecer as condições e acompanhar a obra.
            </p>
            <p><a class="cta" href="${caseUrl}">Ver condições</a></p>
            `,
          ),
      },
    },
    subject: (p) => `[${p}] Reforma liberada com condições`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Reforma liberada com condições",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <div class="alert">
          Sua reforma foi liberada, mas existem <strong>condições específicas</strong>
          que devem ser observadas durante a execução.
        </div>
        <p>
          Acesse o portal para ler as condições detalhadas e confirme que as entendeu
          antes de iniciar as obras.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver condições</a></p>
        `,
      ),
  },

  // ── Morador: proposta comercial ─────────────────────────────────────────
  COMMERCIAL_OFFER_SENT: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Proposta comercial disponível para sua reforma`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Proposta comercial disponível",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Uma proposta comercial foi preparada para o seu caso de reforma.
          Ela inclui o plano de acompanhamento técnico, vistorias e todos os
          serviços necessários.
        </p>
        <p>
          Acesse o portal para visualizar os detalhes e aceitar a proposta
          para dar continuidade ao processo.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver proposta comercial</a></p>
        `,
      ),
  },

  // ── Morador: aguardando pagamento ───────────────────────────────────────
  AWAITING_PAYMENT: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Confirme o pagamento para prosseguir`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Pagamento pendente",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Sua proposta foi aceita! O próximo passo é a confirmação do pagamento
          para que possamos atribuir um parceiro técnico ao seu caso.
        </p>
        <p>
          Acesse o portal para verificar as instruções de pagamento e confirmar
          a sua transação.
        </p>
        <p><a class="cta" href="${caseUrl}">Confirmar pagamento</a></p>
        `,
      ),
  },

  // ── Morador + Parceiro: parceiro atribuído ──────────────────────────────
  ASSIGNED_TO_PARTNER: {
    targets: ["CLIENT", "PARTNER"],
    overrides: {
      PARTNER: {
        subject: (p) => `[${p}] Novo caso atribuído a você`,
        html: ({ protocol, caseUrl, recipientName }) =>
          layout(
            "Novo caso atribuído",
            `
            <p>Olá, <strong>${recipientName}</strong>!</p>
            <div class="protocol-badge">${protocol}</div>
            <div class="alert">
              <strong>Ação necessária:</strong> um novo caso de reforma foi atribuído
              a você. Acesse o painel do parceiro para aceitar ou recusar a atribuição.
            </div>
            <p><a class="cta" href="${caseUrl}">Ver caso atribuído</a></p>
            `,
          ),
      },
    },
    subject: (p) => `[${p}] Parceiro técnico atribuído à sua obra`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Parceiro técnico atribuído",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Um parceiro técnico habilitado foi atribuído ao seu caso de reforma.
          Em breve ele entrará em contato para agendar as vistorias necessárias.
        </p>
        <p>
          Acesse o portal para ver as informações do parceiro e acompanhar
          os próximos passos.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver detalhes do caso</a></p>
        `,
      ),
  },

  // ── Morador: vistoria agendada ──────────────────────────────────────────
  INSPECTIONS_SCHEDULED: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Vistoria agendada para sua reforma`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Vistoria agendada",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Uma ou mais vistorias foram agendadas para o seu caso de reforma.
          Por favor, garanta o acesso ao local nas datas e horários indicados.
        </p>
        <p>
          Acesse o portal para ver as datas, horários e informações sobre
          as vistorias agendadas.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver vistorias agendadas</a></p>
        `,
      ),
  },

  // ── Morador + Síndico: concluído ────────────────────────────────────────
  CONCLUDED: {
    targets: ["CLIENT", "CONDOMINIUM"],
    subject: (p) => `[${p}] Obra concluída com sucesso`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Obra concluída",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          Temos uma ótima notícia: o processo de reforma vinculado a este caso
          foi <strong>concluído com sucesso</strong>!
        </p>
        <p>
          Todas as vistorias foram realizadas e os documentos estão em ordem.
          Acesse o portal para visualizar o relatório final e os documentos gerados.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver relatório final</a></p>
        `,
      ),
  },

  // ── Morador: arquivado ──────────────────────────────────────────────────
  ARCHIVED: {
    targets: ["CLIENT"],
    subject: (p) => `[${p}] Caso arquivado`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        "Caso arquivado",
        `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <div class="protocol-badge">${protocol}</div>
        <p>
          O seu caso de reforma foi <strong>arquivado</strong>. Isso pode ter ocorrido
          por inatividade, cancelamento ou decisão administrativa.
        </p>
        <p>
          Se você acredita que isso ocorreu por engano, ou deseja reabrir o processo,
          entre em contato com a administração do condomínio ou acesse o portal.
        </p>
        <p><a class="cta" href="${caseUrl}">Ver detalhes</a></p>
        `,
      ),
  },

  // ── Admin + Parceiro (revisor técnico): revisão humana necessária ───────
  HUMAN_REVIEW_REQUIRED: {
    targets: ["ADMIN", "PARTNER"],
    overrides: {
      PARTNER: {
        subject: (p) => `[AÇÃO NECESSÁRIA] Caso ${p} aguarda parecer técnico`,
        html: ({ protocol, caseUrl, recipientName }) =>
          layout(
            `Caso ${protocol} aguarda parecer técnico`,
            `
            <p>Olá, <strong>${recipientName}</strong>.</p>
            <div class="protocol-badge">${protocol}</div>
            <div class="alert alert-red">
              <strong>Ação necessária:</strong> um caso de reforma teve a documentação
              analisada pela IA e aguarda o parecer de um responsável técnico habilitado.
            </div>
            <p>
              Acesse a fila de revisão técnica para verificar os documentos, a análise
              da IA e registrar o seu parecer (aprovar, aprovar com condições,
              solicitar correções ou arquivar).
            </p>
            <p><a class="cta" href="${caseUrl}">Emitir parecer técnico</a></p>
            `,
          ),
      },
    },
    subject: (p) => `[AÇÃO NECESSÁRIA] Caso ${p} aguarda revisão humana`,
    html: ({ protocol, caseUrl, recipientName }) =>
      layout(
        `[AÇÃO NECESSÁRIA] Caso ${protocol} aguarda revisão`,
        `
        <p>Olá, <strong>${recipientName}</strong>.</p>
        <div class="protocol-badge">${protocol}</div>
        <div class="alert alert-red">
          <strong>Ação necessária:</strong> o caso acima foi classificado como de alto
          risco ou com características que exigem revisão humana antes de avançar.
        </div>
        <p>
          Acesse a fila de revisão para analisar o caso, verificar os documentos
          e tomar a decisão adequada (aprovar, aprovar com condições, solicitar
          correções ou arquivar).
        </p>
        <p><a class="cta" href="${caseUrl}">Revisar caso agora</a></p>
        `,
      ),
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Status em português para exibição */
export const STATUS_LABELS: Partial<Record<CaseStatus, string>> = {
  DRAFT: "Rascunho",
  AWAITING_SCOPE_DETAILS: "Aguardando detalhes do escopo",
  SCOPE_CLASSIFIED: "Escopo classificado",
  AWAITING_SYNDIC_APPROVAL: "Aguardando aprovação do síndico",
  AWAITING_DOCUMENTS: "Aguardando documentos",
  DOCUMENTS_UNDER_REVIEW: "Documentos em análise",
  PENDING_CORRECTIONS: "Correções pendentes",
  ELIGIBLE_FOR_RELEASE: "Apto para liberação",
  RELEASED_WITH_CONDITIONS: "Liberado com condições",
  HUMAN_REVIEW_REQUIRED: "Revisão humana necessária",
  COMMERCIAL_OFFER_SENT: "Proposta comercial enviada",
  AWAITING_PAYMENT: "Aguardando pagamento",
  ASSIGNED_TO_PARTNER: "Parceiro atribuído",
  ART_RRT_PENDING: "ART/RRT pendente",
  INSPECTIONS_SCHEDULED: "Vistorias agendadas",
  IN_EXECUTION: "Em execução",
  CONCLUDED: "Concluído",
  ARCHIVED: "Arquivado",
}
