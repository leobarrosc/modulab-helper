export type PresetId = 'a4' | '2x4' | '4x4' | '4x6' | 'personalizado'

export type Orientacao = 'retrato' | 'paisagem'

export interface Preset {
  id: PresetId
  nome: string
  larguraMm: number
  alturaMm: number
  /** Grade que costuma fazer sentido nesse papel. */
  gradeSugerida: { colunas: number; linhas: number }
}

export interface Pagina {
  preset: PresetId
  /** Dimensoes no sentido retrato; a orientacao troca na hora de usar. */
  larguraMm: number
  alturaMm: number
  orientacao: Orientacao
}

export interface Margens {
  topo: number
  direita: number
  base: number
  esquerda: number
}

/**
 * Qual lado da conta o usuario controla.
 *
 * `porGrade`    — define colunas × linhas, a etiqueta e derivada e preenche
 *                 a pagina inteira. Bom para folha adesiva pre-cortada.
 * `porEtiqueta` — define o tamanho da etiqueta, colunas × linhas sao derivadas
 *                 (quantas cabem) e pode sobrar espaco. Bom quando a etiqueta
 *                 tem medida obrigatoria.
 */
export type ModoGrade = 'porGrade' | 'porEtiqueta'

export interface Grade {
  modo: ModoGrade
  /** Usados quando `modo === 'porGrade'`. */
  colunas: number
  linhas: number
  /** Usados quando `modo === 'porEtiqueta'`. */
  etiquetaLarguraMm: number
  etiquetaAlturaMm: number
  espacoXMm: number
  espacoYMm: number
  margens: Margens
}

export interface Tamanho {
  larguraMm: number
  alturaMm: number
}

export interface Posicao {
  xMm: number
  yMm: number
}

export interface ResultadoGrade {
  /** Tamanho de cada etiqueta. Derivado em `porGrade`, digitado em `porEtiqueta`. */
  etiqueta: Tamanho
  /** Grade efetiva. Digitada em `porGrade`, derivada em `porEtiqueta`. */
  colunas: number
  linhas: number
  /** Area util da pagina, ja descontadas as margens. */
  util: Tamanho
  /** Tamanho da pagina ja considerando a orientacao. */
  pagina: Tamanho
  /** Espaco que sobra na area util. Sempre 0 no modo `porGrade`. */
  sobra: Tamanho
  porPagina: number
  valida: boolean
  erros: string[]
}
