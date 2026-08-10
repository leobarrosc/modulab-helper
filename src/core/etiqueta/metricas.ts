import type { FonteMedida } from './tipos'

/**
 * Medicao de texto sem DOM.
 *
 * Larguras do Helvetica em milesimos de em, direto do AFM. Precisamos disso em
 * `core/` porque o ajuste "encolher" tem que dar o MESMO resultado na previa e
 * no PDF -- medir com o DOM daria um numero e o jsPDF daria outro.
 *
 * Tudo em MILIMETROS. O pt so aparece na fronteira com o backend de desenho.
 */

const HELVETICA: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722,
  I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722,
  S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
}

/** Acentuados ocupam a mesma largura da letra base no Helvetica. */
const SEM_ACENTO = (c: string) => c.normalize('NFD').replace(/\p{M}/gu, '')

const LARGURA_PADRAO = 556

/** Bold e ~3% mais largo; Times ~8% mais estreito; Courier e fixo em 600. */
function larguraChar(char: string, fonte: FonteMedida): number {
  if (fonte.familia === 'Courier') return 600

  const base = HELVETICA[char] ?? HELVETICA[SEM_ACENTO(char)] ?? LARGURA_PADRAO
  const ajusteFamilia = fonte.familia === 'Times' ? 0.92 : 1
  const ajustePeso = fonte.negrito ? 1.03 : 1

  return base * ajusteFamilia * ajustePeso
}

/** Largura do texto em mm. */
export function larguraTexto(texto: string, fonte: FonteMedida): number {
  let milesimos = 0
  for (const char of texto) milesimos += larguraChar(char, fonte)
  return (milesimos / 1000) * fonte.tamanhoMm
}

/** Altura de uma linha, com a folga tipográfica usual. */
export function alturaLinha(fonte: FonteMedida): number {
  return fonte.tamanhoMm * 1.2
}

/** Corta o texto e acrescenta reticências até caber na largura. */
export function cortarComReticencias(texto: string, fonte: FonteMedida, larguraMm: number): string {
  if (larguraTexto(texto, fonte) <= larguraMm) return texto

  let corte = texto.length
  while (corte > 0) {
    corte--
    const tentativa = `${texto.slice(0, corte).trimEnd()}…`
    if (larguraTexto(tentativa, fonte) <= larguraMm) return tentativa
  }
  return '…'
}

/** Maior tamanho, até `fonte.tamanhoMm`, que faz o texto caber na largura. */
export function tamanhoQueCabe(texto: string, fonte: FonteMedida, larguraMm: number): number {
  if (larguraTexto(texto, fonte) <= larguraMm) return fonte.tamanhoMm

  const larguraUnitaria = larguraTexto(texto, { ...fonte, tamanhoMm: 1 })
  if (larguraUnitaria <= 0) return fonte.tamanhoMm

  // Arredonda para baixo em centesimos de mm, para nunca estourar a largura.
  return Math.max(0.1, Math.floor((larguraMm / larguraUnitaria) * 100) / 100)
}

/** Quebra o texto em no máximo `maxLinhas`, cortando a última se preciso. */
export function quebrarLinhas(
  texto: string,
  fonte: FonteMedida,
  larguraMm: number,
  maxLinhas: number,
): string[] {
  if (maxLinhas <= 1) return [texto]

  const palavras = texto.split(/\s+/).filter(Boolean)
  const linhas: string[] = []
  let atual = ''

  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra
    if (larguraTexto(tentativa, fonte) <= larguraMm || !atual) {
      atual = tentativa
    } else {
      linhas.push(atual)
      atual = palavra
      if (linhas.length === maxLinhas) break
    }
  }

  if (linhas.length < maxLinhas && atual) linhas.push(atual)

  if (linhas.length === maxLinhas) {
    const consumido = linhas.join(' ')
    if (consumido.length < texto.length) {
      const ultima = linhas[maxLinhas - 1] ?? ''
      linhas[maxLinhas - 1] = cortarComReticencias(`${ultima}…`, fonte, larguraMm)
    }
  }

  return linhas.length > 0 ? linhas : ['']
}
