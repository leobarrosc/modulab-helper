/**
 * De onde saem Marca, Tipo e Cor.
 *
 * O Bling nao tem campo de "tipo de filamento" nem de "cor": tem uma categoria
 * hierarquica comercial e uma descricao em texto corrido. Este arquivo extrai
 * os tres eixos desses dois campos -- e por isso aceita correcao manual: a
 * categoria do Bling responde a uma pergunta comercial, nao a de onde o rolo
 * mora na prateleira.
 */
import { limpar, type LinhaCsv } from '../csv'
import { normalizarTexto } from './texto'
import type { Classificacao, CorrecaoClassificacao } from './tipos'

export const COLUNA_MARCA = 'Marca'
export const COLUNA_DESCRICAO = 'Descrição'
export const COLUNA_CATEGORIA = 'Categoria do produto'
export const COLUNA_CODIGO = 'Código'

/** Separador de niveis da categoria do Bling: `Filamentos>>PLA>>Silk`. */
export const SEPARADOR_CATEGORIA = '>>'

/**
 * Nivel 3 que nao acrescenta nada ao nome do tipo. "PLA Básico" na prateleira e
 * so "PLA" -- e o rolo sem adjetivo.
 */
const NIVEIS_GENERICOS = new Set(['BASICO', 'BASICOS', 'COMUM', 'PADRAO', 'GERAL'])

/**
 * Palavras que nao dizem nada sobre a cor.
 *
 * Cada marca escreve a descricao do seu jeito, e a cor vem cercada de duas
 * coisas: o nome da LINHA comercial ("Basic", "Premium Ht High Speed", "Lite",
 * "Hyper", "HF") e a EMBALAGEM ("Peso:1KG", "ROLO", "1.75MM", "DER 4",
 * "REFIL"). Sao 30 dos 38 casos que falhavam no arquivo real -- recorte, nao
 * interpretacao.
 *
 * A lista e um valor de fabrica: o usuario acrescenta as suas em
 * `palavrasIgnoradas`, porque marca nova traz nome de linha novo.
 */
export const RUIDO_PADRAO: readonly string[] = [
  // O que abre a descricao.
  'FILAMENTO',
  'FILAMENTOS',
  'PARA',
  'P',
  'IMP',
  'IMPRESSAO',
  'IMPRESSORA',
  '3D',
  // Linha comercial.
  'BASIC',
  'BASICO',
  'PREMIUM',
  'HT',
  'HIGH',
  'SPEED',
  'LITE',
  'HYPER',
  'HF',
  'PRO',
  'PLUS',
  'STANDARD',
  // Embalagem e medida.
  'PESO',
  'ROLO',
  'REFIL',
  'BOBINA',
  'KG',
  'G',
  'MM',
  'DER',
  'UN',
  // Prefixos de SKU que sobram depois de quebrar em `-`.
  'MP',
  'CR',
]

/** Token que e so numero ou medida: "1KG", "1.75MM", "9075", "4". */
const SO_MEDIDA = /^\d+([.,]\d+)?(KG|G|MM|M)?$/

/** Os niveis da categoria, limpos e sem os vazios. */
export function niveisCategoria(categoriaProduto: string): string[] {
  return categoriaProduto
    .split(SEPARADOR_CATEGORIA)
    .map((n) => limpar(n))
    .filter((n) => n !== '')
}

/**
 * O tipo de filamento: niveis 2 e 3 da categoria.
 *
 * `Filamentos>>PLA>>Matte/Fosco` -> `PLA Matte/Fosco`
 * `Filamentos>>PLA>>Básico`      -> `PLA`          (nivel 3 generico some)
 * `Filamentos>>PLA`              -> `PLA`
 * `Filamentos` ou vazia          -> `''`           (exibido "Sem tipo")
 */
export function tipoDaCategoria(categoriaProduto: string): string {
  const niveis = niveisCategoria(categoriaProduto)
  const material = niveis[1]
  if (!material) return ''

  const variante = niveis[2]
  if (!variante || NIVEIS_GENERICOS.has(normalizarTexto(variante))) return material

  return `${material} ${variante}`
}

/**
 * As palavras que compoem o tipo, normalizadas.
 *
 * Quebra tambem em `/` porque a categoria escreve `Matte/Fosco` e a descricao
 * escreve so `MATTE`: sem isso o MATTE da descricao nunca casaria com o tipo e
 * vazaria para dentro da cor.
 */
