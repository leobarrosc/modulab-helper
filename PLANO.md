# Modulab Helper — Plano de Implementação

Extensão Chromium (Chrome / Edge) para gerar folhas de etiquetas com código de
barras e QR Code a partir de um CSV exportado do Bling.

---

## 1. Decisões travadas

| Tema | Decisão |
|---|---|
| Geração de saída | **Dois caminhos**: `Baixar PDF` (jsPDF, vetorial, mm exatos) e `Imprimir` (HTML + `@page`) |
| Campo padrão do código | **`GTIN/EAN`**, alternável para `Código` antes de importar |
| Editor de layout | **Canvas drag-and-drop** com alças de redimensionamento |
| Stack | **Vite + React + TypeScript** (+ `@crxjs/vite-plugin` para MV3) |
| Cor | Preto e branco; tom de cinza opcional por campo (0–100%) |
| Ativação | Clique no ícone → `chrome.action.onClicked` → abre nova aba |

> Nota: "code 126" no enunciado é **Code 128**. É o default de simbologia.

---

## 2. O que o CSV realmente tem

Arquivo de referência: `produtos_2026-07-20-10-29-43.csv`

- **Encoding**: UTF-8 **com BOM** (`EF BB BF`) — precisa ser removido antes do parse.
- **Delimitador**: `;` · **Quebra de linha**: CRLF · **Todos os campos entre aspas**.
- **59 colunas**, 12 produtos.

### Armadilhas confirmadas nos dados

| Problema | Exemplo real | Tratamento |
|---|---|---|
| Tab no fim do `Código` | `"261\t"` | `trim()` agressivo (espaço, `\t`, NBSP ` `) em toda célula |
| Tab no início do `GTIN/EAN` | `"\t7898757181218"` | idem |
| `GTIN/EAN` vazio | vazio em **10 de 12** produtos | por isso **não** é o campo padrão; suporte a *fallback* no template |
| Decimal brasileiro | `"119,90"` | normalizar para `119.90` nos formatadores numéricos |
| Categoria hierárquica | `"Filamentos>>PLA>>Básico"` | formatador `|ultimo` extrai `Básico` |
| Estoque com 4 casas | `"42,0000"` | formatador `|numero:0` → `42` |

### De onde sai o valor do código de barras

O usuário escolhe **antes de importar** (e pode trocar depois, junto dos
filtros) entre duas colunas:

| Fonte | Situação neste CSV |
|---|---|
| **`GTIN/EAN`** (padrão) | Preenchido em **2 de 12** produtos |
| `Código` | Preenchido em **12 de 12** |

Produto sem valor na coluna escolhida **começa desmarcado e é pintado em
vermelho** — faixa vermelha na borda esquerda, fundo avermelhado e a célula
dizendo `sem GTIN/EAN`. Não é travado como o estoque zero: a etiqueta ainda
pode ser impressa, só sairia sem código.

Regras de borda:

- **Se a coluna escolhida não existir no arquivo**, a regra é ignorada e a fonte
  cai para a que existir. Sem essa guarda, um CSV sem `GTIN/EAN` abriria com
  zero produtos marcados e nenhuma pista do motivo.
- **Trocar a fonte reinicia a seleção** para o padrão da nova fonte. Preservar a
  antiga deixaria linhas desmarcadas que agora têm código, sem explicação.
- **A coluna escolhida ganha lugar próprio na tabela**, com o rótulo
  `código de barras` sob o nome, e sai da lista de colunas normais para não
  aparecer duplicada quando a fonte é `Código`.

> **Consequência prática**: com o padrão `GTIN/EAN`, este arquivo abre com
> **2 de 12 produtos** marcados e 7 etiquetas. Trocando para `Código`, volta a
> 11 produtos e 84 etiquetas. Vale checar se `GTIN/EAN` é mesmo o padrão certo
> para o uso do dia a dia.

### Ordenação da lista

Clicar num cabeçalho cicla **crescente → decrescente → ordem do arquivo**. Vale
para a coluna do código e para todas as colunas de dados.

Não é cosmética de tabela: **esta é a ordem em que as etiquetas saem impressas**
na folha. Por isso a comparação mora em `core/ordenacao.ts`, pura e testada, e
é aplicada depois do filtro.

Regras que não são óbvias:

- **Células vazias vão para o fim nas duas direções.** Se invertessem junto, os
  10 produtos sem `GTIN/EAN` tomariam o topo da lista ao ordenar decrescente —
  escondendo justamente os que têm código.
- **Números são comparados como números**, não como texto: `42` vem depois de
  `9`, e `1.234,56` depois de `999,00`. Sem isso a ordem por `Preço` e `Estoque`
  sairia alfabética e errada.
