/**
 * Ordem das cores na prateleira.
 *
 * Nao e alfabetica: quem procura filamento procura pela cor, entao a estante
 * fica legivel quando as cores correm como um arco-iris. A regra tem tres
 * grupos, nesta ordem:
 *
 *   1. NEUTRAS  -- lista fixa comecando em Preto e Branco, que sao os mais
 *                  vendidos e por isso merecem a boca da estante.
 *   2. CROMATICAS -- por angulo de matiz (0 vermelho -> 348 vinho). E o angulo
 *                  que produz a sequencia do arco-iris; nao ha lista manual.
 *   3. DESCONHECIDAS -- multicolor e efeitos (MARMORIZADO, RAINBOW, TRICOLOR),
 *                  que nao tem matiz unico. Vao para o fim, em ordem
 *                  alfabetica.
 *
 * Os graus sao DADOS, nao regra: se a prateleira pedir outra vizinhanca, muda-se
 * o numero e a ordem acompanha.
 */

import { normalizarTexto } from './texto'

export interface DefinicaoCor {
  /** Normalizada: maiuscula e sem acento. */
  chave: string
  /** Como aparece para o usuario. */
  nome: string
  /** Vira a bolinha de cor na UI -- na conferencia se procura a bolinha, nao o texto. */
  hex: string
  neutro: boolean
  /** So para neutras: posicao na lista fixa. */
  ordemNeutro?: number
  /** So para cromaticas: angulo de matiz em graus. */
  matizGraus?: number
  /** Outras grafias que caem nesta mesma cor. */
  sinonimos?: readonly string[]
}

export const CORES_CONHECIDAS: readonly DefinicaoCor[] = [
  // Neutras, na ordem em que ficam na estante.
  { chave: 'PRETO', nome: 'Preto', hex: '#1a1a1a', neutro: true, ordemNeutro: 0 },
  { chave: 'BRANCO', nome: 'Branco', hex: '#f5f5f5', neutro: true, ordemNeutro: 1 },
  { chave: 'GRAFITE', nome: 'Grafite', hex: '#3d4245', neutro: true, ordemNeutro: 2 },
  { chave: 'CINZA', nome: 'Cinza', hex: '#8a8a8a', neutro: true, ordemNeutro: 3, sinonimos: ['CHUMBO'] },
  { chave: 'PRATA', nome: 'Prata', hex: '#c0c0c0', neutro: true, ordemNeutro: 4 },
  { chave: 'NATURAL', nome: 'Natural', hex: '#ede4d3', neutro: true, ordemNeutro: 5 },
  {
    chave: 'TRANSPARENTE',
    nome: 'Transparente',
    hex: '#dfe9ef',
    neutro: true,
    ordemNeutro: 6,
    sinonimos: ['CRISTAL', 'INCOLOR'],
  },

  // Cromaticas, por matiz. A ordem sai do numero, nao da posicao nesta lista.
  { chave: 'VERMELHO', nome: 'Vermelho', hex: '#e53935', neutro: false, matizGraus: 0 },
  { chave: 'CORAL', nome: 'Coral', hex: '#ff7043', neutro: false, matizGraus: 12 },
  // O Bling grava "MARRON" sem M; corrigir o cadastro nao e pre-requisito.
  {
    chave: 'MARROM',
    nome: 'Marrom',
    hex: '#6d4c41',
    neutro: false,
    matizGraus: 20,
    sinonimos: ['MARRON', 'MADEIRA'],
  },
  { chave: 'COBRE', nome: 'Cobre', hex: '#b87333', neutro: false, matizGraus: 25, sinonimos: ['BRONZE'] },
  { chave: 'LARANJA', nome: 'Laranja', hex: '#fb8c00', neutro: false, matizGraus: 30 },
  { chave: 'PELE', nome: 'Cor de pele', hex: '#e0ac69', neutro: false, matizGraus: 33 },
  {
    chave: 'BEGE',
    nome: 'Bege',
    hex: '#e3d3b3',
    neutro: false,
    matizGraus: 38,
    sinonimos: ['AREIA', 'CREME', 'MARFIM'],
  },
  {
    chave: 'DOURADO',
    nome: 'Dourado',
    hex: '#d4af37',
    neutro: false,
    matizGraus: 45,
    sinonimos: ['OURO'],
  },
  { chave: 'AMARELO', nome: 'Amarelo', hex: '#fdd835', neutro: false, matizGraus: 55 },
  { chave: 'LIMAO', nome: 'Limão', hex: '#9ccc65', neutro: false, matizGraus: 80 },
  { chave: 'VERDE', nome: 'Verde', hex: '#43a047', neutro: false, matizGraus: 120 },
  { chave: 'TURQUESA', nome: 'Turquesa', hex: '#1de9b6', neutro: false, matizGraus: 172 },
  { chave: 'CIANO', nome: 'Ciano', hex: '#00bcd4', neutro: false, matizGraus: 185 },
  { chave: 'AZUL', nome: 'Azul', hex: '#1e88e5', neutro: false, matizGraus: 215 },
  { chave: 'MARINHO', nome: 'Marinho', hex: '#1a237e', neutro: false, matizGraus: 232 },
  { chave: 'VIOLETA', nome: 'Violeta', hex: '#7c4dff', neutro: false, matizGraus: 268 },
  { chave: 'LAVANDA', nome: 'Lavanda', hex: '#b39ddb', neutro: false, matizGraus: 272 },
  { chave: 'ROXO', nome: 'Roxo', hex: '#8e24aa', neutro: false, matizGraus: 282 },
  { chave: 'LILAS', nome: 'Lilás', hex: '#ce93d8', neutro: false, matizGraus: 290 },
  { chave: 'MAGENTA', nome: 'Magenta', hex: '#d500f9', neutro: false, matizGraus: 305 },
  { chave: 'ROSA', nome: 'Rosa', hex: '#ec407a', neutro: false, matizGraus: 332 },
  // "Rose Gold" e rosa metalizado: fica junto do rosa, nao do dourado.
  { chave: 'ROSE', nome: 'Rose', hex: '#e0a3a3', neutro: false, matizGraus: 338 },
  { chave: 'VINHO', nome: 'Vinho', hex: '#7b1e2b', neutro: false, matizGraus: 348, sinonimos: ['BORDO'] },
]

