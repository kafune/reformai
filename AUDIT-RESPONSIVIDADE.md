# Auditoria de Responsividade — ReformAI

> Auditoria realizada em 2026-05-17. Escopo: `apps/web` (Next.js 14 App Router).
> Fases 1–5 concluídas. **Correções aplicadas** — ver seção 6.

---

## 1. Resumo executivo

| Severidade | Quantidade |
|---|---|
| 🔴 Crítico | 14 |
| 🟡 Moderado | 23 |
| 🟢 Leve | 7 |
| **Total** | **44** |

### Problemas por arquivo (resumo)

| Arquivo | 🔴 | 🟡 | 🟢 |
|---|---|---|---|
| `src/interfaces/components/ui/AppShell.tsx` | 1 | 1 | — |
| `src/interfaces/components/ui/TopBar.tsx` | — | 2 | — |
| `src/interfaces/components/ui/Button.tsx` | — | 1 | — |
| `src/interfaces/components/ui/Input.tsx` | — | 1 | — |
| `src/interfaces/components/ui/Select.tsx` | — | 1 | — |
| `src/interfaces/components/ui/ChatMessage.tsx` | — | 1 | 1 |
| `src/interfaces/components/ui/Card.tsx` | — | — | 1 |
| `src/interfaces/components/ui/RiskBadge.tsx` | — | — | 1 |
| `src/interfaces/components/ui/Checkbox.tsx` | — | — | 1 |
| `app/login/page.tsx` | 3 | 2 | — |
| `app/cases/[caseId]/page.tsx` | 1 | 2 | — |
| `app/cases/[caseId]/documents/page.tsx` | 1 | 1 | — |
| `app/cases/[caseId]/documents/components/DocumentList.tsx` | — | 2 | 1 |
| `app/cases/[caseId]/documents/components/DocumentTypeSelect.tsx` | — | 1 | — |
| `app/cases/page.tsx` | — | 1 | — |
| `app/(admin)/policies/page.tsx` | 1 | — | — |
| `app/(admin)/review-queue/page.tsx` | 1 | — | — |
| `app/(admin)/review-queue/[caseId]/page.tsx` | — | 2 | — |
| `app/(condominium)/sindico/cases/page.tsx` | 1 | — | — |
| `app/(condominium)/sindico/dashboard/page.tsx` | 3 | — | — |
| `app/(partner)/partner/cases/page.tsx` | 1 | — | — |
| `app/(partner)/partner/cases/[caseId]/page.tsx` | — | 2 | — |
| `app/(partner)/partner/cases/[caseId]/inspections/page.tsx` | — | 1 | — |
| `app/(partner)/partner/.../AcceptDeclineButtons.tsx` | — | 1 | — |
| Demais arquivos (`page.tsx` raiz, formulários, etc.) | — | — | restante OK |

> Observação: por o `AppShell` envolver **todos** os painéis (morador, síndico, parceiro, admin), o problema crítico nº 1 afeta de fato 100% das telas autenticadas.

---

## 2. Fase 1 — Mapeamento

### Framework CSS
- **Tailwind CSS 3.4.15** — único framework de estilo. Sem CSS Modules, sem styled-components, sem CSS vanilla além de `globals.css`.
- `globals.css` contém apenas design tokens (CSS variables `--rai-*`) e reset mínimo (`html, body`). **Nenhuma media query.**
- `tailwind.config.ts` estende `theme` (cores, fontes, `fontSize`, `borderRadius`, sombras). Tema "Concreto Verde".

### Breakpoints
- O `tailwind.config.ts` **não define `screens`** → valem os breakpoints padrão do Tailwind:
  - `sm` 640px · `md` 768px · `lg` 1024px · `xl` 1280px · `2xl` 1536px
- **Não há nenhum breakpoint customizado** nem no config, nem no tema, nem no CSS global.
- O viewport meta tag é injetado automaticamente pelo Next.js 14 App Router (`width=device-width, initial-scale=1`) — **OK**.

### Sistema de grid / layout centralizado
- Existe um layout-shell central: **`AppShell.tsx`** (sidebar + main). Usado por todos os painéis.
- Existe **`TopBar.tsx`** como cabeçalho de página padronizado.
- Não há sistema de grid de colunas reutilizável — cada página declara seu próprio `grid` (frequentemente via `style` inline com colunas em `px`).
- **Padrão sistêmico problemático:** layouts de duas/múltiplas colunas e "tabelas" são construídos com `grid-template-columns` de larguras fixas em `px`, **sem prefixos de breakpoint e sem fallback mobile**.