- **Ordenação estável**: empates preservam a ordem do arquivo.
- **O terceiro clique volta à ordem do Bling**, que às vezes é a que se quer.

### Quantas etiquetas cada produto rende

Implementado em `core/produtos.ts`, puro e testado.

```
etiquetas da linha = Qtd. × Estoque      (multiplicador ligado, padrão)
etiquetas da linha = Qtd.                (multiplicador desligado)
```

O caso de uso real é etiquetar **cada unidade física** na prateleira: o código
261 tem 42 rolos em estoque, logo 42 etiquetas. O campo `Qtd.` deixa de ser
"quantas etiquetas" e passa a ser "quantas etiquetas **por unidade**".

Regras de borda, todas com teste:

| Situação | Decisão | Porquê |
|---|---|---|
| Estoque `0`, multiplicando | Linha **travada**: checkbox desabilitado | Marcar não produziria etiqueta nenhuma |
| Estoque `0`, sem multiplicar | Linha **destravada**, rende `Qtd.` | Aí sim faz sentido etiquetar um produto zerado |
| Estoque negativo | Conta como `0` | O Bling permite negativo; sem a trava, subtrairia do total |
| Estoque fracionário (`1,5`) | Arredonda para baixo | Não existe meia etiqueta |
| Sem coluna `Estoque` | Multiplicador é ignorado, vale `Qtd.` | Melhor imprimir o pedido que zerar a linha em silêncio |

A trava é definida como **“a linha rende 0 etiquetas”**, não como “estoque é
zero”. É o que faz desligar o multiplicador destravar a linha sozinho, sem
nenhum caso especial.

Consequências que caem de graça dessa definição:

- **“Marcar todos” não alcança linhas travadas** — senão ele desfaria a exclusão
  automática dos zerados a cada clique.
- **O checkbox do cabeçalho fica marcado de verdade**, não indeterminado, quando
  tudo que é selecionável está selecionado. Sem isso ele ficava num estado
  ambíguo (quadrado escuro com traço) que de relance parecia “tudo marcado”.
- **Ligar o multiplicador purga da seleção** o que passou a render zero, senão
  sobraria item marcado no estado e desenhado como travado na tela.

A coluna **Etiquetas** mostra o resultado por linha, com o motivo (`sem estoque`)
sob o número, para o cálculo nunca ficar implícito.

> **Atenção para a Fase 5**: com o multiplicador ligado, um export grande do
> Bling pode render milhares de etiquetas. A geração de PDF precisa paginar sob
> demanda e avisar acima de um limite (ex.: 500), senão trava a aba.

### Colunas úteis para etiqueta

`ID`, `Código`, `Descrição`, `Preço`, `Estoque`, `Localização`, `Marca`,
`Categoria do produto`, `GTIN/EAN`, `Unidade`, `Situação`, `Fornecedor`.

---

## 3. Arquitetura

### 3.1 Princípio central: **um renderizador, dois backends**

Este é o ponto mais importante do projeto. O preview na tela, o HTML de
impressão e o PDF **não** podem ser três implementações diferentes — divergem e
o usuário imprime algo diferente do que viu.

```
LabelTemplate + linha do CSV
        │
        ▼
   resolve()            ← resolve {chaves}, aplica formatadores, quebra texto
        │
        ▼
    DrawOp[]            ← lista plana: { rect } | { text } | { line }
        │                  coordenadas absolutas em mm
        ├──────────────► backend SVG    → preview React + página de impressão
        └──────────────► backend jsPDF  → arquivo .pdf
```

`DrawOp` é a **única** fronteira. Qualquer bug de layout aparece igual nos dois
caminhos, e um teste unitário sobre `DrawOp[]` cobre ambos.

```ts
type DrawOp =
  | { op: 'rect';  x: number; y: number; w: number; h: number; gray: number; fill: boolean }
  | { op: 'text';  x: number; y: number; text: string; font: FontSpec; align: Align; gray: number; rotation: Rotation }
  | { op: 'line';  x1: number; y1: number; x2: number; y2: number; width: number; gray: number };
```

### 3.2 Estrutura de pastas

