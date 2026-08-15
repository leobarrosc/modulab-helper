/**
 * Onde cada produto mora na estante.
 *
 * O plano e SEMPRE recalculado do zero a partir da lista de elegiveis do
 * momento -- nada de posicao gravada. E isso que faz "o estoque zerou, o
 * produto sai da estante e os de tras sobem uma posicao" funcionar sem uma
 * linha de codigo dedicada.
 */
import { CHAVE_DESCONHECIDA, compararTextoCor, identificarCor } from './cores'
import { normalizarTexto } from './texto'
import { compararPorOrdem } from './ordemManual'
import { andaresUteis, regraDoAndar, regraVazia } from './template'
import type {
  Celula,
  ItemNaoAlocado,
  PlanoAlocacao,
  ProdutoEstante,
  RegraAndar,
  TemplateEstante,
} from './tipos'

const COLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/**
 * A sequencia em que os produtos entram na estante: Marca > Tipo > Cor.
 *
 * Marca e tipo seguem a ordem que o usuario arrastou; a cor segue o matiz. So
 * ordena, nao aloca.
 *
 * O desempate final pelo codigo mantem a ordem estavel entre dois produtos
 * identicos nos tres eixos, senao o mapa mudaria de lugar sozinho a cada
 * reimportacao.
 */
/**
 * A chave de um grupo marca+tipo, que e o trecho contiguo da prateleira onde
 * uma excecao de ordem de cor faz sentido.
 *
 * Amarrada a marca e ao tipo, e nao ao numero do andar: o andar em que um
 * produto cai depende de quantos vieram antes, entao um SKU esgotado deslocaria
 * a excecao para outro conjunto de produtos.
 */
export function chaveGrupo(marca: string, tipo: string): string {
  return `${normalizarTexto(marca)}||${normalizarTexto(tipo)}`
}

export interface OpcoesOrdenacao {
  ordemTipos?: string[]
  ordemMarcas?: string[]
  /** Ordem de cores da estante inteira. Vazia = por matiz. */
  ordemCores?: string[]
  /** Excecoes por `chaveGrupo(marca, tipo)`. */
  ordemCoresPorGrupo?: Record<string, string[]>
}

export function ordenarParaAlocacao(
  produtos: ProdutoEstante[],
  opcoes: OpcoesOrdenacao = {},
): ProdutoEstante[] {
  const { ordemTipos = [], ordemMarcas = [], ordemCores = [], ordemCoresPorGrupo = {} } = opcoes

  const porMarca = compararPorOrdem(ordemMarcas)
  const porTipo = compararPorOrdem(ordemTipos)

  const ordemDoGrupo = (p: ProdutoEstante): string[] =>
    ordemCoresPorGrupo[chaveGrupo(p.classificacao.marca, p.classificacao.tipo)] ?? ordemCores

  return [...produtos].sort((a, b) => {
    const marca = porMarca(a.classificacao.marca, b.classificacao.marca)
    if (marca !== 0) return marca

    const tipo = porTipo(a.classificacao.tipo, b.classificacao.tipo)
    if (tipo !== 0) return tipo

    // Chegando aqui, a e b sao do mesmo grupo: a excecao de um vale para os dois.
    const cor = compararTextoCor(a.classificacao.cor, b.classificacao.cor, ordemDoGrupo(a))
    if (cor !== 0) return cor

    return COLATOR.compare(a.codigo, b.codigo)
  })
}

/**
 * `true` se o produto atende a regra do andar.
 *
 * Eixo com lista vazia aceita qualquer coisa; os eixos preenchidos sao um E.
 * A cor e comparada pela CHAVE da cor base, e nao pelo texto: uma regra de
 * `PRETO` pega tambem "PRETO FOSCO" e "Preto Fume Translucido".
 */
