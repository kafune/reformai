# C12 — Chat Síndico ↔ Morador dentro do Caso

**Grupo:** C — Features novas  
**Prioridade:** 🟢 Estratégico, esforço maior  
**Estimativa:** 2-3 dias  

---

## 1. Contexto

O `ChatMessage` model existe e tem roles `USER`, `ASSISTANT` e `SYSTEM`. O chat
atual é exclusivamente para triagem com a IA. Não existe canal de comunicação
humano-a-humano dentro do caso.

Consequência: síndico e morador trocam mensagens por WhatsApp, e-mail ou ligação,
sem nenhum registro na plataforma. Isso cria:
- Perda de rastreabilidade
- Risco de acordos verbais não documentados
- Dificuldade para admin auditar comunicações sobre um caso

---

## 2. User Stories

- **Como síndico**, quero enviar uma mensagem ao morador dentro do caso para pedir
  esclarecimentos sobre a reforma, com o histórico sempre visível para todos os
  envolvidos.

- **Como morador**, quero responder às perguntas do síndico diretamente na
  plataforma, sem precisar encontrar o e-mail certo para responder.

- **Como administrador**, quero poder visualizar as conversas de todos os casos
  para auditar decisões tomadas.

- **Como parceiro**, quero enviar uma mensagem ao morador sobre detalhes técnicos
  da vistoria, sem precisar do telefone pessoal.

---

## 3. Design Técnico

### 3.1 Estender `ChatMessage` para múltiplos threads

O `ChatMessage` atual mistura mensagens de IA e humanas no mesmo stream. Para
não quebrar o chat de triagem, criar um campo `thread` que segrega os contextos:

```prisma
model ChatMessage {
  // ...campos existentes...
  thread    MessageThread @default(TRIAGE)  // novo campo
  senderId  String?                         // novo campo (null = sistema/IA)

  sender User? @relation(fields: [senderId], references: [id])
}

enum MessageThread {
  TRIAGE       // chat atual com a IA
  DISCUSSION   // novo: humano a humano
}
```

### 3.2 Permissões por thread

| Thread | Quem pode ler | Quem pode escrever |
|--------|-------------|------------------|
| `TRIAGE` | Dono do caso + Admin + Síndico | Dono do caso (via IA) |
| `DISCUSSION` | Dono do caso + Síndico + Admin + Parceiro (atribuído) | Todos os acima |

### 3.3 API Routes

```
# Thread de discussão (não-streaming, pull model)
GET  /api/v1/cases/:caseId/messages?thread=DISCUSSION
POST /api/v1/cases/:caseId/messages
  Body: { content: string, thread: 'DISCUSSION' }
  Auth: Morador (dono) | Síndico (mesmo condomínio) | Admin | Parceiro (atribuído)
```

### 3.4 UI — Abas no detalhe do caso

Na página do caso, duas abas:

```
[💬 Triagem com IA]   [👥 Discussão (3)]
```

A aba de Discussão tem uma interface de chat simplificada (sem streaming, pull
simples com refresh a cada 30s):

```
┌──────────────────────────────────────────────────┐
│  Síndico José Costa  •  25/05/2026 14:32         │
│  Você pode confirmar se a reforma inclui         │
│  mudança na rede de gás?                         │
│                                                  │
│           João Silva (Morador) •  14:45          │
│           Sim, apenas substituição do ramal      │
│           interno sem tocar na prumada.          │
│                                                  │
│  Síndico José Costa  •  14:47                    │
│  Ok, aprovado. Pode prosseguir.                  │
├──────────────────────────────────────────────────│
│  ┌──────────────────────────────┐  [Enviar]      │
│  │  Digite sua mensagem...      │                │
│  └──────────────────────────────┘                │
└──────────────────────────────────────────────────┘
```

### 3.5 Notificações

- Nova mensagem na aba de Discussão → notificação in-app para todos os participantes
  do caso que não são o remetente
- Se não lida em 2h → e-mail de lembrete

### 3.6 Indicador de não-lidas

Badge na aba "Discussão (3)" com número de mensagens não lidas pelo usuário atual.

Implementar via `MessageRead` — tabela de leitura por usuário:

```prisma
model MessageRead {
  messageId String
  userId    String
  readAt    DateTime @default(now())

  @@id([messageId, userId])
}
```

### 3.7 Diferenças vs chat de triagem

| Aspecto | Triagem (TRIAGE) | Discussão (DISCUSSION) |
|---------|----------------|----------------------|
| Participantes | Morador + IA | Morador + Síndico + Admin + Parceiro |
| Streaming | SSE em tempo real | Pull a cada 30s |
| Histórico | Iniciado no DRAFT | Iniciado em qualquer estado |
| Visibilidade no admin | Sim | Sim |

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `ChatMessage.thread`, `MessageThread`, `MessageRead` |
| `app/api/v1/cases/[caseId]/messages/route.ts` | Suportar `?thread=DISCUSSION` + POST |
| `app/cases/[caseId]/page.tsx` | Abas Triagem / Discussão |
| `app/(condominium)/sindico/cases/[caseId]/page.tsx` | Adicionar aba de Discussão |
| `app/(partner)/partner/cases/[caseId]/page.tsx` | Adicionar aba de Discussão |
| `app/(admin)/review-queue/[caseId]/page.tsx` | Adicionar aba de Discussão |
| `interfaces/components/ui/DiscussionChat.tsx` | Criar componente |

---

## 4. Critérios de Aceite

- [ ] Morador, síndico, admin e parceiro (atribuído) podem escrever e ler a aba de Discussão
- [ ] Chat de triagem (TRIAGE) não é afetado pela mudança
- [ ] Mensagens da Discussão não são enviadas para a IA
- [ ] Badge de não-lidas exibido na aba
- [ ] Notificação in-app enviada ao remetente e destinatários
- [ ] Admin pode ler todas as conversas para auditoria
- [ ] Parceiro não-atribuído ao caso não consegue ler a discussão (403)
- [ ] Síndico de outro condomínio não consegue ler (403)

---

## 5. Dependências

- Migration nova (`thread` em `ChatMessage`, `MessageRead`)

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 30 min |
| API Route (suporte a thread) | 1.5h |
| Componente `DiscussionChat` | 3h |
| Integrar nas 4 páginas | 2h |
| Notificações | 1h |
| Testes | 1h |
| **Total** | **~9h (2-3 dias)** |
