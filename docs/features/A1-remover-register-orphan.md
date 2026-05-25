# A1 — Remover Pages `/register/*` Órfãs

**Grupo:** A — Backlog técnico  
**Severidade:** Média  
**Estimativa:** 2h  

---

## 1. Contexto

O commit `0fab07a` desativou o autocadastro público de morador, removendo a rota
`POST /api/v1/auth/register`. O fluxo foi substituído por convite gerenciado pelo
síndico via QR code em `/sindico/cadastro`.

Porém as pages de frontend ainda existem:
- `apps/web/app/register/page.tsx`
- `apps/web/app/register/[condominiumId]/page.tsx`

Se um usuário acessar diretamente essas URLs (via link salvo, QR antigo, etc.) o
formulário aparece mas o submit retorna 404 ou erro opaco — experiência quebrada
sem feedback claro.

---

## 2. User Stories

- **Como usuário com link antigo de cadastro**, quero ser redirecionado para uma
  página que explique que o acesso é por convite do síndico, para não ficar travado
  em uma tela de erro.

- **Como desenvolvedor**, quero remover código morto para não confundir a manutenção
  futura.

---

## 3. Design Técnico

### Opção A — Redirect permanente (recomendada)

Substituir o conteúdo das pages por um redirect para `/login` com um `searchParam`
de mensagem:

```typescript
// apps/web/app/register/page.tsx
import { redirect } from 'next/navigation'

export default function RegisterPage() {
  redirect('/login?info=cadastro-por-convito')
}
```

Na tela de login, exibir um `InfoBanner` quando `?info=cadastro-por-convito` estiver
presente:

> "O cadastro de moradores é feito por convite do síndico. Entre em contato com
> a administração do seu condomínio."

### Opção B — Deletar os arquivos

Remove `apps/web/app/register/` inteiramente. Risco: Next.js retorna 404 genérico
sem contexto para o usuário.

### Decisão

Usar **Opção A** — melhor UX, custo trivial.

### Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `apps/web/app/register/page.tsx` | Substituir por redirect |
| `apps/web/app/register/[condominiumId]/page.tsx` | Substituir por redirect |
| `apps/web/app/login/page.tsx` | Adicionar leitura de `searchParam` + `InfoBanner` |

---

## 4. Critérios de Aceite

- [ ] `GET /register` redireciona para `/login?info=cadastro-por-convito`
- [ ] `GET /register/qualquer-id` redireciona para `/login?info=cadastro-por-convito`
- [ ] Tela de login exibe banner informativo quando `?info=cadastro-por-convito`
- [ ] Sem console errors ou 404s nas rotas de registro
- [ ] Teste E2E cobre o redirect

---

## 5. Dependências

Nenhuma — isolado.

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Editar as duas pages de register | 15 min |
| Adicionar InfoBanner no login | 30 min |
| Teste E2E | 30 min |
| **Total** | **~1.5h** |