```
modulab-helper/
├── manifest.json
├── vite.config.ts
├── package.json
└── src/
    ├── background/
    │   └── service-worker.ts        # chrome.action.onClicked → tabs.create
    ├── core/                        # LÓGICA PURA — zero DOM, 100% testável
    │   ├── csv/
    │   │   ├── detect.ts            # BOM, encoding, delimitador
    │   │   ├── parse.ts             # parser RFC4180 c/ aspas e quebras internas
    │   │   └── normalize.ts         # trim, números BR, colunas virtuais
    │   ├── template/
    │   │   ├── types.ts             # LabelTemplate, LabelField
    │   │   ├── resolve.ts           # {chave|formatador ?? fallback}
    │   │   └── formatters.ts
    │   ├── layout/
    │   │   ├── grid.ts              # cols/rows/gaps → tamanho da etiqueta
    │   │   └── paginate.ts          # fila de etiquetas → páginas
    │   ├── symbology/
    │   │   ├── registry.ts          # catálogo + status (pronto / em breve)
    │   │   ├── encode.ts            # bwip-js → módulos
    │   │   └── validate.ts          # dígito verificador, tamanho, charset
    │   └── render/
    │       ├── toDrawOps.ts         # LabelTemplate + dados → DrawOp[]
    │       ├── backendSvg.ts
    │       └── backendPdf.ts
    ├── app/                         # a aba nova (React)
    │   ├── index.html
    │   ├── main.tsx
    │   ├── store.ts                 # Zustand + undo/redo
    │   ├── components/
    │   │   ├── ImportPanel.tsx
    │   │   ├── ProductTable.tsx
    │   │   ├── LabelCanvas.tsx      # drag-and-drop
    │   │   ├── FieldInspector.tsx   # o painel do print
    │   │   ├── PageSettings.tsx
    │   │   └── SheetPreview.tsx
    │   └── storage.ts               # chrome.storage.local
    └── assets/icons/
```

Regra: **nada em `core/` importa React ou toca no DOM.** É o que permite testar
o gerador de PDF sem navegador.

---

## 4. Modelo de dados

```ts
type FieldType = 'text' | 'barcode' | 'qrcode' | 'line' | 'box';
type Rotation  = 0 | 90 | 180 | 270;

interface LabelField {
  id: string;
  type: FieldType;
  name: string;                  // rótulo na lista de camadas

  // Posição em FRAÇÃO da etiqueta (0–1), exibida em mm na UI.
  // Ver §5 — é o que faz o layout sobreviver a mudanças de grade.
  x: number; y: number; w: number; h: number;
  rotation: Rotation;
  gray: number;                  // 0 = preto, 1 = branco
  locked: boolean;
  z: number;

  template: string;              // "{Descrição}" · "R$ {Preço|moeda}"

  // type: 'text'
  font?: FontSpec;               // family, sizePt, bold, italic
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
  overflow?: 'shrink' | 'wrap' | 'ellipsis' | 'clip';
  maxLines?: number;
  lineHeight?: number;

  // type: 'barcode' | 'qrcode'  ← corresponde ao painel do print
  symbology?: SymbologyId;       // "Tipo"
  barHeightMm?: number;          // "Altura"
  moduleWidth?: number;          // "Tamanho" (largura da barra fina)
  quietZoneMm?: number;          // "Margem"
  showHRI?: boolean;             // legenda humana sob as barras
  hriFont?: FontSpec;            // "Fonte" + tamanho
  qrEcc?: 'L' | 'M' | 'Q' | 'H';
}

interface LabelTemplate {
  id: string;
  name: string;
  page: { preset: PagePresetId; wMm: number; hMm: number; orientation: 'retrato' | 'paisagem' };
  grid: {
    cols: number; rows: number;
    gapXMm: number; gapYMm: number;
    margin: { top: number; right: number; bottom: number; left: number };
  };
  border: { show: boolean; widthMm: number; gray: number };
  fields: LabelField[];
}
```

### A grade resolve nos dois sentidos

O usuário escolhe qual lado da conta controla:

**`porGrade`** — define colunas × linhas, a etiqueta é derivada e **preenche a
página inteira**. Para folha adesiva pré-cortada.

```ts
labelW = (utilW - gapX * (cols - 1)) / cols
labelH = (utilH - gapY * (rows - 1)) / rows
```

**`porEtiqueta`** — define o tamanho da etiqueta, colunas × linhas são derivadas
e **pode sobrar espaço**. Para quando a etiqueta tem medida obrigatória.

```ts
cols = floor((utilW + gapX) / (labelW + gapX))
rows = floor((utilH + gapY) / (labelH + gapY))
```

O `+ gap` no numerador existe porque **não há espaço depois da última etiqueta**.
Esquecer isso faz caber uma etiqueta a menos do que realmente cabe.

O campo derivado aparece **somente leitura** na UI, e a sobra é informada em mm.
A grade é ancorada na margem superior esquerda; a sobra fica à direita e
embaixo, como em folhas adesivas reais.

#### Armadilha do arredondamento na troca de modo

Trocar de modo leva o resultado atual para os campos do modo novo, para o
layout não saltar. Esse arredondamento **precisa ser para baixo**:

> A4 com margem 3 e 3 colunas dá etiqueta de 66,666… mm. Arredondada para
> **66,7**, três delas somam 204,1 mm numa área útil de 204 — e a grade cai
> para **2 colunas**, perdendo 8 etiquetas por folha. Para **66,6**, continua 3.

