# C3 — Preview Inline de Documentos PDF/Imagem

**Grupo:** C — Features novas  
**Prioridade:** 🔴 Alto impacto, baixo esforço  
**Estimativa:** 1 dia  

---

## 1. Contexto

Hoje todos os documentos abrem em nova aba via signed URL. Isso:
- Tira o usuário do contexto da plataforma
- Não funciona bem em mobile (comportamento de aba varia por browser)
- Não permite comentários ou marcações inline
- Signed URLs de 1h expiram se o usuário deixar a aba aberta

Um preview inline dentro da página do caso melhora drasticamente a experiência de
revisão de documentos.

---

## 2. User Stories

- **Como administrador revisando um caso**, quero visualizar o PDF do memorial
  descritivo diretamente na página sem sair da plataforma, para comentar e tomar
  decisões sem perder contexto.

- **Como morador**, quero ver minhas fotos de vistoria em um carrossel dentro da
  plataforma, sem precisar baixar cada arquivo.

- **Como parceiro**, quero visualizar o ART/RRT enviado pelo morador para verificar
  antes de assinar meu relatório.

---

## 3. Design Técnico

### 3.1 Componente `DocumentViewer`

```tsx
// interfaces/components/ui/DocumentViewer.tsx

interface DocumentViewerProps {
  documentId: string
  mimeType: string
  fileName: string
  onClose: () => void
}

// Renderiza:
// - PDF → <iframe src={signedUrl} /> com toolbar mínima
// - image/* → <img src={signedUrl} /> com zoom
// - Fallback → "Tipo não suportado — [Baixar arquivo]"
```

### 3.2 Estratégia por tipo de arquivo

**PDFs:**
```tsx
// Opção A (simples): iframe com signed URL
<iframe src={signedUrl} className="w-full h-[80vh]" />

// Opção B (mais controle): react-pdf
// npm add react-pdf @types/react-pdf
// Permite navegação por páginas, zoom, busca de texto
// Pesa ~300KB gzip — avaliar vs iframe
```

**Imagens (JPEG, PNG, WEBP):**
```tsx
// Lightbox nativo — <dialog> do HTML5 com a imagem em fullscreen
// Suporte a zoom com CSS transform
// Para múltiplas fotos (vistorias): carrossel com prev/next
```

**Recomendação:** Usar **iframe** para PDFs no MVP (zero dependências extras),
migrar para `react-pdf` se precisar de busca de texto ou marcações.

### 3.3 Fetch da signed URL

O componente chama `GET /api/v1/cases/:caseId/documents/:documentId/url` para
obter a signed URL fresca quando abre o viewer (não usar URL cacheada do estado da
página que pode ter expirado).

```typescript
// Hook: useDocumentSignedUrl
function useDocumentSignedUrl(caseId: string, documentId: string) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/documents/${documentId}/url`)
      .then(r => r.json())
      .then(d => setUrl(d.url))
  }, [caseId, documentId])

  return url
}
```

### 3.4 Modal de preview

Exibir o viewer em um `<dialog>` fullscreen ou Sheet (drawer) lateral para PDFs
longos:

```
┌─────────────────────────────────────────────────────┐
│  memorial-descritivo-v2.pdf           [Baixar] [✕]  │
│ ─────────────────────────────────────────────────── │
│                                                     │
│  [iframe / react-pdf / imagem]                      │
│                                                     │
│  Página 1 de 4  [◀] [▶]                             │
└─────────────────────────────────────────────────────┘
```

### 3.5 Fotos de vistoria — carrossel

Em `/partner/cases/[caseId]/inspections/[id]`, as fotos passam a ter preview
inline com carrossel:

```
┌────────────────────────────────┐
│                                │
│   [←]   [foto principal]  [→]  │
│                                │
│  ○ ● ○ ○ ○  (indicadores)      │
└────────────────────────────────┘
```

### 3.6 Manter download disponível

O botão "Baixar" continua presente — o preview é um complemento, não substituto.

### 3.7 Arquivos a criar/alterar

| Arquivo | Ação |
|---------|------|
| `interfaces/components/ui/DocumentViewer.tsx` | Criar componente |
| `interfaces/components/ui/ImageCarousel.tsx` | Criar para fotos de vistoria |
| `app/cases/[caseId]/documents/page.tsx` | Usar `DocumentViewer` no clique |
| `app/(admin)/review-queue/[caseId]/page.tsx` | Usar `DocumentViewer` |
| `app/(partner)/partner/cases/[caseId]/inspections/[id]/page.tsx` | Usar `ImageCarousel` |

---

## 4. Critérios de Aceite

- [ ] Clicar em documento PDF abre viewer inline (não nova aba)
- [ ] Clicar em imagem abre lightbox inline
- [ ] Viewer busca signed URL fresca no momento de abertura
- [ ] Botão "Baixar" mantido e funcional
- [ ] Botão "Fechar" (✕) e tecla Escape fecham o viewer
- [ ] Fotos de vistoria exibidas em carrossel com navegação
- [ ] Tipos não suportados exibem fallback com link de download
- [ ] Funciona em mobile (dialog fullscreen)

---

## 5. Dependências

Nenhuma dependência bloqueante. Se optar por `react-pdf`, adicionar pacote.

---

## 6. Estimativa

| Tarefa | Tempo |
|--------|-------|
| Componente `DocumentViewer` (iframe + imagem) | 2h |
| Componente `ImageCarousel` | 1.5h |
| Integrar nas 3 páginas | 1.5h |
| Testes manuais (mobile + desktop) | 1h |
| **Total** | **~6h (1 dia)** |
