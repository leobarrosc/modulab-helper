/**
 * A fronteira unica entre o que se calcula e o que se desenha.
 *
 * Tudo -- previa na tela, HTML de impressao e PDF -- consome esta mesma lista.
 * Sem isso seriam tres implementacoes que divergem, e o usuario imprimiria
 * algo diferente do que viu. Ver PLANO.md secao 3.1.
 *
 * Coordenadas SEMPRE em milimetros, com origem no canto superior esquerdo da
 * pagina -- a mesma convencao que o jsPDF usa na Fase 5.
 */

export interface Fonte {
  familia: 'Helvetica' | 'Times' | 'Courier'
  tamanhoPt: number
  negrito: boolean
  italico: boolean
}

export type Alinhamento = 'esquerda' | 'centro' | 'direita'

export type DrawOp =
  | {
      op: 'rect'
      xMm: number
      yMm: number
      larguraMm: number
      alturaMm: number
      /** 0 = preto, 1 = branco. Sem cor: o papel é preto e branco. */
      cinza: number
      preenchido: boolean
      /** Só quando `preenchido` é false. */
      espessuraMm?: number
    }
  | {
      op: 'texto'
      xMm: number
      yMm: number
      texto: string
      fonte: Fonte
      alinhamento: Alinhamento
      cinza: number
    }
  | {
      op: 'linha'
      x1Mm: number
      y1Mm: number
      x2Mm: number
      y2Mm: number
      espessuraMm: number
      cinza: number
    }

/** 1 pt tipográfico = 1/72 pol = 25,4/72 mm. */
export const PT_EM_MM = 25.4 / 72

export function ptParaMm(pt: number): number {
  return pt * PT_EM_MM
}