Coberto por teste que verifica as duas direções do arredondamento.

---

## 5. O problema difícil: layout que sobrevive à mudança de grade

Se as posições fossem guardadas em mm absolutos, mudar de 2×4 para 3×6 jogaria
todos os campos para fora da etiqueta. Solução: **nada no modelo é absoluto.**

| O quê | Unidade | Base |
|---|---|---|
| Posição e tamanho do campo | fração 0–1 | largura / altura da etiqueta |
| **Tamanho da fonte** | **fração 0–1** | **altura da etiqueta** |
| Legenda do código | fração 0–1 | altura da etiqueta |

O `pt` **não existe no modelo** — ele só aparece na fronteira com o backend de
desenho, calculado a partir do mm. Guardar em pt exigiria reescalar tudo a cada
mudança de grade; em fração, trocar a etiqueta de 34 mm para 95 mm já deixa
todo o conteúdo na mesma proporção, sem nenhuma conversão.

Isso substituiu o antigo toggle "escalar fontes com a etiqueta", que era um
remendo em cima de um modelo absoluto.

A UI mostra a **% e o mm resultante lado a lado**, mais atalhos de fração
(1/20, 1/12, 1/10, 1/8, 1/6, 1/4). A % sozinha não diz se o texto sai legível.

### Dois pisos rígidos

- **Módulo do código**: abaixo de **0,25 mm** nenhum leitor lê.
- **Altura da letra**: abaixo de **1,2 mm** a impressora térmica borra.

Ambos viram aviso nomeando o campo e o valor em mm, e o indicador de equivalência
fica vermelho.

### Cuidado ao testar proporcionalidade

O ajuste `encolher` reduz a letra que não cabe na largura do campo. Um teste que
varia só a **altura** da etiqueta vai medir o encolhimento, não a proporção —
é preciso escalar **os dois eixos** juntos, ou usar `cortar` para isolar.

---

## 6. Presets de página

| Preset | mm | Uso típico |
|---|---|---|
| A4 | 210 × 297 | folha adesiva, grade 3×8 |
| 2 × 4 pol | 50,8 × 101,6 | etiquetadora térmica |
| 4 × 4 pol | 101,6 × 101,6 | etiquetadora térmica |
| 4 × 6 pol | 101,6 × 152,4 | etiquetadora térmica |
| Personalizado | livre | — |

- Orientação retrato/paisagem = troca `w`/`h`.
- **Padrão do usuário**: botão "★ Definir como padrão" grava em
  `settings.defaultPage`; toda nova sessão abre nele.
- Em etiquetadora o normal é `cols=1, rows=1` — uma etiqueta por página.

### Recurso que vale muito em A4: **"iniciar na posição N"**

Permite reaproveitar uma folha adesiva já parcialmente usada: o usuário informa
quantas etiquetas já foram arrancadas e a primeira página pula essas células.
Barato de implementar, evita desperdício real de material.

---

## 7. Simbologias

**Biblioteca: `bwip-js`** (port do BWIPP, ~100 simbologias). Cobre **as 19
pedidas**, então nada precisa ficar cinza de verdade — mas o mecanismo
"em breve" fica implementado no `registry.ts` para qualquer coisa que falhe na
validação ou seja adicionada depois.

| Pedido | ID no bwip-js | Status |
|---|---|---|
| Code 128 | `code128` | ✅ **padrão** |
| Codabar | `rationalizedCodabar` | ✅ |
| Code 11 | `code11` | ✅ |
| Code 39 | `code39` | ✅ |
| Code 39 Extended | `code39ext` | ✅ |
| Code 93 | `code93` | ✅ |
| EAN-8 | `ean8` | ✅ |
| EAN-13 | `ean13` | ✅ |
| GS1-128 (EAN-128) | `gs1-128` | ✅ |
| Interleaved 2 of 5 | `interleaved2of5` | ✅ |
| ISBN-10 / ISBN-13 | `isbn` | ✅ |
| MSI Plessey | `msi` | ✅ |
| PostNet | `postnet` | ✅ |
| Standard 2 of 5 | `industrial2of5` | ✅ |
| UPC-A | `upca` | ✅ |
| UPC-E | `upce` | ✅ |
| UPC Extension 2 | `ean2` | ✅ |
| UPC Extension 5 | `ean5` | ✅ |
| QR Code | `qrcode` | ✅ |

### Integração vetorial (sem rasterização) — implementado

Melhor que o *drawing backend* previsto: o `bwip-js` expõe **`raw()`**, que
devolve o símbolo cru sem desenhar nada.

