/**
 * Regras de negocio sobre produtos: estoque e quantas etiquetas cada um rende.
 * Puro e sem DOM, para poder ser testado sem navegador.
 */
import { numeroBr, type LinhaCsv, type Planilha } from './csv'

export const COLUNA_ESTOQUE = 'Estoque'

/** De qual coluna sai o valor que vira codigo de barras. */
export type FonteCodigo = 'GTIN/EAN' | 'Código'

export const FONTES_CODIGO: readonly FonteCodigo[] = ['GTIN/EAN', 'Código']
export const FONTE_CODIGO_PADRAO: FonteCodigo = 'GTIN/EAN'

/** Fontes que existem de fato neste arquivo. */
export function fontesDisponiveis(planilha: Planilha): FonteCodigo[] {
  return FONTES_CODIGO.filter((f) => planilha.colunas.includes(f))
}

/**
 * Fonte a usar: a preferida, se existir no arquivo; senao a primeira
 * disponivel. Evita apontar para uma coluna ausente e zerar tudo.
 */
export function fonteEfetiva(planilha: Planilha, preferida: FonteCodigo): FonteCodigo {
  const disponiveis = fontesDisponiveis(planilha)
  if (disponiveis.includes(preferida)) return preferida
  return disponiveis[0] ?? preferida
}

/** O valor que sera codificado no codigo de barras. */
export function valorCodigo(linha: LinhaCsv, fonte: FonteCodigo): string {
  return linha[fonte] ?? ''
}

/**
 * `true` se a linha nao tem valor na coluna escolhida.
 *
 * Comum no Bling: neste arquivo de exemplo, 10 dos 12 produtos estao sem
 * GTIN/EAN. Essas linhas ainda podem ser impressas (a etiqueta sai sem codigo),
 * por isso nao sao travadas -- apenas comecam desmarcadas e em vermelho.
 */
export function semCodigo(linha: LinhaCsv, fonte: FonteCodigo): boolean {
  return valorCodigo(linha, fonte) === ''
}

/** Quantos produtos estao sem valor na coluna escolhida. */
export function contarSemCodigo(planilha: Planilha, fonte: FonteCodigo): number {
  if (!planilha.colunas.includes(fonte)) return 0
  return planilha.linhas.filter((l) => semCodigo(l, fonte)).length
}

/** `true` se o arquivo tem coluna de estoque. */
export function temEstoque(planilha: Planilha): boolean {
  return planilha.colunas.includes(COLUNA_ESTOQUE)
}

/**
 * Estoque da linha como numero, ou `null` se a coluna nao existe ou o valor
 * nao e numerico. O Bling escreve `"42,0000"`.
 */
export function estoqueDe(linha: LinhaCsv): number | null {
  const bruto = linha[COLUNA_ESTOQUE]
  if (bruto === undefined) return null
  return numeroBr(bruto)
}

/**
 * Estoque util para contagem de etiquetas.
 *
 * Arredonda para baixo (nao existe meia etiqueta) e trava em zero: o Bling
 * permite estoque negativo, e um negativo aqui subtrairia etiquetas do total.
 */
export function estoqueContavel(linha: LinhaCsv): number {
  const estoque = estoqueDe(linha)
  if (estoque === null) return 0
  return Math.max(0, Math.floor(estoque))
}

/**
 * Quantas etiquetas esta linha rende.
 *
 * Com `multiplicar`, imprime uma etiqueta por unidade em estoque -- o caso de
 * uso real: etiquetar cada rolo fisico na prateleira. `quantidade` vira o
 * multiplicador (2 etiquetas por unidade, por exemplo).
 *
 * Se a linha nao tem estoque legivel, `multiplicar` e ignorado: melhor imprimir
 * a quantidade pedida do que zerar a linha silenciosamente.
 */