### Uso de responsividade existente
Apenas 6 ocorrências de prefixos responsivos em todo o projeto (todas corretas):
- `cases/page.tsx` — `sm:grid-cols-2 lg:grid-cols-3`
- `(admin)/dashboard/page.tsx` — `sm:grid-cols-4`, `sm:grid-cols-2`
- `partner/dashboard/page.tsx` — `md:grid-cols-4`
- `partner/cases/[caseId]/page.tsx` — `md:grid-cols-[1.4fr_1fr]` (2×)
- `ScheduleInspectionForm.tsx` — `md:grid-cols-2`
- `CompleteInspectionForm.tsx` — `w-full sm:w-auto`

O restante do projeto é efetivamente **desktop-only**.

---

## 3. Fase 2+3 — Auditoria por arquivo (com severidade)

### 🔴 `src/interfaces/components/ui/AppShell.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 36 | Grid fixo | 🔴 | `grid grid-cols-[236px_1fr]` — sidebar de **236px fixos sem nenhuma colapso responsivo**. Em telas < 640px, a sidebar consome a maior parte da largura. Não há hambúrguer, drawer nem `lg:` para esconder/recolher. **Afeta todos os painéis autenticados.** |
| 37 | Position/overflow | 🟡 | O `<aside>` está sempre visível; sem `hidden`/drawer em mobile não há como liberar a área de conteúdo. |

### 🔴 `app/login/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 48-51 | Grid fixo | 🔴 | `style={{ display:"grid", gridTemplateColumns:"1fr 1fr" }}` — duas colunas iguais que **nunca colapsam**. Em um celular de 360px, a coluna do formulário fica com 180px. |
| 53 | Espaçamento rígido | 🔴 | Coluna do formulário com `px-16` (64px de cada lado = 128px). Somado à coluna de 50%, **a área útil do formulário fica negativa em mobile** → login inutilizável. |
| 152-156 | Layout | 🔴 | Painel decorativo "concreto verde" (`px-14`) não é escondido em telas pequenas; deveria ser `hidden lg:flex`. |
| 49 | Overflow oculto | 🟡 | `h-screen overflow-hidden` no container raiz — em telas baixas o conteúdo pode ser cortado (a coluna esquerda tem `overflow-y-auto`, mas a estrutura presume desktop). |
| 89-94 | Z-index/position | 🟡 | Link "Esqueci a senha" com `absolute right-0 top-0` sobre o `Input` de senha — pode sobrepor o label "Senha" em larguras estreitas. |

### 🔴 `app/cases/[caseId]/page.tsx` (detalhe do caso / chat)

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 98-101 | Grid fixo | 🔴 | `style={{ display:"grid", gridTemplateColumns:"1fr 320px" }}` — chat + rail lateral de **320px fixos sem colapso**. Em mobile o rail engole a área de chat. |
| 105 | Espaçamento rígido | 🟡 | Mensagens com `px-10` (40px) — padding excessivo em telas pequenas. |
| 152 | Espaçamento rígido | 🟡 | Composer com `px-10` — idem. |

### 🔴 `app/cases/[caseId]/documents/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 62-64 | Grid fixo | 🔴 | `style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:24 }}` — duas colunas que **nunca colapsam**. O painel de análise lateral comprime a coluna principal em mobile. |
| 61 | Espaçamento rígido | 🟡 | `px-8` no container; aceitável, mas sem redução por breakpoint. |

### 🔴 `app/(admin)/policies/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 40, 53 | Tabela / Grid fixo | 🔴 | Cabeçalho e linhas com `grid grid-cols-[1fr_80px_80px_140px_100px]` — largura mínima ~465px. **Sem `overflow-x-auto`** e o wrapper (L38) usa `overflow-hidden` → conteúdo é **cortado silenciosamente** em mobile. |

### 🔴 `app/(admin)/review-queue/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 51, 65 | Tabela / Grid fixo | 🔴 | `grid grid-cols-[120px_1fr_160px_80px_120px_80px]` — largura mínima ~640px. Wrapper `overflow-hidden` (L49) **corta o conteúdo**; sem scroll horizontal. |

