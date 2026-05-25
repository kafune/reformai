# C5 — Histórico de Obras por Unidade

**Grupo:** C — Features novas  
**Prioridade:** 🟡 Alto impacto, esforço médio  
**Estimativa:** 1 dia  

---

## 1. Contexto

O banco já tem `Unit → ReformCase[]` — cada unidade tem um histórico completo de
reformas. Mas não existe nenhuma página ou visão que exponha isso. 

Esse histórico é crítico para:
- **Síndico:** saber se o apartamento já teve reforma estrutural antes
- **Parceiro:** entender o histórico de manutenções ao fazer a vistoria inicial
- **Admin:** due diligence de obras recorrentes ou problemáticas
- **Compliance:** evidência de que obras foram realizadas com responsável técnico

---

## 2. User Stories

- **Como síndico**, quero ver todas as reformas já realizadas no Apartamento 203
  com data, escopo, responsável técnico e status de conclusão, para ter contexto
  histórico antes de aprovar uma nova obra.

- **Como parceiro**, ao aceitar um caso, quero ver o histórico da unidade para
  saber se há obras estruturais anteriores que podem afetar meu trabalho.

- **Como administrador**, quero filtrar unidades com mais de 2 obras nos últimos 2
  anos para identificar possíveis problemas recorrentes.

---

## 3. Design Técnico

### 3.1 Nova página — `/sindico/units/[unitId]`

```
┌─────────────────────────────────────────────────┐
│  ← Voltar    Unidade: Apto 203 — Bloco B        │
│                                                  │
│  Proprietário: João Silva                        │
│  Andar: 2º  |  Bloco: B                         │
│                                                  │
│  ─── Histórico de Obras ──────────────────────  │
│                                                  │
│  RF-2026-042  ●  Em andamento                   │
│  Aberto: 15/05/2026                             │
│  Serviços: Elétrica, Hidráulica                 │
│  Risco: HIGH  |  ART: Sim                       │
│  Parceiro: Eng. Carlos Matos                    │
│                                                  │
│  RF-2025-018  ✓  Concluído                      │
│  Aberto: 10/03/2025  |  Concluído: 28/04/2025  │
│  Serviços: Pintura, Troca de piso              │
│  Risco: LOW                                     │
│                                                  │
│  RF-2024-005  ✓  Concluído                      │
│  ...                                             │
└─────────────────────────────────────────────────┘
```

### 3.2 Nova página — `/admin/condominiums/[condominiumId]/units`

Lista de todas as unidades do condomínio com:
- Número de obras total / concluídas / em andamento
- Data da última obra
- Link para o histórico da unidade

### 3.3 API Route

```
GET /api/v1/admin/condominiums/:condominiumId/units/:unitId/history
  Auth: ADMIN | SUPER_ADMIN | MANAGER | CONDOMINIUM (síndico do condomínio)
  Response: {
    unit: UnitDetail,
    cases: CaseSummary[]  // ordenados por createdAt DESC
  }
```

`CaseSummary` inclui: `id`, `protocol`, `status`, `riskLevel`, `requiresART`,
`reformScope.services`, `partnerName`, `createdAt`, `updatedAt`.

### 3.4 Acesso do parceiro ao histórico

Quando um parceiro aceita um caso, exibir na página do caso uma seção colapsada
"Histórico da unidade" com as obras anteriores (sem dados sensíveis de outros
moradores — apenas escopo técnico).

### 3.5 Timeline visual

Componente `UnitHistoryTimeline` — lista vertical com cards por obra, ordenada
por data decrescente:

```tsx
// Cada card:
<div className="border-l-2 pl-4">
  <Badge status={reformCase.status} />
  <h3>{reformCase.protocol}</h3>
  <p>Serviços: {reformCase.reformScope.services.join(', ')}</p>
  <p>Risco: <RiskBadge level={reformCase.riskLevel} /></p>
  <p>Data: {formatDate(reformCase.createdAt)}</p>
</div>
```

### 3.6 Link a partir da listagem de unidades

Em `/admin/condominiums/[id]` (página de detalhe do condomínio), cada unidade
na lista tem um botão "Ver histórico".

### 3.7 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `app/(condominium)/sindico/units/[unitId]/page.tsx` | Criar |
| `app/(admin)/condominiums/[condominiumId]/units/[unitId]/page.tsx` | Criar |
| `app/api/v1/admin/condominiums/[condominiumId]/units/[unitId]/history/route.ts` | Criar |
| `interfaces/components/ui/UnitHistoryTimeline.tsx` | Criar |
| `app/(admin)/condominiums/[id]/page.tsx` | Adicionar link "Ver histórico" |
| `app/(partner)/partner/cases/[caseId]/page.tsx` | Adicionar seção colapsada de histórico |

---

## 4. Critérios de Aceite

- [ ] Síndico acessa histórico de qualquer unidade do seu condomínio
- [ ] Admin acessa histórico de qualquer unidade
- [ ] Síndico de outro condomínio recebe 403
- [ ] Histórico mostra todas as obras (concluídas + em andamento)
- [ ] Cada obra exibe: protocolo, data, serviços, risco, parceiro, status
- [ ] Parceiro vê resumo técnico (sem dados pessoais de outros moradores) na página do caso
- [ ] Dados tenant-scoped (não vaza obras de outros tenants)

---

## 5. Dependências

Dados já estão no banco — nenhuma migration necessária.

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| API Route | 1h |
| Componente `UnitHistoryTimeline` | 1.5h |
| Páginas síndico + admin | 2h |
| Integração na página do parceiro | 1h |
| **Total** | **~5.5h (1 dia)** |