export function produtoAtendeRegra(produto: ProdutoEstante, regra: RegraAndar): boolean {
  const { marca, tipo, cor } = produto.classificacao

  if (regra.marcas.length > 0 && !contem(regra.marcas, marca)) return false
  if (regra.tipos.length > 0 && !contem(regra.tipos, tipo)) return false

  if (regra.cores.length > 0) {
    const chave = identificarCor(cor).base?.chave ?? CHAVE_DESCONHECIDA
    if (!regra.cores.includes(chave)) return false
  }

  return true
}

const contem = (lista: string[], valor: string): boolean => {
  const alvo = normalizarTexto(valor)
  return lista.some((item) => normalizarTexto(item) === alvo)
}

/** Largura do produto em colunas, limitada ao que a estante comporta. */
function larguraDe(
  codigo: string,
  larguras: Record<string, number>,
  colunas: number,
): number {
  const pedida = Math.trunc(larguras[codigo] ?? 1)
  if (!Number.isFinite(pedida) || pedida < 1) return 1
  return Math.min(pedida, Math.max(1, colunas))
}

interface Bloco {
  codigo: string
  classificacao: ProdutoEstante['classificacao']
  largura: number
}

/** Os blocos de um andar mais as celulas vazias que sobram, em ordem de leitura. */
function celulasDoAndar(
  andar: number,
  colunas: number,
  blocos: Bloco[],
  bloqueada: boolean,
): Celula[] {
  const celulas: Celula[] = []
  let coluna = 1

  for (const bloco of blocos) {
    celulas.push({
      andar,
      coluna,
      largura: bloco.largura,
      codigo: bloco.codigo,
      classificacao: bloco.classificacao,
      bloqueada: false,
    })
    coluna += bloco.largura
  }

  while (coluna <= colunas) {
    celulas.push({ andar, coluna, largura: 1, codigo: null, classificacao: null, bloqueada })
    coluna++
  }

  return celulas
}

/**
 * Distribui os produtos ja ordenados pelas celulas.
 *
 * Preenche da esquerda para a direita, de cima para baixo. Marca diferente da
 * anterior sempre comeca um andar novo, mesmo sobrando coluna no andar atual --
 * e assim que a prateleira fica lida de longe: um andar, uma marca.
 *
 * Duas coisas mudam o preenchimento:
 *
 * - **Largura**: um campeao de venda ocupa varias colunas seguidas. O bloco
 *   nunca e partido entre dois andares; se nao cabe no que sobrou, desce
 *   inteiro para o proximo.
 * - **Regra de andar**: um andar com regra so recebe quem a atende, e quem a
 *   atende so vai para la. Os andares sem regra recebem o resto.
 *
 * O que nao couber sai em `naoAlocados`, na ordem em que teria entrado.
 */