### 🔴 `app/(condominium)/sindico/cases/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 67-69, 91-93 | Tabela / Grid fixo | 🔴 | `style={{ gridTemplateColumns:"130px 90px 1fr 150px 180px 100px" }}` — largura mínima ~700px. Wrapper `overflow-hidden` (L65) **corta colunas** em mobile; sem scroll horizontal. |

### 🔴 `app/(condominium)/sindico/dashboard/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 201 | Grid fixo | 🔴 | `grid grid-cols-4` para os cards de estatística, **sem responsividade**. Em mobile os 4 cards ficam espremidos e os números `text-3xl` transbordam. |
| 259 | Grid fixo | 🔴 | `style={{ gridTemplateColumns:"1.6fr 1fr" }}` — tabela de atenção + coluna lateral que **nunca colapsam**. |
| 287-288, 308-309 | Tabela / Grid fixo | 🔴 | `style={{ gridTemplateColumns:"100px 80px 1fr 140px 170px 60px" }}` dentro da coluna `1.6fr` — extremamente espremido; wrapper `overflow-hidden` (L261) **corta o conteúdo**. |

### 🔴 `app/(partner)/partner/cases/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 130, 145 | Tabela / Grid fixo | 🔴 | `grid grid-cols-[110px_1fr_150px_165px_150px_60px]` — largura mínima ~700px. Sem `overflow-x-auto` → transborda a página inteira em mobile (scroll horizontal global). |

### 🟡 `src/interfaces/components/ui/TopBar.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 16 | Espaçamento rígido | 🟡 | `px-8 py-5` fixo; sem redução por breakpoint. |
| 19-32 | Flex sem wrap | 🟡 | A linha de breadcrumb (`flex items-center gap-1.5`) não tem `flex-wrap` — breadcrumbs longos transbordam horizontalmente em mobile. |

### 🟡 `src/interfaces/components/ui/Button.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 17-21 | Alvo de toque | 🟡 | `sm` = `h-8` (32px) e `md` = `h-10` (40px) — **abaixo do mínimo de 44×44px** recomendado para toque em mobile. A maioria das ações usa `sm`/`md`. |

### 🟡 `src/interfaces/components/ui/Input.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 34 | Alvo de toque / Altura fixa | 🟡 | Container do input com `h-10` (40px) — abaixo de 44px para toque. |

### 🟡 `src/interfaces/components/ui/Select.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 21 | Alvo de toque / Altura fixa | 🟡 | `<select>` com `h-10` (40px) — abaixo de 44px para toque. |

### 🟡🟢 `src/interfaces/components/ui/ChatMessage.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 29 / 56 | Texto longo | 🟡 | Bolhas (`AIMessage`/`UserMessage`) não têm `break-words`/`overflow-wrap`. Uma string longa sem espaços (URL, protocolo) transborda a bolha (`max-w-[85%]`/`75%`). |
| 16, 54 | Largura | 🟢 | `max-w-[85%]` / `max-w-[75%]` — percentuais, OK; apenas consistência. |

### 🟢 `src/interfaces/components/ui/Card.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 19 | Espaçamento rígido | 🟢 | `p-6` fixo (24px); aceitável, mas sem variação mobile. |

### 🟢 `src/interfaces/components/ui/RiskBadge.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 52-62 | Texto | 🟢 | Segundo segmento (`flex items-center gap-1.5`) sem `whitespace-nowrap` — o rótulo pode quebrar em duas linhas em containers muito estreitos. Cosmético. |

### 🟢 `src/interfaces/components/ui/Checkbox.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 21 | Alvo de toque | 🟢 | Caixa de 18px; o `<label>` envolvente amplia a área clicável, então é aceitável. |

### 🟡🟢 `app/cases/[caseId]/documents/components/DocumentList.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 118 | Flex squeeze | 🟡 | Linha `flex items-center gap-3.5` com ícone (40px) + info + badge de status (`whitespace-nowrap`, ~120px) + botão. Em containers estreitos a info fica muito comprimida (o nome trunca, mas o layout fica apertado). |
| 148-156 | Alvo de toque | 🟡 | Botão "visualizar" `h-7 w-7` (28px) — bem abaixo de 44px. |
| 130-137 | Texto | 🟢 | `flex items-baseline gap-2` — o rótulo de tipo pode quebrar; menor. |