| Tipo | Retorno | Uso |
|---|---|---|
| Linear | `{ sbs, bbs, bhs }` | `sbs` alterna barra/espaço **começando por barra** (índices pares são barras); `bbs`/`bhs` dão base e altura de cada barra |
| Matriz | `{ pixs, pixx, pixy }` | bitmap de módulos, linha a linha |

Duas coisas que só apareceram ao sondar a saída real:

- **`bhs` não é constante.** No Code 128 vale 1 em todas as barras, mas no
  **PostNet vale 0,125 e 0,05** — barras altas e baixas. Ignorar `bhs` faria o
  PostNet sair como barras uniformes, isto é, ilegível. Normalizamos dividindo
  pela altura total para virar fração, e as barras assentam na **base**.
- **Os módulos escuros vizinhos do QR são fundidos** num retângulo só por linha.
  Reduz ~220 retângulos para ~110 num QR 21×21 e evita costuras claras entre
  módulos na impressão. Há teste que **remonta a matriz** a partir dos
  retângulos — comparar só a área total passaria com módulos fora de lugar.

### Import do bwip-js

O mapa `exports` do pacote não tem condição `default`, então o import genérico
**não resolve** sob `moduleResolution: bundler`. Use o subcaminho explícito:

```ts
import bwipjs from 'bwip-js/browser'
```

O pacote inteiro custa ~930 KB no bundle (327 KB comprimido). Irrelevante numa
extensão local: nada é baixado pela rede.

### Validação antes de exportar (`validate.ts`)

Simbologias numéricas rejeitam letras; EAN-13 exige 12–13 dígitos; UPC-A exige
11–12; dígito verificador calculado automaticamente. O erro aparece **na célula
da tabela de produtos**, não só no final — o usuário vê quais linhas vão falhar
antes de gerar 300 etiquetas.

Com `ID` como padrão (ex.: `16668223671`, 11 dígitos) o Code 128 aceita
tranquilamente. Se o usuário trocar para EAN-13, a validação avisa sobre as 10
linhas com `GTIN/EAN` vazio.

---

## 8. Sintaxe dos campos em chaves

```
{Descrição}                        valor cru
{Preço|moeda}                      R$ 119,90
{Estoque|numero:0}                 42
{Categoria do produto|ultimo}      Básico   (de "Filamentos>>PLA>>Básico")
{Descrição|maiuscula|corta:28}     FILAMENTO PLA MATTE VERDE ML…
{GTIN/EAN ?? Código ?? ID}         primeiro não-vazio  ← resolve o CSV real
Texto livre {Código} misturado     concatenação natural
```

**Formatadores**: `moeda`, `numero:N`, `maiuscula`, `minuscula`, `titulo`,
`corta:N`, `trim`, `ultimo`, `primeiro`, `data:formato`, `padleft:N:char`.

**Colunas virtuais**: `{_indice}` (nº da etiqueta), `{_linha}` (linha do CSV),
`{_data}`, `{_total}`.

A UI oferece **autocomplete** com os nomes de coluna lidos do próprio CSV — o
usuário nunca digita `{Descrição}` de memória e erra o acento.

---

## 9. Interface

Layout de três colunas, sem wizard (o usuário volta e ajusta o tempo todo):

```
┌──────────────┬───────────────────────────┬──────────────────┐
│  DADOS       │       PREVIEW             │  PROPRIEDADES    │
│              │                           │                  │
│ [Importar]   │   ┌───┬───┬───┐           │  Tipo    [▼]     │
│              │   │ ▣ │ ▣ │ ▣ │           │  Altura  [30]    │
│ Buscar…      │   ├───┼───┼───┤           │  Rotação [▼]     │
│ Filtro cat.  │   │ ▣ │ ▣ │ ▣ │           │  Tamanho [2]     │
│              │   └───┴───┴───┘           │  Fonte [▼][11]   │
│ ☑ 261 …      │                           │  Margem  [10]    │
│ ☑ 262 …   x2 │   ◀ pág 1/3 ▶             │  Cinza ──○── 0%  │
│ ☐ 263 …      │                           │                  │
│              │   [Etiqueta] [Folha]      │  ── Camadas ──   │
│ 8 de 12 · 14 │                           │  ▤ Descrição     │
│   etiquetas  │                           │  ▤ Preço         │
├──────────────┴───────────────────────────┤  ▮ Código 128    │
│ Página [2x4 ▼] ★  Col [3] Lin [2]        │                  │
│ Gap X [2] Y [2]  Margens [5][5][5][5]    │                  │
│ Etiqueta: 46,8 × 44,8 mm (calculado)     │                  │
├──────────────────────────────────────────┴──────────────────┤
│              [ Baixar PDF ]   [ Imprimir ]                  │
└─────────────────────────────────────────────────────────────┘
```

### Encaixe: como as guias decidem — implementado

