# C11 — Assinatura Digital de Documentos

**Grupo:** C — Features novas  
**Prioridade:** 🟢 Estratégico, esforço maior  
**Estimativa:** 3-5 dias  

---

## 1. Contexto

Ordens de serviço, termos de responsabilidade e acordos comerciais precisam de
assinatura formal das partes. Hoje esses documentos são gerados como PDF, baixados
e assinados fora da plataforma — o que quebra o rastreamento e dificulta auditorias.

Integrar assinatura digital dentro da plataforma fecha o ciclo documental: geração,
assinatura e armazenamento em um único lugar.

---

## 2. User Stories

- **Como administrador**, quero enviar uma ordem de serviço para assinatura digital
  do morador e do parceiro, para ter validade jurídica registrada na plataforma.

- **Como morador**, quero assinar digitalmente o termo de aceite da obra sem
  precisar imprimir, escanear e reenviar.

- **Como parceiro**, quero assinar o relatório de vistoria digitalmente diretamente
  do meu celular.

---

## 3. Design Técnico

### 3.1 Provedores de assinatura

| Provedor | Validade Jurídica (BR) | Custo | Complexidade |
|----------|----------------------|-------|-------------|
| **Clicksign** | ICP-Brasil nível 1 | ~R$0,50/doc | Baixa (REST API) |
| **D4Sign** | ICP-Brasil | ~R$0,40/doc | Média |
| **DocuSign** | eIDAS / global | $0.15-1.00/doc | Baixa (SDK) |
| **Autenticação simples** | Validade por aceite eletrônico | Zero | Mínima |

**Recomendação:** Implementar **aceite eletrônico simples** no MVP (clique em
"Assinar" + registro de IP, timestamp, user-agent — válido como prova de aceite
nos termos do Marco Civil da Internet e CC Art. 219). Integrar Clicksign em
produção quando volume justificar.

### 3.2 Novo model — `DocumentSignature`

```prisma
model DocumentSignature {
  id           String          @id @default(cuid())
  documentId   String
  userId       String
  tenantId     String
  role         SignatureRole   // SIGNER_CLIENT | SIGNER_PARTNER | WITNESS
  method       SignatureMethod // CLICK_TO_SIGN | CLICKSIGN | DOCUSIGN
  status       SignatureStatus @default(PENDING)
  signedAt     DateTime?
  ipAddress    String?
  userAgent    String?
  externalId   String?         // ID externo no Clicksign/DocuSign
  certificate  String?         // certificado base64 (ICP-Brasil)
  createdAt    DateTime        @default(now())

  document Document @relation(fields: [documentId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
}

enum SignatureRole   { SIGNER_CLIENT SIGNER_PARTNER WITNESS APPROVER }
enum SignatureMethod { CLICK_TO_SIGN CLICKSIGN D4SIGN DOCUSIGN }
enum SignatureStatus { PENDING VIEWED SIGNED REJECTED EXPIRED }
```

### 3.3 Documentos que requerem assinatura

| Tipo de documento | Quem assina |
|------------------|------------|
| `SERVICE_ORDER` (Ordem de Serviço) | Morador + Parceiro |
| `AUTHORIZATION` (Autorização de reforma) | Morador |
| `COMMERCIAL_PROPOSAL` aceita | Morador |
| `INSPECTION_REPORT` (final) | Parceiro |
| `RELEASE_OPINION` | Admin/Revisor |

### 3.4 Fluxo click-to-sign (MVP)

```
1. Admin/sistema cria envelope de assinatura para um documento
2. Sistema notifica signatários (e-mail + push)
3. Signatário acessa a plataforma e vê o documento em preview (C3)
4. Signatário clica em "✍️ Assinar documento"
5. Modal de confirmação: "Ao clicar em Confirmar, você concorda com o conteúdo
   deste documento e registra sua assinatura eletrônica."
6. POST /api/v1/cases/:id/documents/:id/sign
   Body: { method: 'CLICK_TO_SIGN' }
   Backend registra: userId, IP, userAgent, timestamp
7. Documento recebe `DocumentSignature` com status SIGNED
8. PDF é re-gerado com rodapé: "Assinado eletronicamente por [Nome] em [data/hora]
   — IP: [ip] — Protocolo: [id]"
9. Quando todos os signatários assinaram → status do documento VALID
```

