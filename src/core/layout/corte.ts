import type { DrawOp } from '../render/tipos'
import type { Grade, ResultadoGrade } from './tipos'

/**
 * Guias de corte para papel adesivo cortado a mao.
 *
 * `linhas`  — riscos atravessando a folha inteira, para cortar de uma passada
 *             com regua. E o modo util para tesoura/estilete.
 * `marcas`  — so pequenos ticks nas bordas do papel, sem riscar a area
 *             impressa. Para quem alinha a regua e nao quer linha na etiqueta.
 */
export type EstiloCorte = 'nenhum' | 'linhas' | 'marcas'

export interface ConfigCorte {
  estilo: EstiloCorte
  espessuraMm: number
  /** 0 = preto. Um cinza claro corta bem e some no resultado. */
  cinza: number
  /** Comprimento do tick no modo `marcas`. */
  marcaMm: number
}

export const CORTE_PADRAO: ConfigCorte = {
  estilo: 'nenhum',
  espessuraMm: 0.15,
  cinza: 0.55,
  marcaMm: 3,
}

/**
 * Onde os cortes caem em um eixo.
 *
 * As linhas internas ficam no MEIO do espaco entre etiquetas, nao nas duas
 * bordas: assim e um corte so por corredor, e cada etiqueta fica com metade do
 * espaco como sangria. Com espaco 0 o meio coincide com a borda compartilhada,
 * entao o mesmo calculo serve para grades coladas.
 */
export function posicoesDeCorte(
  inicio: number,
  quantidade: number,
  tamanho: number,
  espaco: number,
): number[] {
  const posicoes: number[] = [inicio]

  for (let i = 0; i < quantidade - 1; i++) {
    posicoes.push(inicio + i * (tamanho + espaco) + tamanho + espaco / 2)
  }

  posicoes.push(inicio + quantidade * tamanho + (quantidade - 1) * espaco)
  return posicoes
}

/** Os riscos de corte da folha, como `DrawOp[]`. */
export function opsDeCorte(
  grade: Grade,
  resultado: ResultadoGrade,
  config: ConfigCorte,
): DrawOp[] {
  if (config.estilo === 'nenhum' || !resultado.valida) return []

  const { margens } = grade
  const xs = posicoesDeCorte(
    margens.esquerda,
    resultado.colunas,
    resultado.etiqueta.larguraMm,
    grade.espacoXMm,
  )
  const ys = posicoesDeCorte(
    margens.topo,
    resultado.linhas,
    resultado.etiqueta.alturaMm,
    grade.espacoYMm,
  )

  const { larguraMm, alturaMm } = resultado.pagina
  const risco = (x1: number, y1: number, x2: number, y2: number): DrawOp => ({
    op: 'linha',
    x1Mm: x1,
    y1Mm: y1,
    x2Mm: x2,
    y2Mm: y2,
    espessuraMm: config.espessuraMm,
    cinza: config.cinza,
  })

  const ops: DrawOp[] = []

  if (config.estilo === 'linhas') {
    // Atravessam a folha toda: nunca cruzam uma etiqueta, porque caem nos
    // corredores entre elas e nas bordas do bloco.
    for (const x of xs) ops.push(risco(x, 0, x, alturaMm))
    for (const y of ys) ops.push(risco(0, y, larguraMm, y))
    return ops
  }

  const t = Math.max(0.5, config.marcaMm)
  for (const x of xs) {
    ops.push(risco(x, 0, x, t))
    ops.push(risco(x, alturaMm - t, x, alturaMm))
  }
  for (const y of ys) {
    ops.push(risco(0, y, t, y))
    ops.push(risco(larguraMm - t, y, larguraMm, y))
  }
  return ops
}
