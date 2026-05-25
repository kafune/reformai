# C7 — Relatório Mensal Automático para Síndico

**Grupo:** C — Features novas  
**Prioridade:** 🟡 Alto impacto, esforço médio  
**Estimativa:** 2 dias  

---

## 1. Contexto

Síndicos precisam reportar o status das obras em curso para condôminos e
conselhos fiscais. Hoje isso é manual — o síndico precisa entrar na plataforma,
filtrar casos e montar o relatório. Com automação, o relatório chega no e-mail
do síndico no primeiro dia de cada mês sem nenhuma ação.

Essa feature combina o pipeline documental existente (`ClaudeReportAgent`),
o BullMQ e o `EmailFactory` já disponíveis.

---

## 2. User Stories

- **Como síndico**, quero receber automaticamente no primeiro dia de cada mês um
  PDF resumindo as obras em andamento e concluídas no mês anterior no meu
  condomínio.

- **Como administrador**, quero poder configurar se o relatório mensal está ativo
  e para qual e-mail ele é enviado por condomínio.

- **Como síndico**, quero poder gerar o relatório manualmente quando precisar,
  além da geração automática mensal.

---

## 3. Design Técnico

### 3.1 Novo `ReportType`

```prisma
enum ReportType {
  // ...existentes...
  MONTHLY_SUMMARY  // novo
}
```

### 3.2 Template

Criar `packages/templates/resumo-mensal.md`:

```markdown
# Resumo Mensal de Obras
**Condomínio:** {{ condominium_name }}
**Período:** {{ month_year }}
**Gerado em:** {{ generated_at }}

---

## Resumo Executivo
{{ executive_summary }}

## Obras em Andamento ({{ active_count }})
{{ active_cases_table }}

## Obras Concluídas no Período ({{ concluded_count }})
{{ concluded_cases_table }}

## Obras que Necessitam Atenção
{{ attention_cases }}

---
> Este relatório foi gerado automaticamente pela plataforma ReformAI.
> {{ disclaimer }}
```

### 3.3 `MonthlyReportGeneratorUseCase`

```typescript
// document-generation/application/MonthlyReportGeneratorUseCase.ts
export class MonthlyReportGeneratorUseCase {
  async execute(condominiumId: string, month: Date): Promise<Report> {
    // 1. Buscar casos do condomínio no mês
    // 2. Agregar: ativos, concluídos, com atenção (SLA ou pendências)
    // 3. Renderizar template com ClaudeReportAgent (enrichWithAI=true)
    //    para gerar narrativa executiva
    // 4. Gerar PDF via markdownToPdf
    // 5. Salvar Report no banco e fazer upload ao storage
    // 6. Retornar o Report gerado
  }
}
```

### 3.4 Job BullMQ — `monthly-report`

Novo job periódico que roda no primeiro dia de cada mês às 08:00:

```typescript
// infrastructure/queue/MonthlyReportWorker.ts
import { CronJob } from 'bullmq'

const job = new CronJob(queue, { pattern: '0 8 1 * *' }, async (job) => {
  const condominiums = await prisma.condominium.findMany({
    where: { active: true, monthlyReportEnabled: true }
  })

  for (const condominium of condominiums) {
    const report = await monthlyReportGenerator.execute(
      condominium.id,
      startOfLastMonth()
    )
    await sendReportByEmail(condominium, report)
  }
})
```

### 3.5 Configuração por condomínio

```prisma
model Condominium {
  // ...campos existentes...
  monthlyReportEnabled  Boolean @default(true)
  monthlyReportEmail    String? // sobrescreve o email do síndico se definido
}
```

### 3.6 Geração manual

Botão "📄 Gerar relatório do mês" no painel do síndico em `/sindico/dashboard`:

```
GET /api/v1/sindico/monthly-report?month=2026-04
  Auth: CONDOMINIUM
  Response: { reportId, downloadUrl }
```

### 3.7 E-mail com o relatório

```
Assunto: Relatório de Obras — Edifício Primavera — Abril/2026

Prezado(a) síndico(a),

Segue em anexo o relatório mensal de obras do seu condomínio referente
a Abril de 2026.

Resumo:
• 3 obras em andamento
• 2 obras concluídas no período
• 1 caso requer sua atenção

[Ver relatório completo na plataforma →]

[Relatório em PDF em anexo]
```

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `packages/database/prisma/schema.prisma` | `Condominium.monthlyReportEnabled/Email`, `ReportType.MONTHLY_SUMMARY` |
| `packages/templates/resumo-mensal.md` | Criar template |
| `document-generation/application/MonthlyReportGeneratorUseCase.ts` | Criar |
| `infrastructure/queue/MonthlyReportWorker.ts` | Criar job cron |
| `workers/document-worker.ts` | Registrar o novo worker |
| `infrastructure/email/caseTemplates.ts` | Template de e-mail do relatório mensal |
| `app/api/v1/sindico/monthly-report/route.ts` | Endpoint de geração manual |
| `app/(condominium)/sindico/dashboard/page.tsx` | Botão de geração manual |
| `app/(admin)/condominiums/[id]/page.tsx` | Toggle de configuração |

---

## 4. Critérios de Aceite

- [ ] Job BullMQ gera relatórios automaticamente no 1º dia do mês
- [ ] Relatório inclui obras ativas, concluídas e que requerem atenção
- [ ] PDF é enviado por e-mail ao síndico (ou ao `monthlyReportEmail` se configurado)
- [ ] Síndico pode gerar o relatório manualmente a qualquer momento
- [ ] Admin pode desativar o relatório mensal por condomínio
- [ ] Relatório inclui disclaimer obrigatório
- [ ] Falha no envio de e-mail não interrompe o processamento dos outros condomínios

---

## 5. Dependências

- `C6` (export) — conceitos similares de agregação de dados
- `EmailFactory` configurada
- Migration nova

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Schema + migration + template MD | 1h |
| `MonthlyReportGeneratorUseCase` | 2h |
| Job BullMQ cron | 1h |
| Template de e-mail | 1h |
| API Route + UI (botão manual + config) | 1.5h |
| Testes | 1h |
| **Total** | **~7.5h (2 dias)** |