Cada eixo testa **três referências do campo** — início, centro e fim — e fica
com a que grudar mais perto. Sem testar o centro, alinhar um campo ao meio da
etiqueta viraria trabalho manual de precisão.

Alvos: bordas e centro da etiqueta, mais bordas e centros dos outros campos.

**A grade só age quando nenhuma guia pegou.** Uma borda alinhada vale mais que
um múltiplo do passo — se a grade tivesse prioridade, encostar dois campos
ficaria impossível sempre que a borda não caísse num múltiplo exato.

### Armadilha do histórico durante o arraste

Um arraste dispara dezenas de atualizações por segundo. Registrar cada uma no
histórico faria `Ctrl+Z` desfazer **um pixel por vez** — inutilizável.

A regra: **um ponto de histórico por arraste**, marcado no `pointerdown`. A
função que move durante o arraste não registra nada. Custou um bug real —
o arraste funcionava mas era impossível desfazer, porque ninguém marcava o
início.

### `setPointerCapture` pode derrubar o arraste

A captura mantém os eventos chegando se o ponteiro sair do elemento, mas
**lança `NotFoundError`** quando o `pointerId` não está mais ativo. Sem
`try/catch`, a exceção escapa e o arraste morre antes de começar.

Como os ouvintes de `pointermove`/`pointerup` já estão no `window`, a captura
é otimização, não requisito — falhar nela deve ser silencioso.

### Canvas drag-and-drop

- Arrastar o campo; 8 alças de redimensionamento.
- **Snap** em grade configurável (padrão 1 mm) + snap nas bordas e no centro da
  etiqueta, com guias de alinhamento.
- Réguas em mm nas bordas.
- Setas movem 1 mm; `Shift`+setas movem 0,1 mm.
- `Ctrl+Z` / `Ctrl+Shift+Z` (undo/redo via Zustand middleware).
- Alternar entre **"Etiqueta"** (zoom em uma) e **"Folha"** (página inteira).
- Preview usa **dados reais do primeiro produto selecionado** — não lorem ipsum.
  É o que revela que a descrição de 49 caracteres não cabe.

### Painel de propriedades

Espelha o print fornecido (Tipo / Altura / Rotação / Tamanho / Fonte+tamanho /
Margem) e acrescenta o slider de cinza e o modo de overflow de texto.

### Fontes

Restringir às fontes com métricas embutidas no jsPDF — **Helvetica, Times,
Courier** — mais um seletor de fontes do sistema **apenas para o modo Imprimir**.
Motivo: qualquer outra fonte exigiria embutir o arquivo `.ttf` no PDF. Se
Arial for obrigatório no PDF, é preciso embutir a fonte (Helvetica é
metricamente equivalente e resolve na prática).

---

## 10. Persistência (`chrome.storage.local`)

```ts
{
  settings: {
    defaultPagePreset: '2x4',
    units: 'mm',
    snapMm: 1,
    scaleFontsWithLabel: true,
    lastTemplateId: string
  },
  templates: LabelTemplate[],       // salvos pelo usuário, com nome
  lastSession: {
    selectedIds: string[],
    quantities: Record<string, number>
  }
}
```

- **Não** guardar o CSV inteiro no `chrome.storage` (limite de 10 MB e é lento).
  Se houver necessidade de reabrir o último arquivo, usar **IndexedDB**.
- Permissão `unlimitedStorage` no manifest previne dor de cabeça futura.
- **Exportar/Importar template como `.json`** — essencial para o usuário levar o
  layout para outra máquina ou compartilhar com a equipe. Baixo custo, alto valor.

---

## 10-B. O que a Fase 6 decidiu

- **Último usado = padrão.** O plano previa um botão "★ Definir como padrão";
  com a persistência de tudo, ele virou redundância — a próxima sessão abre
  exatamente como a anterior terminou. Menos um conceito na UI.
- **Backend duplo**: `chrome.storage.local` na extensão, `localStorage` no dev
  server. Sem o fallback, o fluxo de desenvolvimento divergiria do real.
- **Gravação com debounce de 400 ms** — um arraste dispara dezenas de mudanças
  por segundo e cada `set` do storage tem custo.
- **Tudo que entra é validado** (`serializar.ts`): o formato do modelo já mudou
  dentro do próprio desenvolvimento (fonte em pt → fração). Números viram
  coagidos, tipos desconhecidos caem em padrão com aviso, ids duplicados são
  renumerados, strings são truncadas. `lerModelo` nunca deixa passar `NaN`.
- **Estado corrompido não impede o app de abrir** — cai nos padrões e a
  primeira interação regrava por cima. Verificado com lixo literal no storage.

