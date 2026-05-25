# A6 — Limpar Métodos de Repositório Mortos

**Grupo:** A — Backlog técnico  
**Severidade:** Baixa (limpeza)  
**Estimativa:** 1h  

---

## 1. Contexto

Os use cases de `inspection-scheduling` e `partner-network` foram refatorados para
chamar `prisma` diretamente (pragmático, mais rápido), deixando métodos de repositório
sem uso. O código morto polui as interfaces e confunde novos desenvolvedores sobre
qual padrão seguir.

Arquivos afetados (aproximados):
- `inspection-scheduling/infrastructure/PrismaInspectionRepository.ts`
- `partner-network/infrastructure/PrismaPartnerRepository.ts`

---

## 2. Design Técnico

### Opção A — Remover os métodos não utilizados (recomendada)

1. Identificar todos os métodos não referenciados por TypeScript (`tsc --noEmit`
   e busca de importações).
2. Remover os métodos mortos dos arquivos de repositório.
3. Se a interface de domínio declara os métodos, remover da interface também.

### Opção B — Migrar use cases de volta para repositório

Mover as queries `prisma.*` dos use cases para os métodos de repositório adequados.
Mais trabalho, mas alinha com DDD estrito.

**Decisão:** Usar **Opção A** no curto prazo. Se o projeto escalar para múltiplos
adapters de persistência, migrar para Opção B.

### Checklist de limpeza

```bash
# Encontrar imports não utilizados
bun run tsc --noEmit 2>&1 | grep "is declared but"

# Buscar referências a métodos suspeitos
grep -r "PrismaInspectionRepository\|PrismaPartnerRepository" apps/web/src/
```

---

## 3. Critérios de Aceite

- [ ] Nenhum método público de repositório declarado mas não referenciado
- [ ] `tsc --noEmit` passa sem warnings de "declared but never read"
- [ ] `bun run test` continua passando após a limpeza

---

## 4. Dependências

Nenhuma.

---

## 5. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Mapear métodos mortos | 20 min |
| Remover código | 20 min |
| Verificar testes | 20 min |
| **Total** | **~1h** |