/** Chave do grupo das cores sem matiz -- multicolor, efeito, gradiente. */
export const CHAVE_DESCONHECIDA = '(outras)'

/**
 * A ordem de fabrica: neutras na lista fixa, cromaticas por matiz, e o grupo
 * das sem-matiz no fim. E a ordem que o usuario ve para arrastar.
 */
export function ordemCoresPadrao(): string[] {
  const neutras = CORES_CONHECIDAS.filter((c) => c.neutro).sort(
    (a, b) => (a.ordemNeutro ?? 0) - (b.ordemNeutro ?? 0),
  )
  const cromaticas = CORES_CONHECIDAS.filter((c) => !c.neutro).sort(
    (a, b) => (a.matizGraus ?? 0) - (b.matizGraus ?? 0),
  )
  return [...neutras, ...cromaticas].map((c) => c.chave).concat(CHAVE_DESCONHECIDA)
}

/** Chave e sinonimos apontando para a mesma definicao. */
const POR_PALAVRA: ReadonlyMap<string, DefinicaoCor> = (() => {
  const mapa = new Map<string, DefinicaoCor>()
  for (const cor of CORES_CONHECIDAS) {
    mapa.set(cor.chave, cor)
    for (const sinonimo of cor.sinonimos ?? []) mapa.set(sinonimo, cor)
  }
  return mapa
})()

export type GrupoCor = 'neutro' | 'cromatica' | 'desconhecida'

export interface InfoCor {
  grupo: GrupoCor
  base: DefinicaoCor | null
  /** O que sobra depois da cor base: "CLARO" em "ROSA CLARO". */
  qualificador: string
  /** O texto como veio, para exibir e para desempatar desconhecidas. */
  bruta: string
}

/**
 * Palavras que dizem "este rolo nao tem uma cor so".
 *
 * Filamento gradiente, dual e tricolor muda de cor ao longo do rolo: nao ha
 * matiz que o represente, e forcar um seria pior que admitir que nao ha. Estes
 * vao para o grupo do fim, juntos, que e onde ficam bem na prateleira.
 */
const MARCADORES_MULTICOR = new Set([
  'RAINBOW',
  'TRICOLOR',
  'BICOLOR',
  'MULTICOLOR',
  'DUAL',
  'DUO',
  'GRADIENTE',
  'GRADIENT',
  'MARMORIZADO',
  'MARMORE',
  'IRIS',
  'CAMALEAO',
])