> Armadilha de teste: o debounce pode **regravar estado válido por cima da
> corrupção** antes de um reload, invalidando o teste sem que se perceba. A
> prova válida exige conferir que o lixo ainda estava lá no momento da carga.

## 10-C. Guia de corte (Fase 7)

O papel é adesivo e o corte é manual, então o guia precisa servir a uma régua.

**Os riscos caem no meio do corredor entre etiquetas**, não nas duas bordas.
Assim é *um* corte por corredor, e cada etiqueta fica com metade do espaço como
sangria. Cortar nas duas bordas exigiria dois cortes e descartar uma tira.

Com espaço 0 o meio **coincide** com a borda compartilhada — o mesmo cálculo
serve para grades coladas, sem caso especial.

**Riscos atravessando a folha inteira são seguros**: como caem nos corredores e
nas bordas do bloco, nenhum cruza uma etiqueta. Há teste que percorre todas as
colunas e exige zero interseções.

Modo `marcas` existe para quem não quer linha nenhuma na área impressa: só ticks
nas quatro bordas do papel, para alinhar a régua.

### Borda por etiqueta

Mora no `Modelo`, não como campo `caixa` — pedir ao usuário que crie um campo
cobrindo a etiqueta inteira seria obscuro. Ela é desenhada **antes** dos campos,
para nunca cobrir um código de barras, e **recuada meia espessura**: o traço é
centrado na linha, e sem o recuo metade dele cairia fora da etiqueta, invadindo
a vizinha.

## 10-D. Fluxo em passos (Fase 7)

Quatro etapas recolhíveis: importar → escolher produtos → desenhar → página e
acabamento. O passo concluído vira uma barra fina com o **resumo do que foi
decidido** (`produtos.csv · 12 produtos`, `11 de 12 · 84 etiquetas`), e continua
a um clique.

A importação **se recolhe sozinha** ao dar certo — é o passo que menos se
revisita. Trocar de arquivo reabre.

Ícones são SVG inline desenhados à mão (`Icone.tsx`): a CSP da MV3 proíbe
recurso externo, e um pacote de ícones inteiro por meia dúzia de glifos não
pagaria o peso.

## 11. Manifest MV3 e pontos de atenção

```json
{
  "manifest_version": 3,
  "name": "Modulab Helper",
  "version": "0.1.0",
  "description": "Gera folhas de etiquetas com código de barras a partir do CSV do Bling.",
  "action": { "default_title": "Abrir Modulab Helper" },
  "background": { "service_worker": "service-worker.js", "type": "module" },
  "permissions": ["storage", "unlimitedStorage"],
  "icons": { "16": "...", "48": "...", "128": "..." }
}
```

**Armadilhas de MV3 que vão custar tempo se ignoradas:**

1. **Sem `default_popup`.** Se existir um popup declarado,
   `chrome.action.onClicked` **nunca dispara** e a aba não abre.
2. **CSP proíbe `eval`.** O dev server padrão do Vite usa `eval` no HMR e a
   extensão quebra. Por isso `@crxjs/vite-plugin` — ele contorna isso.
3. **Sem código remoto.** `bwip-js`, `jsPDF` e fontes precisam estar no bundle,
   nunca via CDN. (Bom colateral: a extensão funciona 100% offline e nenhum dado
   de produto sai da máquina.)
4. **Service worker é efêmero.** Nenhum estado mora nele — ele só faz
   `tabs.create`. Toda a lógica vive na aba.
5. Nenhuma permissão de host é necessária: o CSV vem de um `<input type=file>`
   local. Isso mantém a revisão da Web Store trivial.

---

## 11-B. O que a Fase 5 verificou no PDF gerado

Não bastou conferir o tamanho da página: os content streams foram
descomprimidos e os operadores, inspecionados.

| Arquivo | Páginas | Retângulos | Textos | MediaBox |
|---|---|---|---|---|
| A4 3×8, Code 128 | 4 | 1596 | 252 | 210 × 297 mm |
| A4 3×8, QR Code | 4 | 9486 | 252 | 210 × 297 mm |
| 2 × 4 pol, 1×1 | 84 | 1596 | 252 | 50,8 × 101,6 mm |

- **Uma única MediaBox distinta por arquivo** — nenhuma página fora de medida.
- O texto sai **extraível e com acento**: `FILAMENTO PLA PRETO`, `R$ 119,90`.
- Fontes são as **base-14 do PDF**, referenciadas e não embutidas — é o que
  mantém 84 etiquetas em ~17 KB.
- Retângulos da 1ª página dentro dos limites: x de 8,27 a 200 mm numa A4 com
  margem de 5 mm.

Geração: 15–46 ms para as 84 etiquetas, conforme a simbologia.

### Uma implementação de SVG, não duas

