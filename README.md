# Modulab Helper

Extensão Chromium (Chrome / Edge) que trabalha em cima do CSV de produtos
exportado do Bling, em duas abas:

- **Etiquetas** — folhas de etiquetas com código de barras e QR Code, prontas
  para impressão em etiquetadora.
- **Estante** — o mapa da prateleira de filamentos e a conferência do que falta
  repor.

As duas compartilham o mesmo CSV importado, e nada além dele.

## Instalação

### Opção 1 — baixar pronto (recomendado para quem só quer usar)

Não precisa instalar Node nem rodar nenhum comando.

1. Baixe `modulab-helper-dist.zip` na [última release](https://github.com/leobarrosc/modulab-helper/releases/latest).
2. Descompacte o zip — vira uma pasta com `manifest.json` dentro.
3. Abra `chrome://extensions` (ou `edge://extensions`).
4. Ative **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta descompactada.
6. Clique no ícone da extensão na barra de ferramentas: o app abre em uma aba nova.

Clicar no ícone de novo com a aba já aberta apenas foca a aba existente, em vez
de abrir duplicatas.

### Opção 2 — build a partir do código-fonte

Para quem vai mexer no código. Requer Node 20+ (desenvolvimento e CI rodam em
Node 24 / npm 11).

```bash
npm install
npm run carregar
```

Isso gera a pasta `dist/` e, na primeira vez, já abre o Explorador nela e o
`edge://extensions` — falta só ativar o Modo do desenvolvedor e clicar em
*Carregar sem compactação*. (`npm run build` sozinho também serve; aí carregue
`dist/` seguindo os passos 3–6 da Opção 1.)

## A estante

A prateleira fica à vista do cliente e, conforme vendem, é preciso repor. O
problema nunca foi ter estoque — era **saber qual filamento sumiu da
prateleira** olhando para setenta caixas parecidas.

O módulo monta um mapa determinístico da estante a partir do CSV, deixa conferir
célula a célula na tela enquanto se caminha na frente dela, e no fim entrega a
lista do que pegar no depósito.

### Como o mapa é montado

Cada célula recebe um produto, ordenado por **Marca › Tipo › Cor**, preenchendo
da esquerda para a direita e de cima para baixo. **Marca nova sempre começa um
andar novo**, mesmo sobrando coluna: é assim que a prateleira se lê de longe —
um andar, uma marca.

A **ordem das marcas** e a **ordem dos tipos** são suas: arraste para reordenar,
ou use os botões de subir e descer. Como marca nova sempre quebra andar, a ordem
das marcas é o que decide qual delas fica na altura dos olhos. Um nome que
apareça num export futuro entra no fim da lista, sem reorganizar a prateleira
sozinho.

Grafias diferentes da mesma marca são tratadas como uma só: o Bling aceita
`MultFila` e `MULTFILA` no mesmo cadastro, e os dois vão para o mesmo andar.

A **ordem das cores** não é alfabética. Preto e Branco vêm primeiro, por serem
os mais procurados; depois as cores seguem a ordem do arco-íris (vermelho →
laranja → amarelo → verde → azul → violeta → rosa), calculada pelo ângulo de
matiz. Multicolor e efeitos — marmorizado, rainbow, tricolor — não têm matiz
única e fecham a fila. Cada célula mostra uma **bolinha da cor**: na frente da
estante se procura a cor, não o texto.

### Tipo e cor são deduzidos — e dá para corrigir

O Bling não tem campo de "tipo de filamento" nem de "cor". O tipo sai dos níveis
2 e 3 da categoria (`Filamentos>>PLA>>Matte/Fosco` → *PLA Matte/Fosco*) e a cor
é o que sobra da descrição depois de tirar o ruído.

Ruído é bastante coisa: cada marca cerca o nome da cor com a linha comercial
(`Basic`, `Premium Ht High Speed`, `Lite`, `Hyper`, `HF`) e com a embalagem
(`Peso:1KG`, `ROLO`, `1.75MM`, `DER 4`, `REFIL`). `Pla Basic Amarelo Peso:1KG`
vira **Amarelo**; `MP-FILAMENTO 3D - PETG VERDE 1KG (1.75MM) DER 4` vira
**Verde**. Uma palavra que também é nome de cor nunca é descartada, e dá para
acrescentar as suas palavras a ignorar.

Filamentos que **mudam de cor ao longo do rolo** — rainbow, dual color,
tricolor, marmorizado — não têm uma matiz que os represente. Eles são
reconhecidos como tal e ficam juntos no fim, em vez de serem arquivados sob a
primeira cor que aparece no nome.

A categoria do Bling responde a uma pergunta comercial: `PLA Especiais` junta
marmorizado e madeira porque vendem parecido, não porque moram lado a lado. Por
isso há uma tabela para reescrever marca, tipo e cor à mão — **a correção fica
salva pelo código do produto** e sobrevive ao próximo export. Apagar o campo
volta ao valor deduzido.

### Várias estantes

Cada estante tem as suas medidas, a sua categoria e **as suas marcas**: dá para
deixar MultFila e Creality numa e o resto noutra. Nenhuma marca escolhida
significa "todas entram". A troca entre estantes fica no topo da aba, a um
clique.

Andares podem ser **tirados de uso** — a prateleira que você não alcança, a de
baixo que é só caixa fechada. Elas continuam desenhadas no mapa, hachuradas, e
a alocação simplesmente pula por cima.

E cada andar pode ter **conteúdo reservado**: *"o andar 1 só vai ter PLA preto,
branco e matte"*. A reserva vale nos dois sentidos — o andar só recebe o que
você marcou, e o que você marcou não aparece em nenhum outro andar. Marcar só as
cores limita a cor e aceita qualquer marca e tipo.

Marca, tipo e cor se combinam com **e**, o que sozinho não daria conta de
*"andar 1 = só PLA preto, mas qualquer PLA Matte"*: marcar Preto limitaria o
Matte a preto também. Para isso existe **Cores por tipo**, logo abaixo das
cores: marque o tipo que precisa de regra própria e escolha as cores dele. Um
tipo com cores próprias ignora as cores gerais; um tipo sem exceção continua
seguindo elas. Marcar o tipo e não escolher cor nenhuma significa *"qualquer cor
deste tipo"* — que é a outra forma de escrever a mesma regra.

### Frente maior para quem vende mais

O PLA Preto não precisa dividir a prateleira em pé de igualdade com uma cor que
sai uma vez por mês. Os botões **−** e **+** no canto de cada célula esticam o
produto por várias colunas: o Preto em 1.1, 1.2 e 1.3 vira um bloco só.

**A estante é fixa.** Toda célula nasce com uma coluna e só muda quando você
clica — nada se reorganiza sozinho a cada export.

O **+** só libera enquanto sobrar rolo fora do que a largura atual comporta. Com
3 rolos e 2 por célula ele vai até 2 colunas: a primeira leva dois rolos, a
segunda leva o terceiro. Com 1 rolo o botão já nasce desabilitado, e diz por
quê — não faz sentido reservar meia prateleira para um filamento que existe uma
vez. Quando o estoque cai *depois* de você ter alargado, a célula não encolhe
sozinha (a estante é fixa): aparece um aviso na célula, e a decisão de diminuir
é sua.

A conferência acompanha: um bloco de 3 colunas com 2 rolos em fila tem 6
caixinhas, não 2. E o bloco nunca é partido entre dois andares — se não cabe no
que sobrou, desce inteiro.

A **ordem das cores** também é arrastável, e vale para a estante inteira. Se um
tipo específico pedir outra sequência, dá para criar uma exceção só para aquele
par marca + tipo.

### A conferência

Cada célula cabe **dois rolos do mesmo produto**: o da frente é o mostruário, o
de trás é a reposição imediata. São duas caixas de seleção por célula, então dá
para registrar "só sobrou um" — e a lista de reposição já sabe que falta um.

**As caixinhas nunca passam do que existe no depósito.** Um produto com 3 rolos
numa célula de 2 colunas mostra 3 caixinhas, não 4: a quarta seria uma posição
que ninguém consegue preencher, e entraria na lista de reposição como um rolo a
buscar num depósito que não tem. Com um rolo só, aparece uma caixinha —
marcada **F**, porque o lugar dele é a frente.

A conferência fica guardada e sobrevive a fechar a aba. *Nova conferência* zera
tudo e carimba a data. Produto **sem estoque no depósito sai da estante** e os
seguintes sobem uma posição.

No fim, a lista de reposição sai na ordem de leitura da estante — que é a ordem
em que se caminha na frente dela — com posição, código, tipo, cor, quantos
faltam e quantos há no depósito. Dá para imprimir e levar junto.

## Estado atual

**As duas abas estão completas e em uso.** O ciclo das etiquetas fecha do CSV
ao PDF, e o da estante vai do CSV ao mapa e à lista de reposição impressa.

Etiquetas, as sete fases do plano original:

- ✅ Fase 0 — scaffold: clicar no ícone abre a aba do app.
- ✅ Fase 1 — leitura do CSV do Bling e tabela de seleção de produtos.
- ✅ Fase 2 — página, grade colunas × linhas e prévia da folha em SVG.
- ✅ Fase 3 — as 19 simbologias desenhadas em vetor, com aviso de ilegibilidade.
- ✅ Fase 4 — campos arrastáveis com guias de encaixe, réguas e undo/redo.
- ✅ Fase 5 — PDF vetorial nas medidas exatas e impressão direta.
- ✅ Fase 6 — escolhas e modelos persistidos; exportar/importar `.json`.
- ✅ Fase 7 — fluxo em passos, borda por etiqueta e guia de corte.

Estante, a segunda missão, numa aba própria:

- ✅ Classificação Marca › Tipo › Cor deduzida do CSV, com correção manual.
- ✅ Ordem das marcas, dos tipos e das cores, arrastáveis e persistidas.
- ✅ Várias estantes, marcas por estante, andares fora de uso e reservados.
- ✅ Andar reservado com **exceção de cor por tipo** — *"só PLA preto, mas
  qualquer PLA Matte"*.
- ✅ Largura de célula por produto, limitada pelo estoque real, e aviso quando
  o estoque cai depois.
- ✅ Conferência de dois rolos por célula, nunca pedindo mais do que há no
  depósito, e lista de reposição na ordem de leitura da prateleira.

A suíte cobre a lógica pura: **455 testes em 18 arquivos**, todos verdes.

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
desmarcados.

**O tamanho da etiqueta é sempre calculado**, nunca digitado: escolha o papel e
quantas colunas × linhas cabem nele, e a etiqueta se redimensiona. Uma A4 em
3 × 8 com margem 5 mm e espaço 2 mm dá etiquetas de 65,3 × 34,1 mm, 24 por
folha.

## Desenvolvimento

```bash
npm run dev
```

O `@crxjs/vite-plugin` escreve e observa a pasta `dist/` com HMR. Carregue essa
pasta no navegador (ver Opção 1 acima) e as alterações recarregam sozinhas.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Dev server + build incremental em `dist/` com HMR |
| `npm run build` | Checagem de tipos e build de produção |
| `npm run typecheck` | Só a checagem de tipos |
| `npm test` | Testes unitários de `src/core/` (Vitest) |
| `npm run carregar` | Build limpo em `dist/` pronto para o navegador (ver abaixo) |
| `node scripts/gerar-icones.mjs` | Regera os PNGs dos ícones (sem dependências) |

O `npm run carregar` existe porque `npm run dev` e `npm run build` escrevem no
**mesmo** `dist/`, e um `dist/` deixado pelo `dev` não carrega como extensão —
o MV3 proíbe o script remoto que o HMR usa. Ele apaga o `dist/` antes de buildar
e, na primeira vez, abre o Explorador na pasta certa e o `edge://extensions`.
Nos builds seguintes não abre nada: o navegador lê o `dist/` do disco, então
basta clicar no ícone de recarregar no card da extensão. Se você remover a
extensão e precisar do passo a passo de novo, rode
`npm run carregar -- --abrir`.

## Estrutura

```
src/
├── background/     service worker — só abre a aba
├── core/           lógica pura, sem DOM, testável
│   ├── csv/        detecção de encoding/delimitador, parser, limpeza
│   ├── etiqueta/   modelo da etiqueta, resolução de campos, métricas
│   ├── layout/     página, grade colunas × linhas, guia de corte
│   ├── render/     DrawOp[] → SVG e PDF (um cálculo, dois backends)
│   ├── simbologia/ as 19 simbologias sobre bwip-js, em vetor
│   └── estante/    classificação, ordem das cores, alocação, conferência
├── app/            a aba: React + editor de etiquetas + mapa da estante
│   ├── store.ts    estado (zustand)
│   └── components/ AbaEtiquetas / AbaEstante e o resto da UI
└── assets/icons/   ícones gerados por script
```

Duas regras sustentam a testabilidade e o resto da arquitetura:

- **Nada em `core/` importa React ou toca no DOM.** É o que permite testar a
  geração do PDF sem abrir um navegador.
- **Prévia, impressão e PDF partilham um cálculo só.** Ele produz uma lista de
  `DrawOp` em milímetros, e os dois backends apenas desenham — é o que garante
  que o PDF saia igual ao que estava na tela.

## Publicar uma versão

O zip da Release é gerado pelo GitHub Actions
([.github/workflows/release.yml](.github/workflows/release.yml)): ele roda os
testes, faz o build limpo e anexa `modulab-helper-dist.zip` à Release.

O gatilho é uma tag `v*`. Para publicar:

```bash
npm version patch      # ou minor / major — atualiza package.json
git push --follow-tags
```

A versão do `package.json` é a que vai para o `manifest.json` da extensão, então
a tag e a versão que o navegador mostra andam sempre juntas.

## Privacidade

A extensão não pede permissões de host e não faz nenhuma requisição de rede.
O CSV é lido por um `<input type="file">` local e nenhum dado de produto sai
da máquina.

A extração de cor e a classificação são offline e determinísticas — foi uma
decisão, não uma limitação. Mandar descrição de produto para uma IA custaria
permissão de host no manifest e um resultado que muda sozinho entre execuções
sem o CSV ter mudado.

O mesmo vale para o repositório: o único CSV versionado é
`produtos_2026-07-20-10-29-43.csv`, um export real usado como fixture dos
testes, **com as colunas comerciais zeradas** (`Preço de custo`, `Fornecedor`,
`Cód. no fornecedor`, `Descrição do Produto no Fornecedor` e `Preço de Compra`).
Qualquer outro `produtos_*.csv` na raiz é ignorado pelo git, porque um export
cru do Bling traz fornecedor e margem.
