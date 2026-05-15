# M2-W3 — UI de Documentos

**Tipo:** Sessão única  
**Pré-requisito:** M2-W2 mergeada em `main`  
**Duração estimada:** 45–60 min  

---

## PROMPT PARA O CLAUDE CODE

```
Implemente a interface de upload e visualização de documentos do projeto ReformAI.

Leia o CLAUDE.md inteiro antes de começar.

As APIs de documentos já estão implementadas:
- POST   /api/v1/cases/[caseId]/documents      ← upload
- GET    /api/v1/cases/[caseId]/documents      ← listar
- GET    /api/v1/cases/[caseId]/documents/[id]/url  ← obter URL assinada

Leia a página existente do caso para entender o layout e o padrão de componentes:
- apps/web/app/cases/[caseId]/page.tsx

ESCOPO — arquivos que você deve criar:
- apps/web/app/cases/[caseId]/documents/page.tsx
- apps/web/app/cases/[caseId]/documents/components/DocumentUploadZone.tsx
- apps/web/app/cases/[caseId]/documents/components/DocumentList.tsx
- apps/web/app/cases/[caseId]/documents/components/DocumentStatusBadge.tsx
- apps/web/app/cases/[caseId]/documents/components/DocumentTypeSelect.tsx

COMPORTAMENTO ESPERADO:

page.tsx:
  Página de documentos do caso. Deve exibir:
  - Cabeçalho com protocolo do caso e status atual
  - DocumentUploadZone no topo
  - DocumentList abaixo
  Use Server Component para buscar a lista inicial de documentos.
  Adicione link para esta página a partir de cases/[caseId]/page.tsx.

DocumentUploadZone:
  Client Component.
  - Área de drag & drop e botão "Selecionar arquivo"
  - Seletor de tipo de documento (DocumentTypeSelect)
  - Tipos aceitos visivelmente: PDF, JPEG, PNG (máx 20MB)
  - Durante upload: indicador de progresso (pode ser simples — desabilita o botão)
  - Em sucesso: revalida a lista via router.refresh()
  - Em erro: exibe a mensagem de erro retornada pela API
  - Não use bibliotecas de upload externas — use fetch + FormData nativo

DocumentList:
  Client Component.
  - Lista cada documento com: nome do arquivo, tipo, status, data de upload
  - Botão "Visualizar" → chama GET /url e abre em nova aba
  - Polling a cada 5 segundos enquanto algum documento estiver com status PENDING
    ou PROCESSING (para atualizar o status após processamento do worker)
  - Exibe DocumentStatusBadge para cada documento
  - Estado vazio: mensagem "Nenhum documento enviado ainda"

DocumentStatusBadge:
  Mapeia DocStatus para cor e texto:
  - PENDING       → cinza    "Aguardando"
  - PROCESSING    → azul     "Processando..."
  - VALID         → verde    "Válido"
  - VALID_WITH_CAVEATS → amarelo "Válido com ressalvas"
  - INVALID       → vermelho "Inválido"
  - MISSING       → laranja  "Ausente"

DocumentTypeSelect:
  Select com os tipos de documento em português:
  - ART_RRT         → "ART/RRT"
  - MEMORIAL        → "Memorial Descritivo"
  - PROJECT         → "Projeto"
  - SCHEDULE        → "Cronograma"
  - WORKFORCE       → "Relação de Mão de Obra"
  - WORKER_DOCS     → "Documentos dos Trabalhadores"
  - AUTHORIZATION   → "Autorização do Condomínio"
  - PHOTOS          → "Fotos"
  - OTHER           → "Outro"

REGRAS DE UI:
  - Use shadcn/ui e Tailwind CSS (já instalados no projeto)
  - Não use nenhuma biblioteca de componentes além das já no projeto
  - Mobile-first: a interface deve funcionar em telas a partir de 375px
  - Nunca exiba a storageKey ao usuário — apenas o fileName
  - Após implementar, inicie o servidor de desenvolvimento e teste:
    1. Login como morador@demo.com / senha123
    2. Acesse um caso existente
    3. Faça upload de um PDF de teste
    4. Verifique que o status muda para PROCESSING e depois VALID

NÃO TOQUE em:
- Nenhuma API route
- apps/web/app/cases/[caseId]/page.tsx além de adicionar o link para /documents
- Nenhum arquivo fora de app/cases/[caseId]/documents/

Runtime: bun. Rode `bun run dev` para testar.
```

---

## Arquivos gerados por esta wave

```
apps/web/app/cases/[caseId]/documents/
  page.tsx
  components/DocumentUploadZone.tsx
  components/DocumentList.tsx
  components/DocumentStatusBadge.tsx
  components/DocumentTypeSelect.tsx
```

## Checklist antes de mergear

- [ ] Upload de arquivo funciona end-to-end
- [ ] Status PROCESSING atualiza via polling
- [ ] Botão "Visualizar" abre documento em nova aba
- [ ] Interface responsiva em mobile
- [ ] `bun run build` sem erros
