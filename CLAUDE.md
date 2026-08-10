# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Extensão Chromium (MV3) que converte o CSV de produtos do Bling em folhas de
etiquetas com código de barras, prontas para impressão. O plano de arquitetura
completo está em [PLANO.md](PLANO.md) — quando uma decisão parecer arbitrária,
a justificativa costuma estar lá.

## Idioma

Identificadores, comentários, nomes de arquivo e strings de UI são **em
português**. `Campo`, `Modelo`, `etiquetasDaLinha`, `armazenamento.ts` — não
traduza para inglês ao editar, e siga a convenção ao criar código novo.

> **Atenção:** a árvore de pastas em PLANO.md §3.2 está desatualizada — ela usa
> nomes em inglês (`template/`, `symbology/`, `toDrawOps.ts`, `storage.ts`) que
> nunca existiram no código. A árvore real é a do [README.md](README.md).
> O resto do PLANO.md continua válido.

## Comandos

```bash
npm install
npm run dev          # crxjs escreve/observa dist/ com HMR
npm run build        # tsc --noEmit && vite build
npm run typecheck    # só a checagem de tipos
npm test             # Vitest, só src/**/*.test.ts (11 arquivos, 262 testes)
npm run test:watch

node scripts/gerar-icones.mjs   # regera os PNGs dos ícones, sem dependências
```

Rodar um teste isolado:

```bash
npx vitest run src/core/etiqueta/etiqueta.test.ts
npx vitest run -t "nome do caso"
```

### Armadilha do `dist/`

`npm run dev` e `npm run build` escrevem no **mesmo** `dist/`. Um `dev` deixa
para trás um `service-worker-loader.js` que importa de
`http://localhost:5173/...` e um `manifest.json` com `web_accessible_resources`
de dev. Carregar esse `dist/` no navegador falha com *"Service worker
registration failed. Status code: 3"*, porque o MV3 proíbe script remoto.

**Sempre `rm -rf dist` antes de empacotar ou de importar no navegador.** O
loader correto de produção tem uma linha só: `import './assets/service-worker.ts-<hash>.js';`

### Carregar no navegador

`chrome://extensions` (ou `edge://extensions`) → Modo do desenvolvedor →
Carregar sem compactação → selecionar **`dist/`**, não a raiz.

## Arquitetura

### O invariante central: um renderizador, dois backends

É o ponto que sustenta o projeto inteiro. Prévia na tela, HTML de impressão e
PDF **não podem** ser três implementações — elas divergiriam e o usuário
imprimiria algo diferente do que viu.

```
Modelo + linha do CSV
        │
        ▼
   resolver()          resolve {chaves}, formatadores, quebra de texto
        │
        ▼
    DrawOp[]           lista plana, coordenadas ABSOLUTAS em mm
        │              origem no canto superior esquerdo da página
        ├──────────► core/render/svg.ts   → prévia React + página de impressão
        └──────────► core/render/pdf.ts   → arquivo .pdf (jsPDF)
```

`DrawOp` ([src/core/render/tipos.ts](src/core/render/tipos.ts)) é a **única**
fronteira entre cálculo e desenho: `rect` | `texto` | `linha`. Qualquer bug de
layout aparece igual nos dois caminhos, e um teste sobre `DrawOp[]` cobre ambos.

Consequências que precisam ser preservadas:

- A prévia em React **delega a `opsParaSvg`** via `dangerouslySetInnerHTML`. Não
  monte elementos React equivalentes — seria a segunda implementação de SVG.
- Ao adicionar um tipo de desenho, estenda `DrawOp` e os **dois** backends.

### `core/` é puro

**Nada em `src/core/` importa React ou toca no DOM.** É o que permite testar a
geração de PDF sem navegador. `src/app/` pode depender de `core/`; nunca o
contrário.

### Nada no modelo é absoluto

Guardar posições em mm faria a troca de grade 2×4 → 3×6 jogar todos os campos
para fora da etiqueta. Por isso, em `Campo`
([src/core/etiqueta/tipos.ts](src/core/etiqueta/tipos.ts)):

| O quê | Unidade | Base |
|---|---|---|
| `x`, `y`, `w`, `h` | fração 0–1 | largura / altura da etiqueta |
| `fonte.tamanhoPct` | fração 0–1 | **altura** da etiqueta |
| `legendaPct` | fração 0–1 | altura da etiqueta |

**`pt` não existe no modelo.** Ele só aparece na fronteira com o backend de
desenho, calculado a partir do mm. A UI sempre exibe mm; a conversão é interna.

Dois pisos rígidos viram aviso nomeando o campo: **módulo do código < 0,25 mm**
(nenhum leitor lê) e **altura da letra < 1,2 mm** (a térmica borra).

### A grade resolve nos dois sentidos

`ModoGrade` decide qual lado da conta o usuário controla — `porGrade`
(colunas × linhas fixas, etiqueta derivada, preenche a página) ou `porEtiqueta`
(tamanho fixo, colunas × linhas derivadas, pode sobrar). Em `porEtiqueta` o
`+ gap` no numerador não é opcional: não há espaço depois da última etiqueta, e
esquecê-lo faz caber uma etiqueta a menos do que realmente cabe.

Ao trocar de modo, o arredondamento **precisa ser para baixo**: A4 com margem 3
e 3 colunas dá 66,666… mm; arredondar para 66,7 estoura a área útil e derruba a
grade para 2 colunas. Há teste nas duas direções.

### Estado (`src/app/`)

- [store.ts](src/app/store.ts) — Zustand, estado do app inteiro.
- [storeEtiqueta.ts](src/app/storeEtiqueta.ts) — undo/redo, puro e testado.
  Guarda **modelos inteiros, não diffs** (poucas dezenas de campos: a cópia é
  barata e a lógica não ganha bug próprio).