/**
 * Le a cor procurando o primeiro nome de cor conhecido.
 *
 * Nao e so a primeira palavra: "LUMINOSO VERDE" e verde, e "Cor De Pele
 * Caucasiano" e cor de pele. O que vier antes vira qualificador, junto com o
 * que vier depois.
 *
 * Um marcador de multicor manda a linha inteira para o grupo do fim antes de
 * qualquer busca -- senao "TRICOLOR DOURADO VERMELHO AZUL" seria arquivado como
 * dourado, e o rolo tricolor iria parar no meio dos dourados.
 *
 * Nunca lanca; string vazia cai em desconhecida.
 */
export function identificarCor(corBruta: string): InfoCor {
  const bruta = corBruta.trim()
  const palavras = normalizarTexto(bruta).split(/\s+/).filter(Boolean)

  const desconhecida: InfoCor = { grupo: 'desconhecida', base: null, qualificador: '', bruta }
  if (palavras.some((p) => MARCADORES_MULTICOR.has(p))) return desconhecida

  const indice = palavras.findIndex((p) => POR_PALAVRA.has(p))
  const base = indice === -1 ? undefined : POR_PALAVRA.get(palavras[indice]!)
  if (!base) return desconhecida

  return {
    grupo: base.neutro ? 'neutro' : 'cromatica',
    base,
    qualificador: [...palavras.slice(0, indice), ...palavras.slice(indice + 1)].join(' '),
    bruta,
  }
}

const COLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

const RANQUE_GRUPO: Record<GrupoCor, number> = {
  neutro: 0,
  cromatica: 1,
  desconhecida: 2,
}

/**
 * Ordena duas cores: grupo, depois posicao dentro do grupo, depois o
 * qualificador.
 *
 * A cor pura vem antes das qualificadas -- VERDE antes de VERDE MILITAR --,
 * senao a variacao apareceria na prateleira antes da cor que a nomeia.
 *
 * Com `ordem` (lista de chaves arrastada pelo usuario), e ela que manda no
 * primeiro criterio; sem ela, vale o matiz. As variacoes continuam coladas na
 * cor base nos dois casos.
 */
export function compararCor(a: InfoCor, b: InfoCor, ordem?: readonly string[]): number {
  if (ordem && ordem.length > 0) {
    const pa = posicaoDaCor(a, ordem)
    const pb = posicaoDaCor(b, ordem)
    if (pa !== pb) return pa - pb
  } else {
    if (a.grupo !== b.grupo) return RANQUE_GRUPO[a.grupo] - RANQUE_GRUPO[b.grupo]

    if (a.base && b.base) {
      const dentroDoGrupo = a.base.neutro
        ? (a.base.ordemNeutro ?? 0) - (b.base.ordemNeutro ?? 0)
        : (a.base.matizGraus ?? 0) - (b.base.matizGraus ?? 0)
      if (dentroDoGrupo !== 0) return dentroDoGrupo
    }
  }

  // Sem base nos dois lados: so o texto resolve.
  if (!a.base || !b.base) return COLATOR.compare(a.bruta, b.bruta)

  // Mesma posicao mas cores diferentes: desempata pela chave, para a ordem nao
  // depender do acaso.
  if (a.base.chave !== b.base.chave) return COLATOR.compare(a.base.chave, b.base.chave)

  const aPura = a.qualificador === ''
  const bPura = b.qualificador === ''
  if (aPura !== bPura) return aPura ? -1 : 1

  return COLATOR.compare(a.qualificador, b.qualificador)
}

/** Posicao da cor na ordem escolhida; ausente vai para o fim. */
function posicaoDaCor(info: InfoCor, ordem: readonly string[]): number {
  const chave = info.base?.chave ?? CHAVE_DESCONHECIDA
  const i = ordem.indexOf(chave)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

/** Atalho para ordenar direto pelo texto da cor. */
export function compararTextoCor(a: string, b: string, ordem?: readonly string[]): number {
  return compararCor(identificarCor(a), identificarCor(b), ordem)
}

/** Hex da cor, para a bolinha; `null` quando nao ha cor base reconhecida. */
export function hexDaCor(corBruta: string): string | null {
  return identificarCor(corBruta).base?.hex ?? null
}

/**
 * `true` se a palavra e nome de cor.
 *
 * E a guarda que impede o recorte da descricao de comer a propria cor: uma
 * palavra que consta do ruido ou do tipo, mas que tambem e cor, fica.
 */
export function ehNomeDeCor(palavra: string): boolean {
  return POR_PALAVRA.has(normalizarTexto(palavra))
}

/** A definicao de uma cor pela chave, para a UI mostrar nome e bolinha. */
export function corPorChave(chave: string): DefinicaoCor | undefined {
  return CORES_CONHECIDAS.find((c) => c.chave === chave)
}
