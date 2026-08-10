import { jsPDF } from 'jspdf'
import type { DrawOp, Fonte } from './tipos'

/**
 * Backend jsPDF do pipeline de desenho.
 *
 * Consome exatamente a mesma `DrawOp[]` que o backend SVG da previa. Se o PDF
 * sair diferente da tela, o defeito esta num dos dois backends -- nunca no
 * calculo, que e compartilhado. Ver PLANO.md secao 3.1.
 *
 * O jsPDF trabalha em mm quando criado com `unit: 'mm'`, entao as coordenadas
 * entram sem conversao. So o tamanho da fonte e em pt.
 */

export interface PaginaPdf {
  larguraMm: number
  alturaMm: number
  ops: DrawOp[]
}

export interface OpcoesPdf {
  /** Vai para as propriedades do arquivo. */
  titulo?: string
}

const FAMILIA: Record<Fonte['familia'], string> = {
  Helvetica: 'helvetica',
  Times: 'times',
  Courier: 'courier',
}

const ALINHAMENTO = {
  esquerda: 'left',
  centro: 'center',
  direita: 'right',
} as const

function estilo(fonte: Fonte): string {
  if (fonte.negrito && fonte.italico) return 'bolditalic'
  if (fonte.negrito) return 'bold'
  if (fonte.italico) return 'italic'
  return 'normal'
}

/** Cinza 0..1 -> componente 0..255. 0 = preto. */
function tom(cinza: number): number {
  return Math.round(Math.min(1, Math.max(0, cinza)) * 255)
}

export function gerarPdf(paginas: PaginaPdf[], opcoes: OpcoesPdf = {}): jsPDF {
  if (paginas.length === 0) {
    throw new Error('Nenhuma página para gerar.')
  }

  const primeira = paginas[0]!
  const doc = new jsPDF({
    unit: 'mm',
    format: [primeira.larguraMm, primeira.alturaMm],
    orientation: primeira.larguraMm > primeira.alturaMm ? 'landscape' : 'portrait',
    compress: true,
  })

  if (opcoes.titulo) doc.setProperties({ title: opcoes.titulo })

  paginas.forEach((pagina, i) => {
    if (i > 0) {
      doc.addPage(
        [pagina.larguraMm, pagina.alturaMm],
        pagina.larguraMm > pagina.alturaMm ? 'landscape' : 'portrait',
      )
    }
    desenharPagina(doc, pagina.ops)
  })

  return doc
}

function desenharPagina(doc: jsPDF, ops: DrawOp[]): void {
  for (const op of ops) {
    if (op.op === 'rect') {
      const v = tom(op.cinza)
      if (op.preenchido) {
        doc.setFillColor(v, v, v)
        doc.rect(op.xMm, op.yMm, op.larguraMm, op.alturaMm, 'F')
      } else {
        doc.setDrawColor(v, v, v)
        doc.setLineWidth(op.espessuraMm ?? 0.2)
        doc.rect(op.xMm, op.yMm, op.larguraMm, op.alturaMm, 'S')
      }
      continue
    }

    if (op.op === 'linha') {
      const v = tom(op.cinza)
      doc.setDrawColor(v, v, v)
      doc.setLineWidth(op.espessuraMm)
      doc.line(op.x1Mm, op.y1Mm, op.x2Mm, op.y2Mm)
      continue
    }

    const v = tom(op.cinza)
    doc.setTextColor(v, v, v)
    doc.setFont(FAMILIA[op.fonte.familia], estilo(op.fonte))
    doc.setFontSize(op.fonte.tamanhoPt)
    doc.text(op.texto, op.xMm, op.yMm, {
      align: ALINHAMENTO[op.alinhamento],
      // O `yMm` da DrawOp e a LINHA DE BASE. Sem fixar isto, uma mudanca de
      // padrao do jsPDF deslocaria todo o texto verticalmente.
      baseline: 'alphabetic',
    })
  }
}

/** Nome de arquivo com a data, sem caracteres proibidos. */
export function nomeArquivoPdf(prefixo = 'etiquetas'): string {
  const agora = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefixo}_${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}_${p(agora.getHours())}${p(agora.getMinutes())}.pdf`
}