- [armazenamento.ts](src/app/armazenamento.ts) — `chrome.storage.local` na
  extensão, `localStorage` no dev server, escolhido em runtime pela presença de
  `chrome.storage`. Grava com debounce de 400 ms.

**O CSV nunca é persistido** — é grande, muda a cada export do Bling e
reimportá-lo é um clique. Só as escolhas moram no storage. Tudo que volta do
storage passa por `lerModelo`, que valida campo a campo; estado corrompido
nunca pode impedir o app de abrir.

## O CSV do Bling

Arquivo de referência versionado: `produtos_2026-07-20-10-29-43.csv` (59
colunas, 12 produtos), usado como fixture por 4 arquivos de teste que o abrem
via `process.cwd()`.

> É um export real, com as colunas comerciais zeradas antes de ir para o
> repositório público: `Preço de custo`, `Cód. no fornecedor`, `Fornecedor`,
> `Descrição do Produto no Fornecedor` e `Preço de Compra` estão vazias de
> propósito — nenhum teste as lê. Todo o resto é o dado real, incluindo as
> armadilhas abaixo. **Não repovoe essas colunas** ao mexer no fixture.

Armadilhas confirmadas nos dados reais:

- UTF-8 **com BOM**, delimitador `;`, CRLF, todos os campos entre aspas.
- Tabs coladas dentro dos valores (`"261\t"`, `"\t7898757181218"`) — daí o trim
  agressivo (espaço, `\t`, NBSP).
- `GTIN/EAN` vazio em **10 de 12** produtos.
- Decimal brasileiro (`"119,90"`), estoque com 4 casas (`"42,0000"`), categoria
  hierárquica (`"Filamentos>>PLA>>Básico"`).

Nenhum índice de coluna fixo no código: o mapeamento é por nome, porque o Bling
pode mudar o export.

Quantas etiquetas cada linha rende ([core/produtos.ts](src/core/produtos.ts))
é `Qtd. × Estoque` com o multiplicador ligado (o padrão — o caso de uso é
etiquetar cada unidade física). A trava de linha é definida como **"a linha
rende 0 etiquetas"**, não como "estoque é zero" — é o que faz desligar o
multiplicador destravar a linha sem nenhum caso especial. Preserve essa
definição ao mexer.

## Simbologias

`bwip-js` cobre as 19 simbologias pedidas. A integração é **vetorial**, via
`raw()`, que devolve o símbolo cru sem rasterizar.

```ts
import bwipjs from 'bwip-js/browser'   // subcaminho obrigatório
```

O mapa `exports` do pacote não tem condição `default`, então o import genérico
**não resolve** sob `moduleResolution: bundler`.

Dois detalhes que só apareceram sondando a saída real:

- **`bhs` não é constante.** No Code 128 vale 1 em todas as barras; no PostNet
  vale 0,125 e 0,05 (barras altas e baixas). Ignorá-lo faz o PostNet sair
  ilegível.
- **Módulos escuros vizinhos do QR são fundidos** num retângulo por linha —
  ~220 → ~110 num QR 21×21, e evita costuras claras na impressão. O teste
  **remonta a matriz** a partir dos retângulos; comparar só a área total
  passaria com módulos fora de lugar.

## MV3: armadilhas que custam tempo

1. **Nunca declarar `action.default_popup`.** Com um popup declarado,
   `chrome.action.onClicked` nunca dispara e a aba não abre. Está anotado em
   [manifest.config.ts](manifest.config.ts) — o manifest é gerado de lá, não
   existe `manifest.json` versionado.
2. **A CSP proíbe `eval`**, que o HMR padrão do Vite usa. É por isso que o
   projeto depende de `@crxjs/vite-plugin`.
3. **Sem código remoto.** `bwip-js`, `jspdf` e ícones vão no bundle, nunca via
   CDN. Ícones são SVG inline desenhados à mão (`Icone.tsx`).
4. **O service worker é efêmero e não guarda estado** — ele só faz `tabs.create`
   (reaproveitando a aba se já estiver aberta). Toda a lógica vive na aba.
5. **Sem permissões de host e sem requisição de rede.** O CSV entra por
   `<input type="file">` local e nenhum dado de produto sai da máquina. Não
   introduza rede sem uma decisão explícita: quebraria a premissa de privacidade
   do README e a revisão trivial na Web Store.

A página do app **não** está declarada no manifest (não é popup nem
`options_page`), então `vite.config.ts` precisa listá-la em
`rollupOptions.input` — sem essa entrada o crxjs não a inclui no bundle.

## Testes

Vitest em ambiente `node`, só `src/**/*.test.ts` — a suíte cobre `core/`, que é
puro por construção. `vitest.config.ts` é separado de propósito (o plugin crxjs
não tem o que fazer numa suíte de lógica pura) e **precisa espelhar o alias
`@/`** do `vite.config.ts`, senão testes que importam por `@/...` quebram
enquanto o build passa.

Duas armadilhas ao escrever testes:

- **Proporcionalidade:** o ajuste `encolher` reduz a letra que não cabe na
  largura do campo. Um teste que varia só a **altura** da etiqueta mede o
  encolhimento, não a proporção — escale **os dois eixos** juntos, ou use
  `cortar` para isolar.
- **Métricas de fonte:** `encolher` mede com a tabela AFM local, o PDF desenha
  com a do jsPDF. Há teste confrontando as duas (diferença < 2%, e a local
  **nunca subestima** — subestimar faria o `encolher` achar que cabe e o texto
  vazaria no papel).

TypeScript roda em `strict` com `noUncheckedIndexedAccess`,
`noUnusedLocals`/`noUnusedParameters` — indexar um array devolve `T | undefined`
e o build reclama de import não usado.