function tokensDoTipo(tipo: string): Set<string> {
  return new Set(
    normalizarTexto(tipo)
      .split(/[\s/]+/)
      .filter(Boolean),
  )
}

/**
 * Quebra a descricao em palavras.
 *
 * Separa tambem em `-`, `/`, `,` e `:` porque as marcas grudam ali:
 * `BAMBU PLA LITE-CIANO`, `Peso:1KG`, `CR-PETG`. Parenteses viram espaco, o que
 * isola `(1.75MM)`.
 */
function palavrasDaDescricao(descricao: string): string[] {
  return limpar(descricao)
    .split(/[\s\-/,:()[\]]+/)
    .filter(Boolean)
}

export interface OpcoesCor {
  /** Palavras extras a ignorar, acrescentadas pelo usuario. */
  palavrasIgnoradas?: readonly string[]
  /** Nome da marca: tambem nao faz parte da cor ("BAMBU PLA LITE-CIANO"). */
  marca?: string
  /** Decide se um token e nome de cor -- injetado para o core nao ciclar. */
  ehCor?: (palavra: string) => boolean
}

/**
 * A cor: o que sobra da descricao depois de tirar ruido, tipo e marca.
 *
 * `"FILAMENTO PLA MATTE ROSA CLARO"`      -> `"ROSA CLARO"`
 * `"Pla Basic Amarelo Peso:1KG"`          -> `"Amarelo"`
 * `"MP-FILAMENTO 3D - PETG VERDE 1KG..."` -> `"VERDE"`
 * `"BAMBU PLA LITE-CIANO"`                -> `"CIANO"`
 *
 * O descarte acontece em QUALQUER posicao, e nao so no inicio: as marcas poem
 * embalagem depois da cor (`VERDE 1KG (1.75MM) DER 4`). O que protege a cor de
 * ser comida e a guarda `ehCor` -- uma palavra que e nome de cor nunca e
 * descartada, mesmo constando do ruido ou do tipo.
 */
export function corDaDescricao(descricao: string, tipo: string, opcoes: OpcoesCor = {}): string {
  const { palavrasIgnoradas = [], marca = '', ehCor } = opcoes

  const descartaveis = new Set<string>([
    ...RUIDO_PADRAO,
    ...palavrasIgnoradas.map(normalizarTexto),
    ...tokensDoTipo(tipo),
    ...palavrasDaDescricao(marca).map(normalizarTexto),
  ])

  return palavrasDaDescricao(descricao)
    .filter((palavra) => {
      const chave = normalizarTexto(palavra)
      // Nome de cor sempre fica, aconteca o que acontecer.
      if (ehCor?.(chave)) return true
      return !descartaveis.has(chave) && !SO_MEDIDA.test(chave)
    })
    .join(' ')
}

/** Marca, tipo e cor crus, antes de qualquer correcao manual. */
export function classificarLinha(linha: LinhaCsv, opcoes: OpcoesCor = {}): Classificacao {
  const tipo = tipoDaCategoria(linha[COLUNA_CATEGORIA] ?? '')
  const marca = limpar(linha[COLUNA_MARCA] ?? '')
  return {
    marca,
    tipo,
    cor: corDaDescricao(linha[COLUNA_DESCRICAO] ?? '', tipo, { ...opcoes, marca }),
  }
}

/**
 * Aplica a correcao por cima do derivado.
 *
 * Campo ausente ou vazio na correcao mantem o valor derivado -- assim apagar o
 * texto na tela volta ao automatico, em vez de gravar uma string vazia.
 */
export function aplicarCorrecao(
  base: Classificacao,
  correcao: CorrecaoClassificacao | undefined,
): Classificacao {
  if (!correcao) return base
  return {
    marca: limpar(correcao.marca ?? '') || base.marca,
    tipo: limpar(correcao.tipo ?? '') || base.tipo,
    cor: limpar(correcao.cor ?? '') || base.cor,
  }
}

/** O codigo do produto, que e a chave de tudo que e persistido. */
export function codigoDaLinha(linha: LinhaCsv): string {
  return limpar(linha[COLUNA_CODIGO] ?? '')
}

/** Classificacao final: derivada da linha e corrigida pelo que o usuario mandou. */
export function classificarProduto(
  linha: LinhaCsv,
  correcoes: Record<string, CorrecaoClassificacao>,
  opcoes: OpcoesCor = {},
): Classificacao {
  return aplicarCorrecao(classificarLinha(linha, opcoes), correcoes[codigoDaLinha(linha)])
}
