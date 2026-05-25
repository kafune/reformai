# A4 — Testes para `NormSearchService`

**Grupo:** A — Backlog técnico  
**Severidade:** Baixa  
**Estimativa:** 2h  

---

## 1. Contexto

`NormSearchService` em `modules/norms/application/NormSearchService.ts` é o único
módulo da camada de aplicação sem nenhum teste. Ele usa pgvector + HuggingFace
Transformers para busca semântica na tabela `NormChunk`.

O risco é baixo isoladamente, mas a falta de testes torna refatorações arriscadas
e não documenta o comportamento esperado.

---

## 2. Design Técnico

### Estratégia de teste

Como o serviço depende de banco real (pgvector) e do modelo de embedding (HuggingFace
local), o ideal é testar com mock das dependências:

```typescript
// Mock do EmbeddingProvider
const mockEmbedder = {
  embed: vi.fn().mockResolvedValue(new Array(384).fill(0.1))
}

// Mock do NormChunkRepository
const mockRepo = {
  findSimilar: vi.fn().mockResolvedValue([
    { id: '1', content: 'NBR 16280 Art. 3...', similarity: 0.92 },
    { id: '2', content: 'Responsabilidade técnica...', similarity: 0.85 },
  ])
}
```

### Casos de teste

```typescript
describe('NormSearchService', () => {
  it('retorna chunks ordenados por similaridade decrescente')
  it('passa o texto de busca para o embedder')
  it('passa o embedding gerado para o repositório')
  it('respeita o limite de resultados padrão (top-K)')
  it('respeita limite customizado se passado')
  it('retorna array vazio quando repositório retorna vazio')
  it('propaga erro do embedder')
  it('propaga erro do repositório')
  it('filtra resultados abaixo do threshold de similaridade mínima')
})
```

### Arquivo a criar

`apps/web/src/modules/norms/application/NormSearchService.test.ts`

---

## 3. Critérios de Aceite

- [ ] 8+ casos de teste cobrindo fluxo feliz, edge cases e propagação de erro
- [ ] Sem dependência de banco real ou rede nos testes
- [ ] `bun run test` passa sem regressões

---

## 4. Dependências

Nenhuma — testes unitários com mocks.

---

## 5. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Analisar interface atual do serviço | 20 min |
| Escrever testes + mocks | 80 min |
| **Total** | **~1.5h** |