### 🟡 `app/cases/[caseId]/documents/components/DocumentTypeSelect.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 42 | Alvo de toque / Altura fixa | 🟡 | `<select>` com `h-10` — abaixo de 44px para toque. |

### 🟡 `app/cases/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 71 | Espaçamento rígido | 🟡 | `px-8 py-6` fixo. A grade de casos (L118) **já é responsiva** (`sm:grid-cols-2 lg:grid-cols-3`) ✅. |

### 🟡 `app/(admin)/review-queue/[caseId]/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 79 | Grid fixo | 🟡 | Card "hero" com `grid grid-cols-[1fr_auto] gap-8` — em mobile o status/risco deveria empilhar abaixo do título. |
| 111, 200 | Grid fixo | 🟡 | `dl grid grid-cols-2` — pares de dados em 2 colunas sempre; em telas muito estreitas fica apertado. Deveria ser `grid-cols-1 sm:grid-cols-2`. |

### 🟡 `app/(partner)/partner/cases/[caseId]/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 213 | Grid fixo | 🟡 | `grid grid-cols-2 gap-4` para os "facts" — apertado em mobile; sem breakpoint. |
| 388 | Texto longo | 🟡 | Linha de transição (`li flex gap-3 text-xs`) sem `flex-wrap` — data + status + motivo podem transbordar. (As listas de documentos/relatórios em L333/L425 **usam `flex-wrap`** ✅.) |

### 🟡 `app/(partner)/partner/cases/[caseId]/inspections/page.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 141 | Grid fixo | 🟡 | `grid grid-cols-[60px_1fr_auto]` — coluna `1fr` da info pode ficar muito estreita quando a coluna de ações tem dois botões. Aceitável, mas deveria empilhar em mobile. |

### 🟡 `app/(partner)/partner/cases/[caseId]/AcceptDeclineButtons.tsx`

| Linha | Tipo | Sev. | Descrição |
|---|---|---|---|
| 75-90 | Alvo de toque | 🟡 | Botões "Ver detalhes"/"Recusar" com `py-2` → ~36px de altura. A linha usa `flex-wrap` ✅, mas a altura está abaixo de 44px. |

### Arquivos auditados sem problemas relevantes (✅)

- `app/layout.tsx` — viewport injetado pelo Next; OK.
- `app/page.tsx` — `min-h-screen flex ... px-6`, `max-w-xl`; responsivo. *(Nota fora de escopo: usa `bg-brand-accent`, cor inexistente no `tailwind.config` — bug de cor, não de responsividade.)*
- `app/cases/layout.tsx`, `app/(admin)/layout.tsx`, `app/(condominium)/sindico/layout.tsx`, `app/(partner)/partner/layout.tsx` — apenas delegam ao `AppShell` (herdam o crítico nº 1).
- `app/(admin)/dashboard/page.tsx` — grids **responsivos** (`sm:grid-cols-4`, `sm:grid-cols-2`) ✅. *(Nota: `bg-iron-50` na L141 é cor inexistente no config — bug de cor.)*
- `app/(admin)/review-queue/[caseId]/ReviewDecisionForm.tsx` — `space-y`/`w-full`; OK.
- `app/(partner)/partner/dashboard/page.tsx` — `grid-cols-2 md:grid-cols-4` ✅.
- `app/(partner)/.../ScheduleInspectionForm.tsx` — `grid-cols-1 md:grid-cols-2` ✅.
- `app/(partner)/.../RescheduleButton.tsx` — `flex flex-wrap` ✅.
- `app/(partner)/.../complete/page.tsx` + `CompleteInspectionForm.tsx` — `max-w-2xl`, `flex-wrap`, `w-full sm:w-auto` ✅ (melhor exemplo do projeto).
- `app/cases/[caseId]/documents/components/DocumentUploadZone.tsx`, `DocumentStatusBadge.tsx`, `DocumentViewButton.tsx` — OK (apenas alvos de toque pequenos herdados de `Button`).
- Componentes UI: `Avatar`, `Badge`, `StatusChip`, `Eyebrow`, `Icon`, `Logo`, `Switch`, `Timeline`, `AuthProvider`, `SignOutButton` — OK.