A prévia em React **delega a `opsParaSvg`** via `dangerouslySetInnerHTML`, em
vez de montar elementos React equivalentes. Duas implementações — uma para a
tela, outra para a impressão — divergiriam, e o usuário veria uma coisa e
imprimiria outra. Com uma só, um defeito aparece nos dois lugares ao mesmo
tempo.

### Métricas locais × jsPDF

O ajuste `encolher` mede com a tabela AFM local; o PDF desenha com a do jsPDF.
Se divergirem, o texto que "cabia" na prévia vaza no papel. Há teste
confrontando as duas em amostras reais: **diferença abaixo de 2%**, e a tabela
local **nunca subestima** — subestimar é o erro perigoso, porque faria o
`encolher` achar que cabe.

## 12. Impressão HTML (o segundo caminho)

O botão `Imprimir` gera o mesmo `DrawOp[]`, renderiza em SVG e aplica:

```css
@page { size: 50.8mm 101.6mm; margin: 0; }
@media print { .etiqueta { break-inside: avoid; } }
```

Aviso a exibir na UI: no diálogo do navegador o usuário **precisa** marcar
*Margens: Nenhuma* e *Escala: 100%* / desmarcar "Ajustar à página", senão o
resultado sai reduzido. É justamente essa fragilidade que torna o **PDF o
caminho recomendado** — e a UI deve dizer isso ao lado do botão.

---

## 13. Fases de entrega

| Fase | Entrega | Resultado verificável |
|---|---|---|
| **0** | Scaffold Vite+React+TS+CRXJS, manifest, service worker | Clicar no ícone abre a aba |
| **1** | `core/csv` completo + tabela de produtos | 12 produtos listados, `Código` sem o tab |
| **2** | Modelo de template, grade dinâmica, preview SVG | Mexer em col/lin redimensiona ao vivo |
| **3** | `bwip-js` → `DrawOp[]`, Code 128 + QR | Código de barras legível no preview |
| **4** | Canvas drag-and-drop + inspetor de propriedades | Arrastar e redimensionar campos |
| **5** | Backend jsPDF + botão Imprimir | PDF baixado mede exatamente 50,8 × 101,6 mm |
| **6** | `chrome.storage`, templates salvos, export/import JSON | Fechar e reabrir mantém tudo |
| **7** | Restante das 19 simbologias, validação, cinza, "iniciar na posição", undo/redo | — |

**Marco de validação real:** ao fim da Fase 5, imprimir uma folha e **ler as
etiquetas com um leitor de código de barras físico**. Largura de módulo e quiet
zone são exatamente onde etiquetas bonitas na tela falham no scanner — descobrir
isso na Fase 5 é barato; na Fase 7, caro.

---

## 14. Dependências

| Pacote | Para quê | Peso |
|---|---|---|
| `react`, `react-dom` | UI | — |
| `@crxjs/vite-plugin` | build MV3 + HMR | dev |
| `bwip-js` | 19 simbologias | ~400 KB gz (irrelevante offline) |
| `jspdf` | PDF vetorial em mm | ~350 KB |
| `zustand` | estado + undo/redo | ~3 KB |
| `vitest` | testes de `core/` | dev |

Parser de CSV: **escrito à mão** em `core/csv/`. O formato do Bling é conhecido e
as regras de limpeza (tabs, BOM, decimal BR, `>>`) são específicas demais — uma
lib genérica como PapaParse seria envolvida em tanta pós-limpeza que não
compensa a dependência.

---

## 15. Testes que importam

Em `core/` (puro, sem navegador, via Vitest):

- Parse do CSV real → 12 linhas, `Código` = `"261"` sem tab, `GTIN/EAN` vazio em 10.
- `resolve('{GTIN/EAN ?? Código}')` cai no fallback nas linhas certas.
- `grid.ts`: A4 3×8 com gap 2 e margem 5 → soma das etiquetas + gaps + margens
  **fecha exatamente** 210 × 297.
- Dígito verificador de EAN-13 e UPC-A contra vetores conhecidos.
- `toDrawOps` produz o mesmo resultado alimentando backend SVG e PDF.

---

## 16. Riscos

| Risco | Mitigação |
|---|---|
| Módulo estreito demais → scanner não lê | Piso rígido de 0,25 mm com bloqueio de exportação |
| Descrições longas (49 chars) estourando a etiqueta | Modo `shrink`/`ellipsis` por campo + preview com dado real |
| Usuário troca a grade e perde o layout | Coordenadas em fração (§5) |
| Fonte Arial no PDF | Helvetica como equivalente métrico; embutir TTF só se exigido |
| Navegador reescalando na impressão | PDF como caminho recomendado, com aviso na UI |
| Bling mudar as colunas do export | Mapeamento por nome com autocomplete; nenhum índice de coluna fixo no código |
