# Modulab Helper

Extensão Chromium (Chrome / Edge) que transforma o CSV de produtos exportado do
Bling em folhas de etiquetas com código de barras e QR Code, prontas para
impressão em etiquetadora.

O plano completo de arquitetura está em [PLANO.md](PLANO.md).

## Estado atual

**Fase 5 de 7 — PDF e impressão.** O ciclo está fechado: dá para importar o
CSV, montar a etiqueta e sair com o PDF pronto.

- ✅ Fase 0 — scaffold: clicar no ícone abre a aba do app.
- ✅ Fase 1 — leitura do CSV do Bling e tabela de seleção de produtos.
- ✅ Fase 2 — página, grade colunas × linhas e prévia da folha em SVG.
- ✅ Fase 3 — as 19 simbologias desenhadas em vetor, com aviso de ilegibilidade.
- ✅ Fase 4 — campos arrastáveis com guias de encaixe, réguas e undo/redo.
- ✅ Fase 5 — PDF vetorial nas medidas exatas e impressão direta.
- ✅ Fase 6 — escolhas e modelos persistidos; exportar/importar `.json`.
- ✅ Fase 7 — fluxo em passos, borda por etiqueta e guia de corte.

### Guia de corte

Para papel adesivo cortado a mão, em três modos:

| Modo | O que desenha |
|---|---|
| **Sem guia** | Só as etiquetas |
| **Linhas** | Riscos atravessando a folha — corte de uma passada com régua |
| **Marcas** | Só ticks nas bordas do papel, sem riscar a área impressa |

Os riscos caem no **meio do espaço entre etiquetas**, nunca em cima delas: é um
corte por corredor, e cada etiqueta fica com metade do espaço como sangria. Com
espaço 0 o meio coincide com a borda compartilhada, então o mesmo cálculo serve
para grades coladas. A espessura e o tom de cinza são ajustáveis — um cinza
claro ainda se enxerga para cortar e some no resultado.

A **borda por etiqueta** é independente do guia de corte e pode ser ligada junto.

### O que fica guardado

Página, grade, fonte do código, filtros, o desenho atual da etiqueta e os
modelos salvos com nome — tudo volta ao reabrir a aba. Na extensão isso vive no
`chrome.storage.local`; no dev server, no `localStorage`. **O CSV nunca é
gravado**: reimportá-lo é um clique e ele muda a cada export do Bling.

O papel usado por último **é** o padrão da próxima sessão — não há botão
separado de "definir como padrão".

Modelos podem ser baixados como `.json` e importados em outra máquina. O
arquivo é validado campo a campo: números fora de faixa são coagidos,
simbologia desconhecida cai para Code 128 com aviso, fonte no formato antigo
(pt) volta ao padrão com aviso, e JSON inválido não derruba nada.

### PDF ou Imprimir?

**Prefira o PDF.** Ele sai nas medidas exatas — verificado: 2 × 4 pol gera um
PDF de 50,8 × 101,6 mm, A4 gera 210 × 297 mm. Tudo vetorial, então 84 etiquetas
com código de barras cabem em ~17 KB e ficam nítidas em qualquer DPI.

O botão **Imprimir** existe para o fluxo rápido, mas o navegador ainda pode
reescalar: marque *Margens: nenhuma* e *Escala: 100%* no diálogo.

**Nada é medido em pontos.** O tamanho da fonte é uma **% da altura da
etiqueta** — 10% numa etiqueta de 34,6 mm dá 3,46 mm de letra. Mudar a etiqueta
de tamanho mantém tudo na mesma proporção, sem reescalar nada. Há atalhos de
fração (1/20 a 1/4) e o mm resultante aparece ao lado da %.

### Atalhos do editor

| Tecla | Ação |
|---|---|
| Setas | Move 1 mm |
| Shift + setas | Move 0,1 mm |
| Ctrl+Z / Ctrl+Shift+Z | Desfazer / refazer |
| Ctrl+D | Duplicar campo |
| Delete | Remover campo |

O que já funciona: arrastar o CSV, ver os produtos limpos (sem os tabs que o
Bling cola nos valores), buscar em qualquer coluna — inclusive as que não
aparecem na tabela —, filtrar por categoria e situação, escolher quais produtos
entram e quantas etiquetas de cada um.

**Uma etiqueta por unidade em estoque** é o padrão: o código 261 com 42 rolos
rende 42 etiquetas, e o campo `Qtd.` multiplica isso (2 → 84). Dá para desligar
no botão *Multiplicar pelo estoque*. Produtos com estoque zerado começam
desmarcados. As regras de borda estão em [PLANO.md](PLANO.md#quantas-etiquetas-cada-produto-rende).

**O tamanho da etiqueta é sempre calculado**, nunca digitado: escolha o papel e
quantas colunas × linhas cabem nele, e a etiqueta se redimensiona. Uma A4 em
3 × 8 com margem 5 mm e espaço 2 mm dá etiquetas de 65,3 × 34,1 mm, 24 por
folha. Ainda **não há persistência** — a opção de gravar um papel como padrão
chega na Fase 6.

## Requisitos

Node 20+ (testado com Node 24 / npm 11).

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

O `@crxjs/vite-plugin` escreve e observa a pasta `dist/` com HMR. Carregue essa
pasta no navegador (ver abaixo) e as alterações recarregam sozinhas.

## Build de produção

```bash
npm run build
```

## Carregar no navegador

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ative **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação**.
4. Selecione a pasta **`dist/`** — não a raiz do projeto.
5. Clique no ícone da extensão na barra de ferramentas: o app abre em uma aba nova.

Clicar no ícone de novo com a aba já aberta apenas foca a aba existente, em vez
de abrir duplicatas.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Dev server + build incremental em `dist/` com HMR |
| `npm run build` | Checagem de tipos e build de produção |
| `npm run typecheck` | Só a checagem de tipos |
| `npm test` | Testes unitários de `src/core/` (Vitest) |
| `node scripts/gerar-icones.mjs` | Regera os PNGs dos ícones (sem dependências) |

## Estrutura

```
src/
├── background/   service worker — só abre a aba
├── core/         lógica pura, sem DOM, testável
│   └── csv/      detecção de encoding/delimitador, parser, limpeza
├── app/          a aba: React + editor de etiquetas
│   ├── store.ts  estado (zustand)
│   └── components/
└── assets/icons/ ícones gerados por script
```

Regra que sustenta a testabilidade: **nada em `core/` importa React ou toca no
DOM**. É o que permite testar a geração do PDF sem abrir um navegador.

## Privacidade

A extensão não pede permissões de host e não faz nenhuma requisição de rede.
O CSV é lido por um `<input type="file">` local e nenhum dado de produto sai
da máquina.
