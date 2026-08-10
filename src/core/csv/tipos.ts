/** Uma linha do CSV: nome da coluna -> valor ja limpo. */
export type LinhaCsv = Record<string, string>

export interface MetaPlanilha {
  /** Como os bytes foram decodificados. */
  encoding: 'utf-8' | 'windows-1252'
  /** `true` se o arquivo comecava com BOM. */
  tinhaBom: boolean
  /** Delimitador detectado. */
  delimitador: string
  /** Linhas de dados no arquivo, antes de descartar vazias. */
  linhasBrutas: number
  /** Linhas totalmente vazias que foram descartadas. */
  linhasVazias: number
}

export interface Planilha {
  colunas: string[]
  linhas: LinhaCsv[]
  meta: MetaPlanilha
  /** Problemas nao fatais dignos de mostrar ao usuario. */
  avisos: string[]
}

/** Coluna virtual: existe no template mas nao no arquivo. */
export const COLUNAS_VIRTUAIS = ['_indice', '_linha', '_total', '_data'] as const
