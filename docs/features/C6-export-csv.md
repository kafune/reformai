# C6 — Export CSV/Excel de Casos

**Grupo:** C — Features novas  
**Prioridade:** 🟡 Alto impacto, esforço médio  
**Estimativa:** 1 dia  

---

## 1. Contexto

Administradoras de condomínios trabalham com planilhas — relatórios mensais para
síndicos, auditorias internas e conformidade LGPD (direito de portabilidade). Sem
export, todo dado que precisa sair da plataforma é copiado manualmente.

O export também é exigível em processos de due diligence ou auditoria jurídica.

---

## 2. User Stories

- **Como administrador**, quero exportar todos os casos de um mês em CSV para
  enviar o relatório para a administradora do condomínio.

- **Como síndico**, quero exportar as obras do meu condomínio em Excel para
  apresentar na assembleia anual.

- **Como SUPER_ADMIN**, quero exportar dados de um tenant para atender a uma
  solicitação de portabilidade LGPD.

---

## 3. Design Técnico

### 3.1 Formatos suportados

- **CSV** — universal, zero dependências extras (geração manual com template strings)
- **XLSX** — usar `xlsx` (SheetJS, 4KB gzip, sem dependência nativa)

```bash
bun add xlsx
```

### 3.2 Campos exportados

| Coluna | Fonte |
|--------|-------|
| Protocolo | `ReformCase.protocol` |
| Data de abertura | `ReformCase.createdAt` |
| Status atual | `ReformCase.status` (traduzido para PT-BR) |
| Nível de risco | `ReformCase.riskLevel` |
| Exige ART | `ReformCase.requiresART` |
| Condomínio | `Condominium.name` |
| Unidade | `Unit.identifier` |
| Bloco | `Unit.block` |
| Morador | `User.name` |
| E-mail do morador | `User.email` |
| Serviços | `ReformCase.reformScope.services` (join com vírgula) |
| Parceiro | `Partner.user.name` (se atribuído) |
| Data de conclusão | `CaseTransitionLog` → quando entrou em `CONCLUDED` |

### 3.3 API Route

```
GET /api/v1/admin/cases/export?format=csv&from=2026-01-01&to=2026-05-31&condominiumId=...&status=CONCLUDED
  Auth: ADMIN | SUPER_ADMIN | MANAGER | CONDOMINIUM (só seu condomínio)
  Response: arquivo com Content-Disposition: attachment
```

Parâmetros opcionais: `format` (csv|xlsx), `from`, `to`, `condominiumId`, `status`.

**Limites:** máximo 1000 registros por export para evitar timeout. Se > 1000, retornar
412 com mensagem sugerindo filtros mais restritivos ou exportar por período.

### 3.4 Geração do CSV (sem lib)

```typescript
function toCsv(rows: ExportRow[]): string {
  const headers = Object.keys(rows[0]).join(',')
  const body = rows.map(r =>
    Object.values(r).map(v =>
      typeof v === 'string' && v.includes(',')
        ? `"${v.replace(/"/g, '""')}"`  // RFC 4180
        : v
    ).join(',')
  ).join('\n')
  return `${headers}\n${body}`
}
```

### 3.5 Geração do XLSX

```typescript
import { utils, write } from 'xlsx'

const ws = utils.json_to_sheet(rows)
const wb = utils.book_new()
utils.book_append_sheet(wb, ws, 'Casos')
const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' })
```

### 3.6 UI — Botão de export

Em `/admin/review-queue` e `/sindico/cases`, adicionar botão "⬇ Exportar" com
dropdown:

```
[⬇ Exportar ▾]
  ├── CSV
  └── Excel (.xlsx)
```

O export aplica os **mesmos filtros ativos** na listagem (status, data, etc.).

### 3.7 Segurança e LGPD

- Export sempre tenant-scoped
- CONDOMINIUM só exporta casos do seu condomínio
- Campos sensíveis (e-mail) incluídos apenas para ADMIN/SUPER_ADMIN/MANAGER
- `AuditLog` registra `admin.cases.exported` com user, filtros e contagem de registros

### 3.8 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `app/api/v1/admin/cases/export/route.ts` | Criar endpoint |
| `case-intake/application/ExportCasesUseCase.ts` | Criar |
| `interfaces/components/ui/ExportButton.tsx` | Criar componente dropdown |
| `app/(admin)/review-queue/page.tsx` | Adicionar `ExportButton` |
| `app/(condominium)/sindico/cases/page.tsx` | Adicionar `ExportButton` |

---

## 4. Critérios de Aceite

- [ ] Export CSV funciona e abre corretamente em Excel/LibreOffice
- [ ] Export XLSX funciona com formatação de cabeçalho
- [ ] Filtros ativos na listagem são aplicados ao export
- [ ] Limite de 1000 registros com erro amigável se excedido
- [ ] CONDOMINIUM só exporta os casos do seu condomínio
- [ ] E-mails incluídos apenas para ADMIN/SUPER_ADMIN
- [ ] `AuditLog` registra a exportação
- [ ] Encoding UTF-8 com BOM para CSV (garante acentuação no Windows)

---

## 5. Dependências

- `xlsx` como dependência nova

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| `ExportCasesUseCase` + query | 1.5h |
| API Route (CSV + XLSX) | 1.5h |
| Componente `ExportButton` | 1h |
| Integrar nos 2 painéis | 45 min |
| Testes | 45 min |
| **Total** | **~5.5h (1 dia)** |
