import type { Alinhamento } from '../render/tipos'

export type TipoCampo = 'texto' | 'codigo' | 'linha' | 'caixa'

export type Rotacao = 0 | 90 | 180 | 270

export type Ajuste = 'encolher' | 'reticencias' | 'cortar'

export type Familia = 'Helvetica' | 'Times' | 'Courier'

export interface FonteCampo {
  familia: Familia
  /**
   * Altura da fonte como FRACAO DA ALTURA DA ETIQUETA. 0,08 = 8%.
   *
   * Nao e pt. Guardar em pt exigiria reescalar tudo a cada mudanca de grade;
   * em fracao, mudar a etiqueta de 34 mm para 95 mm ja deixa todo o conteudo
   * na mesma proporcao, sem nenhuma conversao.
   */
  tamanhoPct: number
  negrito: boolean
  italico: boolean
}

/** Fonte com o tamanho ja resolvido em mm, para medir e desenhar. */
export interface FonteMedida {
  familia: Familia
  tamanhoMm: number
  negrito: boolean
  italico: boolean
}

/**
 * Um campo da etiqueta.
 *
 * `x`, `y`, `w` e `h` sao FRACOES da etiqueta (0..1), nao milimetros.
 * E o que faz o layout sobreviver a uma mudanca de grade: trocar de 2x4 para
 * 3x6 redimensiona a etiqueta, e os campos acompanham em vez de vazarem para
 * fora. A interface sempre exibe mm; a conversao e interna. Ver PLANO.md §5.
 */
export interface Campo {
  id: string
  tipo: TipoCampo
  nome: string

  x: number
  y: number
  w: number
  h: number

  rotacao: Rotacao
  /** 0 = preto, 1 = branco. */
  cinza: number
  travado: boolean

  /** Texto com chaves: "{Descrição}", "R$ {Preço|moeda}". */
  template: string

  // ---- texto ----
  fonte?: FonteCampo
  alinhamento?: Alinhamento
  ajuste?: Ajuste
  maxLinhas?: number

  // ---- codigo ----
  simbologia?: string
  mostrarLegenda?: boolean
  /** Igual a `tamanhoPct`: fracao da altura da etiqueta. */
  legendaPct?: number

  // ---- linha / caixa ----
  espessuraMm?: number
  preenchido?: boolean
}

/** Contorno desenhado no limite da etiqueta. */
export interface BordaEtiqueta {
  mostrar: boolean
  espessuraMm: number
  cinza: number
}

export const BORDA_PADRAO: BordaEtiqueta = {
  mostrar: false,
  espessuraMm: 0.2,
  cinza: 0,
}

export interface Modelo {
  id: string
  nome: string
  campos: Campo[]
  borda?: BordaEtiqueta
}