export function alocarEstante(
  template: TemplateEstante,
  produtosOrdenados: ProdutoEstante[],
  larguras: Record<string, number> = {},
): PlanoAlocacao {
  const colunas = Math.max(0, Math.trunc(template.colunas))
  const bloqueados = new Set(template.andaresBloqueados)
  const uteis = andaresUteis(template)

  const naoAlocados: ItemNaoAlocado[] = []
  const avisos: string[] = []
  const paraFora = (p: ProdutoEstante) =>
    naoAlocados.push({ codigo: p.codigo, classificacao: p.classificacao })

  const montarGrade = (blocosPorAndar: Map<number, Bloco[]>): Celula[] => {
    const celulas: Celula[] = []
    for (let andar = 1; andar <= Math.max(0, Math.trunc(template.andares)); andar++) {
      celulas.push(
        ...celulasDoAndar(andar, colunas, blocosPorAndar.get(andar) ?? [], bloqueados.has(andar)),
      )
    }
    return celulas
  }

  // Estante sem coluna nenhuma: sai cedo, senao o laco de encaixe nao termina.
  if (colunas < 1) {
    produtosOrdenados.forEach(paraFora)
    if (naoAlocados.length > 0) avisos.push('A estante não tem nenhuma coluna.')
    return { celulas: montarGrade(new Map()), naoAlocados, avisos }
  }

  const largura = (p: ProdutoEstante) => larguraDe(p.codigo, larguras, colunas)

  // 1. Reparte: quem tem andar reservado vai para la; o resto fica no bolo.
  const andaresComRegra = uteis.filter((a) => {
    const regra = regraDoAndar(template, a)
    return regra !== undefined && !regraVazia(regra)
  })

  const filaDoAndar = new Map<number, ProdutoEstante[]>()
  const livres: ProdutoEstante[] = []

  for (const produto of produtosOrdenados) {
    // O primeiro andar cuja regra o produto atende fica com ele.
    const destino = andaresComRegra.find((a) =>
      produtoAtendeRegra(produto, regraDoAndar(template, a)!),
    )
    if (destino === undefined) {
      livres.push(produto)
      continue
    }
    const fila = filaDoAndar.get(destino) ?? []
    fila.push(produto)
    filaDoAndar.set(destino, fila)
  }

  const blocosPorAndar = new Map<number, Bloco[]>()

  // 2. Andares com regra: cada um se vira com a propria fila.
  for (const andar of andaresComRegra) {
    const blocos: Bloco[] = []
    let usado = 0
    let sobraram = 0

    for (const produto of filaDoAndar.get(andar) ?? []) {
      const w = largura(produto)
      if (usado + w > colunas) {
        // Reservado para este andar e nao coube: nao vai vazar para outro,
        // senao a regra "o andar 1 so tem X" deixaria de valer.
        paraFora(produto)
        sobraram++
        continue
      }
      blocos.push({ codigo: produto.codigo, classificacao: produto.classificacao, largura: w })
      usado += w
    }

    if (sobraram > 0) {
      avisos.push(`Andar ${andar}: ${sobraram} produto(s) da regra não couberam nele.`)
    }
    blocosPorAndar.set(andar, blocos)
  }

  // 3. Andares sem regra: o bolo, com a quebra por marca.
  const andaresLivres = uteis.filter((a) => !andaresComRegra.includes(a))
  const foraAntes = naoAlocados.length
  let indice = 0
  let usado = 0
  let marcaAnterior: string | null = null

  for (const produto of livres) {
    // Comparada sem caixa nem acento, igual a ordenacao. O Bling aceita
    // "MultFila" e "MULTFILA" no mesmo cadastro, e comparar as strings cruas
    // daria um andar novo para cada grafia da MESMA marca.
    const marca = normalizarTexto(produto.classificacao.marca)

    // Marca nova quebra o andar -- mas nao desperdica um andar inteiro se ja
    // estivermos no comeco de um.
    if (marcaAnterior !== null && marca !== marcaAnterior && usado > 0) {
      indice++
      usado = 0
    }
    marcaAnterior = marca

    // Bloco largo que nao cabe no resto do andar desce inteiro: partir um
    // bloco entre dois andares tiraria dele a razao de existir.
    const w = largura(produto)
    while (indice < andaresLivres.length && usado + w > colunas) {
      indice++
      usado = 0
    }

    const andar = andaresLivres[indice]
    if (andar === undefined) {
      paraFora(produto)
      continue
    }

    const blocos = blocosPorAndar.get(andar) ?? []
    blocos.push({ codigo: produto.codigo, classificacao: produto.classificacao, largura: w })
    blocosPorAndar.set(andar, blocos)
    usado += w
  }

  // Os que sobraram das regras ja tem aviso proprio, nomeando o andar; este e
  // so para os do bolo, que sobraram por falta de espaco.
  const sobraramDoBolo = naoAlocados.length - foraAntes
  if (sobraramDoBolo > 0) {
    avisos.push(
      `${sobraramDoBolo} produto(s) não couberam em ${andaresLivres.length} × ${colunas} células.`,
    )
  }

  return { celulas: montarGrade(blocosPorAndar), naoAlocados, avisos }
}

/** As celulas ocupadas, para quem so quer iterar o que tem produto. */
export function celulasOcupadas(plano: PlanoAlocacao): Celula[] {
  return plano.celulas.filter((c) => c.codigo !== null)
}
