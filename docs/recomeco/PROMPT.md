# Prompt inicial para o Claude Code (projeto novo)

## Como usar

```bash
mkdir reformai-simples && cd reformai-simples
git init
cp /caminho/para/PLAN.md .        # o PLAN.md desta pasta
claude                            # abre o Claude Code
```

Cole o prompt abaixo como primeira mensagem. Se quiser que ele planeje antes de
mexer em arquivos, ative o plan mode (Shift+Tab) antes de colar.

---

## Prompt

```
Vamos construir do zero uma plataforma web para uma administradora de
condomínios controlar as reformas nas unidades: saber quais obras exigem ART/RRT,
orientar o morador sobre como conseguir e conferir se ela foi entregue antes de
liberar a obra. O plano completo está em PLAN.md — leia inteiro antes de
qualquer coisa. Ele é a fonte de verdade, e as decisões da §2 já estão tomadas
(uma administradora só, sem parceiro técnico, sem pagamento, sem dados legados).

Contexto: já existe uma versão deste produto que ficou complexa demais (DDD com
12 bounded contexts, monorepo, filas, OCR, 5 agentes de IA, state machine de 18
estados, multi-tenant, rede de parceiros, proposta comercial). Esta versão nova tem que ser o oposto: um único app
Next.js, código direto e fácil de ler, com as regras de negócio em funções puras
e testadas. Se em algum momento você se pegar criando um repositório, um use
case, uma interface com uma implementação só, um "provider", uma factory ou uma
camada de eventos — pare, isso é exatamente o que não queremos.

Regras de trabalho:
1. Runtime e gerenciador de pacotes: Bun. Use `bun`/`bunx`, nunca npm/npx/yarn.
2. Siga as fases do PLAN.md na ordem. Comece pela Fase 0.
3. Antes de cada fase: me mostre em poucas linhas o que vai fazer e quais
   dependências vai instalar. Só instale o que está na stack do PLAN.md; se
   precisar de algo fora dela, pergunte.
4. Ao terminar cada fase: rode `bun test`, lint e typecheck; corrija o que
   quebrar; faça um commit com mensagem clara; me dê um resumo curto (feito /
   pendente / decisões que você tomou) e ESPERE eu confirmar antes da próxima.
5. Regras de negócio só em `lib/rules/`, puras (sem Prisma, sem Next) e com
   teste. Server actions são finas: autentica → valida (Zod) → checa permissão
   → chama regra pura → grava em transação com CaseEvent → revalida.
6. As decisões são tomadas pela Julia-1 (https://supersoniclabs.ia.br/julia-1/,
   modelo de decisão estilo JEV) a partir do contexto da obra — ver §10.2 do
   PLAN.md. Antes de integrar, leia essa página e me mostre como a API funciona;
   não invente endpoint, campos ou variáveis. Trilhos: as regras de `lib/rules/`
   são o piso (a Julia só pode exigir mais, nunca dispensar ART/documento),
   liberar/recusar é sempre clique humano, e toda decisão vira CaseEvent com
   contexto, resposta e justificativa. O Claude (lib/ai.ts) só sugere e comenta.
   O app tem que funcionar 100% sem nenhuma chave de IA, só com as regras.
7. Toda leitura e ação sobre uma obra passa por `getCaseForUser()` / permissões
   no servidor. Arquivos só por URL assinada de curta duração.
8. Código em inglês, textos de tela em português do Brasil.
9. Prefira Server Components e Server Actions. Crie route handler só quando não
   houver alternativa (ex.: download de arquivo).
10. Na Fase 0, crie um CLAUDE.md com no máximo 80 linhas contendo: o que é o
    produto (2 linhas), os princípios da §4 do PLAN.md, a estrutura de pastas,
    os comandos e o padrão de server action, além das decisões da §2. Mantenha-o
    atualizado se algo mudar.
11. Se algo no PLAN.md estiver ambíguo ou parecer errado, pergunte em vez de
    inventar. Não implemente nada da §13 (backlog) sem eu pedir.

Pode começar lendo o PLAN.md e me apresentando o que vai fazer na Fase 0.
```
