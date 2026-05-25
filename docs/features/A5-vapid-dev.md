# A5 — VAPID Keys no `docker-compose.yml`

**Grupo:** A — Backlog técnico  
**Severidade:** Informativa  
**Estimativa:** 1h  

---

## 1. Contexto

O sistema tem Web Push implementado (`WebPushProvider`, `PushSubscription` model,
`PwaRegistrar.tsx`), mas o `docker-compose.yml` não define as variáveis VAPID.
Em dev, push notifications falham silenciosamente (o código degrada sem lançar).

Isso significa que qualquer desenvolvedor rodando o projeto localmente não consegue
testar push notifications sem configurar VAPID keys manualmente.

---

## 2. Design Técnico

### Gerar VAPID keys para dev

```bash
# Usar o utilitário do web-push
bunx web-push generate-vapid-keys
```

Isso gera um par de chaves específico para dev (não secreto — é padrão ECDH P-256,
a chave pública pode ser hard-coded no `docker-compose.yml`).

### Adicionar ao `docker-compose.yml`

```yaml
# No serviço `web` ou em um bloco `environment` compartilhado
environment:
  VAPID_PUBLIC_KEY: "BExamplePublicKeyBase64UrlSafe..."
  VAPID_PRIVATE_KEY: "ExamplePrivateKeyBase64UrlSafe..."
  VAPID_SUBJECT: "mailto:dev@reformai.local"
```

### Adicionar ao `.env.example`

```env
# Web Push (VAPID) — gerar com: bunx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@seudominio.com
```

### Documentar no CLAUDE.md §14

Adicionar a variáveis de ambiente a documentação VAPID (está ausente do CLAUDE.md).

---

## 3. Critérios de Aceite

- [ ] `docker-compose.yml` inclui VAPID keys de dev funcionais
- [ ] `.env.example` inclui as três variáveis VAPID com comentário
- [ ] `CLAUDE.md §14` atualizado com VAPID
- [ ] Push notifications funcionam em dev sem configuração manual extra

---

## 4. Dependências

Nenhuma.

---

## 5. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Gerar VAPID keys de dev | 5 min |
| Atualizar `docker-compose.yml` | 15 min |
| Atualizar `.env.example` e `CLAUDE.md` | 20 min |
| Verificar funcionamento em dev | 20 min |
| **Total** | **~1h** |