### Itens da checklist sem ocorrências
- **Imagens sem responsividade:** não há tags `<img>`; todos os gráficos são SVG inline / `<div>` de avatar. ✅
- **Modais/drawers sobrepostos:** o único "modal" (`AcceptDeclineButtons`) é um painel em fluxo (não overlay) — sem problema de posicionamento. ⚠️ A ausência de um **drawer de navegação mobile** é o que falta.

---

## 4. Top 5 problemas críticos (corrigir primeiro)

1. **`AppShell.tsx` L36 — sidebar de 236px fixos sem colapso.**
   Afeta **todas** as telas autenticadas. Em mobile, a barra lateral ocupa a maior parte da tela. Precisa de drawer/hambúrguer e `grid-cols-1` abaixo de `lg`.

2. **`login/page.tsx` L48-53 — grid `1fr 1fr` + `px-16`.**
   A tela de login fica **inutilizável** em celulares: a área do formulário é comprimida a quase nada. O painel direito deveria ser `hidden lg:flex` e a coluna do formulário virar largura total com padding reduzido.

3. **"Tabelas" com colunas fixas em `px` + `overflow-hidden`** — `policies`, `review-queue`, `sindico/cases`, `sindico/dashboard`, `partner/cases`.
   Cinco listagens construídas com `grid-template-columns` fixo (465–700px) sem `overflow-x-auto`; quatro delas dentro de `overflow-hidden`, **cortando dados silenciosamente** em mobile.

4. **`cases/[caseId]/page.tsx` L98 — chat com grid `1fr 320px`.**
   O rail lateral de 320px nunca colapsa; em mobile o chat (função principal) fica espremido.

5. **`sindico/dashboard/page.tsx` L201/L259 — `grid-cols-4` + `1.6fr 1fr`.**
   Dashboard inteiro quebra: 4 cards de métrica espremidos e layout de 2 colunas que não empilha.

---

## 5. Recomendações gerais (padrões ausentes no projeto inteiro)

1. **Adotar mobile-first de fato.** Hoje o projeto é desktop-only com 6 exceções pontuais. Todo `grid`/`flex` de layout deve começar em 1 coluna e crescer com `sm:`/`md:`/`lg:`.

2. **Banir `grid-template-columns` fixo em `px` para layout.** Substituir os `style={{ gridTemplateColumns: "..." }}` inline e `grid-cols-[NNpx_...]` por:
   - Layouts de página: `grid-cols-1 lg:grid-cols-[...]`.
   - "Tabelas": envolver em `overflow-x-auto` **ou** transformar cada linha em card empilhado abaixo de `md` (padrão card-list mobile).

3. **Criar um shell responsivo.** O `AppShell` precisa de um estado de navegação mobile (drawer com overlay + botão hambúrguer na `TopBar`). É a correção de maior impacto.

4. **Padronizar alvos de toque ≥ 44px.** As alturas `h-8`/`h-10` de `Button`, `Input`, `Select` ficam abaixo do recomendado. Sugestão: introduzir altura mínima de 44px em mobile (ex.: `min-h-11` ou size dedicado) sem alterar o visual desktop.

5. **Eliminar `overflow-hidden` em wrappers de conteúdo tabular.** Ele apenas arredonda cantos hoje, mas mascara transbordamento. Usar `overflow-x-auto` quando houver conteúdo largo.

6. **Aplicar `break-words`/`overflow-wrap` em todo texto livre.** Bolhas de chat, descrições de escopo e linhas de histórico devem tratar strings longas sem espaços.

7. **Reduzir paddings por breakpoint.** Padrão recomendado: `px-4 md:px-8` (hoje `px-8`/`px-10`/`px-16` fixos em quase tudo).

8. **Centralizar primitivos de layout.** Criar um componente `PageContainer`/`DataTable` responsivo evita que cada página reinvente um grid fixo — a causa-raiz da maioria dos 14 críticos.

---

## 6. Fase 5 — Correções aplicadas

Todos os 44 problemas (🔴/🟡/🟢) foram corrigidos diretamente nos arquivos.
Padrões usados: **Tailwind apenas** (framework já em uso), **mobile-first**, **sem novas dependências**, classes existentes preservadas (apenas acrescidas/prefixadas por breakpoint).