### 3.5 Abstração `SignatureProvider`

```typescript
// infrastructure/signature/SignatureProvider.ts
export interface SignatureProvider {
  createEnvelope(document: Buffer, signers: Signer[]): Promise<{ envelopeId: string; signingUrls: Record<string, string> }>
  getStatus(envelopeId: string): Promise<EnvelopeStatus>
  downloadSigned(envelopeId: string): Promise<Buffer>
}

// infrastructure/signature/ClickToSignProvider.ts  ← MVP (sem API externa)
// infrastructure/signature/ClicksignProvider.ts    ← Produção
```

### 3.6 UI — Painel de assinaturas

No detalhe do caso, card "Assinaturas pendentes":

```
┌──────────────────────────────────────────────┐
│  Assinaturas — Ordem de Serviço              │
│                                              │
│  João Silva (Morador)     ✅ Assinado         │
│  25/05/2026 14:32                            │
│                                              │
│  Eng. Carlos Matos (Parceiro)  ⏳ Pendente   │
│  [Lembrar]  [Ver documento]                  │
│                                              │
│  [⬇ Baixar documento assinado]               │
└──────────────────────────────────────────────┘
```

### 3.7 Prova de assinatura no PDF final

Ao concluir o processo (todos assinados), regenerar o PDF com:
- Página final de certificação com lista de signatários, timestamps e IPs
- QR code para verificação de autenticidade (link `/verify/[documentId]`)
- Hash SHA-256 do conteúdo original

### 3.8 Rota pública de verificação

```
GET /verify/:signatureId
  Público — mostra informações de autenticidade sem expor dados sensíveis
```

### 3.9 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `DocumentSignature` + enums |
| `document-management/application/CreateSignatureEnvelopeUseCase.ts` | Criar |
| `document-management/application/SignDocumentUseCase.ts` | Criar |
| `infrastructure/signature/SignatureProvider.ts` | Interface |
| `infrastructure/signature/ClickToSignProvider.ts` | MVP impl |
| `app/api/v1/cases/[caseId]/documents/[docId]/sign/route.ts` | Criar |
| `app/api/v1/cases/[caseId]/documents/[docId]/signatures/route.ts` | Listar assinaturas |
| `app/verify/[signatureId]/page.tsx` | Página pública de verificação |
| Páginas do caso (morador, parceiro, admin) | Card de assinaturas |

---

## 4. Critérios de Aceite

- [ ] Click-to-sign funciona com registro de IP, userAgent e timestamp
- [ ] PDF final inclui página de certificação com lista de signatários
- [ ] Documento só recebe status `VALID` após todos os signatários assinarem
- [ ] Rota pública `/verify/:id` exibe autenticidade sem dados sensíveis
- [ ] Notificação enviada a cada signatário quando é sua vez
- [ ] Lembrete enviado se signatário não assinar em 48h
- [ ] Signatário pode rejeitar (e informar motivo)
- [ ] `AuditLog` registra cada assinatura com IP e timestamp

---

## 5. Dependências

- C3 (preview inline) — para exibir o documento antes de assinar
- C2 (e-mail) — para notificar signatários

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration | 1h |
| `SignatureProvider` interface + `ClickToSignProvider` | 2h |
| Use cases (Create + Sign) | 2h |
| API Routes | 1.5h |
| PDF com página de certificação | 2h |
| UI (card de assinaturas + modal) | 3h |
| Rota pública `/verify` | 1h |
| Testes | 1.5h |
| **Total** | **~14h (3-4 dias)** |
