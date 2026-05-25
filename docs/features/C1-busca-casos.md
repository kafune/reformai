# C1 — Busca Full-Text de Casos

**Grupo:** C — Features novas  
**Prioridade:** 🔴 Alto impacto, baixo esforço  
**Estimativa:** 1 dia  

---

## 1. Contexto

Admin e síndico hoje navegam por uma lista de casos sem nenhuma busca. Com dezenas
ou centenas de casos, encontrar o caso de um morador específico requer scroll ou
filtros de status. Uma caixa de busca rápida resolve isso com esforço mínimo.

---

## 2. User Stories

- **Como administrador**, quero digitar o nome do morador, o número do protocolo
  ou o número da unidade e encontrar o caso imediatamente.

- **Como síndico**, quero buscar reformas do "Apto 203" sem precisar rolar a lista.

- **Como parceiro**, quero encontrar rapidamente o caso que preciso atualizar pelo
  protocolo.

---

## 3. Design Técnico

### 3.1 Estratégia de busca

**PostgreSQL `ILIKE` (MVP)** — simples, sem nova infraestrutura:

```sql
SELECT * FROM "ReformCase"
WHERE "tenantId" = $1
  AND (
    protocol ILIKE '%query%'
    OR EXISTS (
      SELECT 1 FROM "Unit" u
      WHERE u.id = "ReformCase"."unitId"
        AND (u.identifier ILIKE '%query%' OR u."ownerName" ILIKE '%query%')
    )
    OR EXISTS (
      SELECT 1 FROM "User" c
      WHERE c.id = "ReformCase"."clientId"
        AND (c.name ILIKE '%query%' OR c.email ILIKE '%query%')
    )
  )
ORDER BY "createdAt" DESC
LIMIT 20
```

**Evolução futura:** Adicionar índice `tsvector` GIN no PostgreSQL ou migrar para
`pg_search` se volume crescer.

### 3.2 API Route

```
GET /api/v1/cases?search=query&status=DRAFT&page=1&limit=20
```

Parâmetro `search` é opcional. Sem ele, comportamento atual. Com ele, aplica filtro
`ILIKE` nas 4 colunas acima.

Refatorar a rota `GET /api/v1/cases` existente para suportar `search`.

### 3.3 Componente `SearchInput`

```tsx
// interfaces/components/ui/SearchInput.tsx
// Input controlado com debounce de 300ms
// Ícone de lupa + botão de limpar
// Placeholder: "Buscar por protocolo, nome, unidade..."
```

### 3.4 Integração nas listagens

| Página | Local |
|--------|-------|
| `/admin/review-queue` | Topo da listagem |
| `/(condominium)/sindico/cases` | Topo da listagem |
| `/(partner)/partner/cases` | Topo da listagem |
| `/(admin)/cases` (se existir) | Topo da listagem |

### 3.5 Escopo CLIENT

Para moradores, a busca só retorna os próprios casos (já filtrado por `clientId`).
Não expõe casos de outros moradores.

### 3.6 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `app/api/v1/cases/route.ts` | Adicionar parâmetro `search` + query ILIKE |
| `interfaces/components/ui/SearchInput.tsx` | Criar componente |
| `app/(admin)/review-queue/page.tsx` | Integrar `SearchInput` |
| `app/(condominium)/sindico/cases/page.tsx` | Integrar `SearchInput` |
| `app/(partner)/partner/cases/page.tsx` | Integrar `SearchInput` |

---

## 4. Critérios de Aceite

- [ ] Busca por protocolo exato retorna o caso correto
- [ ] Busca parcial por nome do morador retorna resultados esperados
- [ ] Busca por número da unidade retorna resultados esperados
- [ ] Busca por e-mail do morador retorna resultados esperados
- [ ] Busca é case-insensitive
- [ ] Resultados são tenant-scoped (não vaza dados de outros tenants)
- [ ] CLIENT só vê seus próprios casos na busca
- [ ] Input tem debounce de 300ms (não dispara request a cada tecla)
- [ ] "Sem resultados" exibe mensagem amigável

---

## 5. Dependências

Nenhuma — apenas refatoração da rota existente.

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Refatorar query em `GET /api/v1/cases` | 1h |
| Componente `SearchInput` (debounce) | 1h |
| Integrar nos 3 painéis | 1.5h |
| Testes E2E básicos | 1h |
| **Total** | **~4.5h (1 dia)** |