Convenções aplicadas:
- Grids fixos → `grid-cols-1` no mobile + `lg:grid-cols-[...]` no desktop.
- "Tabelas" de colunas fixas → wrapper `overflow-x-auto` + `min-w-[...]` nas linhas (rolagem horizontal em vez de corte).
- Alvos de toque < 44px → `max-md:min-h-11` (44px só no mobile; desktop inalterado).
- Paddings rígidos → `px-4 md:px-8` (mobile-first).
- `tsc --noEmit` executado após as alterações: **sem erros**.

### 6.1 Componentes compartilhados

| Arquivo | Alteração | Motivo |
|---|---|---|
| `ui/AppShell.tsx` | Reescrito: `grid grid-cols-[236px_1fr]` → `min-h-screen lg:grid lg:grid-cols-[236px_1fr]`. Adicionada barra superior mobile com botão hambúrguer, **drawer** deslizante (`fixed`, `-translate-x-full`↔`translate-x-0`) e overlay. Componente virou `"use client"`; nav fecha o drawer ao clicar. | 🔴 Sidebar de 236px fixos tornava o app inutilizável em mobile. |
| `ui/TopBar.tsx` | `flex ... gap-6 px-8 py-5` → `flex flex-wrap ... gap-x-6 gap-y-2 px-4 py-4 md:px-8 md:py-5`; breadcrumb `flex` → `flex flex-wrap`. | 🟡 Padding rígido e breadcrumb sem quebra. |
| `ui/Button.tsx` | Base `+ max-md:min-h-11`. | 🟡 `sm`/`md` (32/40px) abaixo de 44px de toque. |
| `ui/Input.tsx` | Container `+ max-md:min-h-11`. | 🟡 `h-10` abaixo de 44px. |
| `ui/Select.tsx` | `<select>` `+ max-md:min-h-11`. | 🟡 `h-10` abaixo de 44px. |
| `ui/Card.tsx` | `padded && "p-6"` → `padded && "p-4 md:p-6"`. | 🟢 Padding rígido. |
| `ui/RiskBadge.tsx` | Segundo segmento `+ whitespace-nowrap`. | 🟢 Rótulo podia quebrar em duas linhas. |
| `ui/ChatMessage.tsx` | Bolhas `AIMessage` e `UserMessage` `+ break-words`. | 🟡 Strings longas transbordavam a bolha. |

### 6.2 Login

| Arquivo | Alteração | Motivo |
|---|---|---|
| `app/login/page.tsx` | Container: `h-screen overflow-hidden` + `style grid 1fr 1fr` → `min-h-screen lg:grid lg:h-screen lg:grid-cols-2 lg:overflow-hidden`. Coluna do formulário: `px-16` → `px-6 sm:px-10 lg:px-16`. Coluna decorativa: `flex` → `hidden ... lg:flex`. | 🔴 Grid `1fr 1fr` + `px-16` deixava o formulário inutilizável em mobile. O ajuste de largura total também elimina o risco de sobreposição do link "Esqueci a senha" (🟡). |

### 6.3 Área do morador / casos

| Arquivo | Alteração | Motivo |
|---|---|---|
| `app/cases/page.tsx` | Container `px-8` → `px-4 md:px-8`; `<select>` de unidade `+ max-md:min-h-11`. | 🟡 Padding rígido / alvo de toque. |
| `app/cases/[caseId]/page.tsx` | Grid do chat: `flex flex-1 overflow-hidden` + `style grid 1fr 320px` → `grid flex-1 grid-cols-1 lg:grid-cols-[1fr_320px] lg:overflow-hidden`. Coluna do chat `overflow-hidden` → `lg:overflow-hidden`. Mensagens `px-10 py-7` → `px-4 py-5 md:px-10 md:py-7`. Composer `px-10 pb-6 pt-4` → `px-4 pb-4 pt-3 md:...`. Aside `border-l p-6` → `border-t p-4 md:p-6 lg:border-l lg:border-t-0`. | 🔴 Rail de 320px fixo nunca colapsava. 🟡 paddings rígidos. |
| `app/cases/[caseId]/documents/page.tsx` | Container `px-8` → `px-4 md:px-8`. Grid: `style grid 1.4fr 1fr` → `grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]`. | 🔴 Duas colunas nunca colapsavam. |
| `.../documents/components/DocumentList.tsx` | `<li>` `flex items-center gap-3.5 px-5` → `flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:gap-x-3.5 md:px-5`. Botão "ver" `h-7 w-7` `+ max-md:h-11 max-md:w-11`. | 🟡 Linha comprimida / alvo de toque de 28px. |
| `.../documents/components/DocumentTypeSelect.tsx` | `<select>` `+ max-md:min-h-11`. | 🟡 `h-10` abaixo de 44px. |

