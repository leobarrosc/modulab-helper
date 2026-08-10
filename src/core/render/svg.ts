import { PT_EM_MM, type DrawOp } from './tipos'

/**
 * Backend SVG do pipeline de desenho, como string.
 *
 * E a UNICA implementacao de SVG do projeto: a previa em React tambem consome
 * esta funcao. Duas implementacoes acabariam divergindo, e o usuario veria uma
 * coisa na tela e imprimiria outra -- exatamente o que a `DrawOp[]` existe para
 * impedir. Ver PLANO.md secao 3.1.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)
}

/** Corta casas decimais inúteis: 3.4000000000000004 -> 3.4 */
function n(valor: number): string {
  return String(Math.round(valor * 1000) / 1000)
}

/** Cinza 0..1 -> cor. 0 = preto, 1 = branco. */
function tom(cinza: number): string {
  const v = Math.round(Math.min(1, Math.max(0, cinza)) * 255)
  return `rgb(${v},${v},${v})`
}

const ANCORA = {
  esquerda: 'start',
  centro: 'middle',
  direita: 'end',
} as const

export function opParaSvg(op: DrawOp): string {
  if (op.op === 'rect') {
    const comum = `x="${n(op.xMm)}" y="${n(op.yMm)}" width="${n(op.larguraMm)}" height="${n(op.alturaMm)}"`
    if (op.preenchido) {
      // `crispEdges` evita a costura clara entre barras vizinhas, que confunde
      // o leitor de código de barras.
      return `<rect ${comum} fill="${tom(op.cinza)}" shape-rendering="crispEdges"/>`
    }
    return `<rect ${comum} fill="none" stroke="${tom(op.cinza)}" stroke-width="${n(op.espessuraMm ?? 0.2)}"/>`
  }

  if (op.op === 'linha') {
    return (
      `<line x1="${n(op.x1Mm)}" y1="${n(op.y1Mm)}" x2="${n(op.x2Mm)}" y2="${n(op.y2Mm)}" ` +
      `stroke="${tom(op.cinza)}" stroke-width="${n(op.espessuraMm)}"/>`
    )
  }

  const peso = op.fonte.negrito ? ' font-weight="700"' : ''
  const italico = op.fonte.italico ? ' font-style="italic"' : ''

  return (
    `<text x="${n(op.xMm)}" y="${n(op.yMm)}" fill="${tom(op.cinza)}" ` +
    `text-anchor="${ANCORA[op.alinhamento]}" font-family="${op.fonte.familia}" ` +
    `font-size="${n(op.fonte.tamanhoPt * PT_EM_MM)}"${peso}${italico}>` +
    `${escapar(op.texto)}</text>`
  )
}

export function opsParaSvg(ops: DrawOp[]): string {
  return ops.map(opParaSvg).join('')
}

/** Uma página inteira como documento SVG, com o viewBox em milímetros. */
export function paginaParaSvg(
  ops: DrawOp[],
  larguraMm: number,
  alturaMm: number,
  classe = 'folha',
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" class="${classe}" ` +
    `width="${n(larguraMm)}mm" height="${n(alturaMm)}mm" ` +
    `viewBox="0 0 ${n(larguraMm)} ${n(alturaMm)}">` +
    `<rect x="0" y="0" width="${n(larguraMm)}" height="${n(alturaMm)}" fill="#ffffff"/>` +
    opsParaSvg(ops) +
    `</svg>`
  )
}