export function etiquetasDaLinha(
  linha: LinhaCsv,
  quantidade: number,
  multiplicar: boolean,
): number {
  const qtd = Math.max(1, Math.trunc(quantidade) || 1)
  if (!multiplicar) return qtd
  if (estoqueDe(linha) === null) return qtd
  return qtd * estoqueContavel(linha)
}

/** `true` se a linha nao tem unidade em estoque (zerado ou negativo). */
export function semEstoque(linha: LinhaCsv): boolean {
  const estoque = estoqueDe(linha)
  return estoque !== null && estoque <= 0
}

/**
 * `true` se a linha nao pode render etiqueta nenhuma, qualquer que seja a
 * quantidade -- ou seja, esta sem estoque E o multiplicador esta ligado.
 * Nesse estado a selecao e travada, porque marcar nao produziria nada.
 *
 * Definido em termos do que a linha rende, e nao de "estoque zero", para que
 * desligar o multiplicador destrave a linha automaticamente: sem multiplicar,
 * um produto zerado ainda rende as etiquetas pedidas.
 */
export function bloqueada(linha: LinhaCsv, multiplicar: boolean): boolean {
  return etiquetasDaLinha(linha, 1, multiplicar) === 0
}

/**
 * Remove da selecao as linhas que passaram a render zero.
 * Chamado ao ligar o multiplicador, senao sobrariam linhas marcadas no estado
 * mas desenhadas como travadas na tela.
 */
export function purgarBloqueadas(
  planilha: Planilha,
  selecionados: Set<number>,
  multiplicar: boolean,
): Set<number> {
  const restantes = new Set<number>()
  for (const i of selecionados) {
    const linha = planilha.linhas[i]
    if (linha && !bloqueada(linha, multiplicar)) restantes.add(i)
  }
  return restantes
}

/**
 * Selecao inicial: tudo menos o que esta sem estoque ou sem codigo de barras.
 *
 * A regra do codigo so vale se a coluna existir no arquivo -- senao um CSV sem
 * GTIN/EAN comecaria com zero produtos marcados.
 */
export function selecaoInicial(planilha: Planilha, fonte: FonteCodigo): Set<number> {
  const aplicaCodigo = planilha.colunas.includes(fonte)
  const selecionados = new Set<number>()

  planilha.linhas.forEach((linha, i) => {
    if (semEstoque(linha)) return
    if (aplicaCodigo && semCodigo(linha, fonte)) return
    selecionados.add(i)
  })

  return selecionados
}

/** Quantos produtos do arquivo estao sem estoque. */
export function contarSemEstoque(planilha: Planilha): number {
  return planilha.linhas.filter(semEstoque).length
}

/**
 * A fila de etiquetas a imprimir, na ordem em que sairao na folha.
 *
 * Cada item e o indice da linha de origem; um produto que rende 42 etiquetas
 * aparece 42 vezes. `indicesNaOrdem` ja vem filtrado e ordenado pela tabela --
 * e por isso que a ordenacao da tela e a ordem de impressao.
 */
export function filaEtiquetas(
  planilha: Planilha,
  indicesNaOrdem: number[],
  selecionados: Set<number>,
  quantidades: Map<number, number>,
  multiplicar: boolean,
): number[] {
  const fila: number[] = []

  for (const i of indicesNaOrdem) {
    if (!selecionados.has(i)) continue
    const linha = planilha.linhas[i]
    if (!linha) continue

    const quantas = etiquetasDaLinha(linha, quantidades.get(i) ?? 1, multiplicar)
    for (let n = 0; n < quantas; n++) fila.push(i)
  }

  return fila
}

/** Soma das etiquetas de todos os produtos selecionados. */
export function totalEtiquetas(
  planilha: Planilha,
  selecionados: Set<number>,
  quantidades: Map<number, number>,
  multiplicar: boolean,
): number {
  let total = 0
  for (const i of selecionados) {
    const linha = planilha.linhas[i]
    if (!linha) continue
    total += etiquetasDaLinha(linha, quantidades.get(i) ?? 1, multiplicar)
  }
  return total
}
