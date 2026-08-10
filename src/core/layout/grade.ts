import { dimensoes } from './pagina'
import type { Grade, Pagina, Posicao, ResultadoGrade, Tamanho } from './tipos'

/**
 * Menor lado util para uma etiqueta ainda fazer sentido. Abaixo disso nao cabe
 * nem o codigo de barras mais estreito com sua zona muda.
 */
const LADO_MINIMO_MM = 5

export const GRADE_PADRAO: Grade = {
  modo: 'porGrade',
  colunas: 1,
  linhas: 1,
  etiquetaLarguraMm: 40,
  etiquetaAlturaMm: 25,
  espacoXMm: 2,
  espacoYMm: 2,
  margens: { topo: 3, direita: 3, base: 3, esquerda: 3 },
}

const inteiroPositivo = (v: number) => Math.max(1, Math.trunc(v) || 1)

/**
 * Quantas etiquetas de lado `lado` cabem em `disponivel`, com `espaco` entre elas.
 *
 *   n * lado + (n - 1) * espaco <= disponivel
 *   n <= (disponivel + espaco) / (lado + espaco)
 *
 * O espaco entra somado dos dois lados porque ele NAO existe depois da ultima
 * etiqueta -- esquecer isso faz caber uma etiqueta a menos do que caberia.
 */
function quantasCabem(disponivel: number, lado: number, espaco: number): number {
  if (lado <= 0) return 0
  return Math.floor((disponivel + espaco) / (lado + espaco))
}

/** Espaco ocupado por `n` etiquetas de lado `lado` com `espaco` entre elas. */
function ocupado(n: number, lado: number, espaco: number): number {
  return n <= 0 ? 0 : n * lado + (n - 1) * espaco
}

/**
 * Resolve a grade nos dois sentidos.
 *
 * - `porGrade`: colunas × linhas mandam, a etiqueta e derivada e preenche tudo.
 * - `porEtiqueta`: o tamanho manda, colunas × linhas sao derivadas e pode sobrar
 *   espaco na pagina.
 *
 * Ver PLANO.md secao 4.
 */
export function calcularGrade(pagina: Pagina, grade: Grade): ResultadoGrade {
  const tamanhoPagina = dimensoes(pagina)
  const { margens } = grade

  const utilLargura = tamanhoPagina.larguraMm - margens.esquerda - margens.direita
  const utilAltura = tamanhoPagina.alturaMm - margens.topo - margens.base
  const util: Tamanho = { larguraMm: utilLargura, alturaMm: utilAltura }

  const base = { util, pagina: tamanhoPagina }
  const erros: string[] = []

  if (grade.modo === 'porEtiqueta') {
    const larguraMm = Math.max(0, grade.etiquetaLarguraMm || 0)
    const alturaMm = Math.max(0, grade.etiquetaAlturaMm || 0)

    const colunas = quantasCabem(utilLargura, larguraMm, grade.espacoXMm)
    const linhas = quantasCabem(utilAltura, alturaMm, grade.espacoYMm)

    if (larguraMm < LADO_MINIMO_MM || alturaMm < LADO_MINIMO_MM) {
      erros.push(`A etiqueta precisa ter pelo menos ${LADO_MINIMO_MM} mm de cada lado.`)
    } else if (colunas < 1 || linhas < 1) {
      erros.push(
        `Uma etiqueta de ${larguraMm.toFixed(1)} × ${alturaMm.toFixed(1)} mm não cabe na ` +
          `área útil de ${utilLargura.toFixed(1)} × ${utilAltura.toFixed(1)} mm. ` +
          'Reduza a etiqueta, as margens ou use uma página maior.',
      )
    }

    return {
      ...base,
      etiqueta: { larguraMm, alturaMm },
      colunas,
      linhas,
      sobra: {
        larguraMm: Math.max(0, utilLargura - ocupado(colunas, larguraMm, grade.espacoXMm)),
        alturaMm: Math.max(0, utilAltura - ocupado(linhas, alturaMm, grade.espacoYMm)),
      },
      porPagina: Math.max(0, colunas) * Math.max(0, linhas),
      valida: erros.length === 0,
      erros,
    }
  }

  const colunas = inteiroPositivo(grade.colunas)
  const linhas = inteiroPositivo(grade.linhas)

  const larguraMm = (utilLargura - grade.espacoXMm * (colunas - 1)) / colunas
  const alturaMm = (utilAltura - grade.espacoYMm * (linhas - 1)) / linhas

  if (larguraMm < LADO_MINIMO_MM) {
    erros.push(
      `A etiqueta ficou com ${larguraMm.toFixed(1)} mm de largura. ` +
        'Reduza as colunas, as margens laterais ou o espaço horizontal.',
    )
  }
  if (alturaMm < LADO_MINIMO_MM) {
    erros.push(
      `A etiqueta ficou com ${alturaMm.toFixed(1)} mm de altura. ` +
        'Reduza as linhas, as margens de topo/base ou o espaço vertical.',
    )
  }

  return {
    ...base,
    etiqueta: { larguraMm, alturaMm },
    colunas,
    linhas,
    // Por definicao a grade preenche a area util inteira.
    sobra: { larguraMm: 0, alturaMm: 0 },
    porPagina: colunas * linhas,
    valida: erros.length === 0,
    erros,
  }
}

/**
 * Canto superior esquerdo da celula `indice` (0 = primeira, em leitura
 * esquerda->direita, cima->baixo).
 *
 * A grade e ancorada na margem superior esquerda; quando sobra espaco no modo
 * `porEtiqueta`, ele fica a direita e embaixo -- que e como folhas adesivas
 * pre-cortadas se comportam.
 */
export function posicaoCelula(
  grade: Grade,
  resultado: ResultadoGrade,
  indice: number,
): Posicao {
  const colunas = Math.max(1, resultado.colunas)
  const coluna = indice % colunas
  const linha = Math.floor(indice / colunas)

  return {
    xMm: grade.margens.esquerda + coluna * (resultado.etiqueta.larguraMm + grade.espacoXMm),
    yMm: grade.margens.topo + linha * (resultado.etiqueta.alturaMm + grade.espacoYMm),
  }
}

/**
 * Quantas paginas para `total` etiquetas.
 *
 * `pular` reaproveita uma folha adesiva ja parcialmente usada: informa quantas
 * celulas do inicio ficam em branco na primeira pagina.
 */
export function contarPaginas(total: number, porPagina: number, pular = 0): number {
  if (total <= 0 || porPagina <= 0) return 0
  return Math.ceil((total + Math.max(0, pular)) / porPagina)
}

/**
 * Indices das etiquetas que caem na pagina `indicePagina` (base 0).
 * `null` marca celula vazia -- as puladas no inicio e as sobras no fim.
 */
export function celulasDaPagina(
  total: number,
  porPagina: number,
  indicePagina: number,
  pular = 0,
): (number | null)[] {
  const deslocamento = Math.max(0, pular)
  const primeira = indicePagina * porPagina

  return Array.from({ length: Math.max(0, porPagina) }, (_, i) => {
    const posicao = primeira + i - deslocamento
    return posicao >= 0 && posicao < total ? posicao : null
  })
}