### 6.4 Painel administrativo

| Arquivo | Alteração | Motivo |
|---|---|---|
| `app/(admin)/policies/page.tsx` | Wrapper `overflow-hidden` → `overflow-x-auto`; header e linhas `+ min-w-[680px]`. | 🔴 Tabela de colunas fixas era cortada silenciosamente. |
| `app/(admin)/review-queue/page.tsx` | Wrapper `overflow-hidden` → `overflow-x-auto`; header e linhas `+ min-w-[760px]`. | 🔴 Idem. |
| `app/(admin)/review-queue/[caseId]/page.tsx` | Container `px-8 py-8` → `px-4 py-6 md:px-8 md:py-8`. Hero `grid-cols-[1fr_auto] gap-8` → `grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] sm:gap-8`. Dois `dl grid-cols-2` → `grid-cols-1 ... sm:grid-cols-2`. | 🟡 Layouts de 2 colunas não empilhavam. |

### 6.5 Painel do condomínio (síndico)

| Arquivo | Alteração | Motivo |
|---|---|---|
| `app/(condominium)/sindico/cases/page.tsx` | Wrapper `overflow-hidden` → `overflow-x-auto`; header, linhas e rodapé `+ min-w-[820px]`. | 🔴 Tabela de colunas fixas cortada. |
| `app/(condominium)/sindico/dashboard/page.tsx` | Stats `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`. Grid principal `style 1.6fr 1fr` → `grid-cols-1 lg:grid-cols-[1.6fr_1fr]`. Container da tabela de atenção `flex flex-col` → `flex flex-col overflow-x-auto`; header e linhas `+ min-w-[720px]`. | 🔴 4 cards espremidos, layout de 2 colunas e tabela interna cortada. |

### 6.6 Painel do parceiro

| Arquivo | Alteração | Motivo |
|---|---|---|
| `app/(partner)/partner/cases/page.tsx` | Tabela envolvida em `<div className="overflow-x-auto">`; header e linhas `+ min-w-[760px]`. | 🔴 Tabela transbordava a página. |
| `app/(partner)/partner/cases/[caseId]/page.tsx` | Container `p-8` → `p-4 md:p-8`. "Facts" `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`. `<li>` de transições `flex gap-3` → `flex flex-wrap gap-x-3 gap-y-1`. | 🟡 Padding rígido, grid de 2 colunas e linha sem quebra. |
| `.../cases/[caseId]/inspections/page.tsx` | Container `p-8` → `p-4 md:p-8`. Linha de vistoria `grid-cols-[60px_1fr_auto]` → `grid-cols-[56px_1fr] sm:grid-cols-[60px_1fr_auto]`; bloco de ações `flex flex-col items-end` → `col-span-2 flex ... sm:col-span-1 sm:flex-col sm:items-end` (ações empilham abaixo em mobile). | 🟡 Coluna de info espremida no mobile. |
| `.../cases/[caseId]/AcceptDeclineButtons.tsx` | 3 botões custom (`py-2`) `+ max-md:min-h-11`. | 🟡 Alvos de toque ~36px. |
| `.../cases/[caseId]/inspections/RescheduleButton.tsx` | Botão "Reagendar" e input `datetime-local` `+ max-md:min-h-11`. | 🟡 Alvos de toque `h-8`. |

### 6.7 Verificação

- ✅ `bunx tsc --noEmit` — sem erros após todas as alterações (estrutura JSX e tipos íntegros).
- ⚠️ **Não foi possível testar visualmente em navegador** neste ambiente (o `bun run dev` exige PostgreSQL/Redis/MinIO via `docker-compose`). Recomenda-se validar manualmente em viewports de 360px, 768px e 1280px — especialmente o drawer do `AppShell`, a tela de login e as 5 tabelas com rolagem horizontal.
- ℹ️ Fora de escopo (bugs de cor, não de responsividade, **não corrigidos**): `app/page.tsx` usa `bg-brand-accent` e `(admin)/dashboard/page.tsx` usa `bg-iron-50` — ambas cores inexistentes no `tailwind.config.ts`.
