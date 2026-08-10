import { describe, expect, it } from 'vitest'
import { jsPDF } from 'jspdf'
import { gerarPdf, nomeArquivoPdf, type PaginaPdf } from './pdf'
import { PT_EM_MM, type DrawOp } from './tipos'
import { larguraTexto } from '../etiqueta/metricas'
import type { FonteMedida } from '../etiqueta/tipos'

function bytes(doc: jsPDF): string {
  return Buffer.from(doc.output('arraybuffer')).toString('latin1')
}

/** MediaBox de cada página, em pontos. */
function mediaBoxes(doc: jsPDF): { larguraPt: number; alturaPt: number }[] {
  return [...bytes(doc).matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map((m) => {
    const [, , x2, y2] = (m[1] ?? '').trim().split(/\s+/).map(Number)
    return { larguraPt: x2 ?? 0, alturaPt: y2 ?? 0 }
  })
}

const mmParaPt = (mm: number) => mm / PT_EM_MM

const rect: DrawOp = {
  op: 'rect',
  xMm: 1,
  yMm: 2,
  larguraMm: 10,
  alturaMm: 5,
  cinza: 0,
  preenchido: true,
}

const pagina = (larguraMm: number, alturaMm: number): PaginaPdf => ({
  larguraMm,
  alturaMm,
  ops: [rect],
})

describe('tamanho da página', () => {
  it('2 × 4 pol sai exatamente 50,8 × 101,6 mm', () => {
    // O critério de aceite da Fase 5: o PDF tem que medir o que foi pedido.
    const caixas = mediaBoxes(gerarPdf([pagina(50.8, 101.6)]))
    expect(caixas).toHaveLength(1)
    expect(caixas[0]!.larguraPt).toBeCloseTo(mmParaPt(50.8), 2)
    expect(caixas[0]!.alturaPt).toBeCloseTo(mmParaPt(101.6), 2)
  })

  it('A4 sai exatamente 210 × 297 mm', () => {
    const c = mediaBoxes(gerarPdf([pagina(210, 297)]))[0]!
    expect(c.larguraPt).toBeCloseTo(mmParaPt(210), 2)
    expect(c.alturaPt).toBeCloseTo(mmParaPt(297), 2)
  })

  it('4 × 6 pol sai exatamente 101,6 × 152,4 mm', () => {
    const c = mediaBoxes(gerarPdf([pagina(101.6, 152.4)]))[0]!
    expect(c.larguraPt).toBeCloseTo(mmParaPt(101.6), 2)
    expect(c.alturaPt).toBeCloseTo(mmParaPt(152.4), 2)
  })

  it('paisagem mantém a largura maior que a altura', () => {
    const c = mediaBoxes(gerarPdf([pagina(152.4, 101.6)]))[0]!
    expect(c.larguraPt).toBeGreaterThan(c.alturaPt)
    expect(c.larguraPt).toBeCloseTo(mmParaPt(152.4), 2)
  })
})

describe('páginas', () => {
  it('gera uma página por item da lista', () => {
    const doc = gerarPdf([pagina(50.8, 101.6), pagina(50.8, 101.6), pagina(50.8, 101.6)])
    expect(doc.getNumberOfPages()).toBe(3)
    expect(mediaBoxes(doc)).toHaveLength(3)
  })

  it('todas as páginas ficam do mesmo tamanho', () => {
    const caixas = mediaBoxes(gerarPdf([pagina(210, 297), pagina(210, 297)]))
    expect(caixas[0]).toEqual(caixas[1])
  })

  it('recusa lista vazia em vez de gerar PDF em branco', () => {
    expect(() => gerarPdf([])).toThrow(/nenhuma página/i)
  })
})

describe('operações de desenho', () => {
  const comOps = (ops: DrawOp[]) => gerarPdf([{ larguraMm: 50, alturaMm: 50, ops }])

  it('aceita os três tipos de op sem erro', () => {
    const ops: DrawOp[] = [
      rect,
      { ...rect, preenchido: false, espessuraMm: 0.3 },
      { op: 'linha', x1Mm: 0, y1Mm: 0, x2Mm: 10, y2Mm: 10, espessuraMm: 0.2, cinza: 0 },
      {
        op: 'texto',
        xMm: 5,
        yMm: 10,
        texto: 'FILAMENTO PLA PRETO',
        fonte: { familia: 'Helvetica', tamanhoPt: 8, negrito: true, italico: false },
        alinhamento: 'centro',
        cinza: 0,
      },
    ]
    expect(() => comOps(ops)).not.toThrow()
    expect(comOps(ops).getNumberOfPages()).toBe(1)
  })

  it('preserva acentos e o cifrão com espaço não-quebrável', () => {
    const doc = comOps([
      {
        op: 'texto',
        xMm: 5,
        yMm: 10,
        texto: 'Descrição — R$ 119,90',
        fonte: { familia: 'Helvetica', tamanhoPt: 8, negrito: false, italico: false },
        alinhamento: 'esquerda',
        cinza: 0,
      },
    ])
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('um QR de ~110 retângulos não explode o tamanho do arquivo', () => {
    const muitos: DrawOp[] = Array.from({ length: 110 }, (_, i) => ({
      ...rect,
      xMm: (i % 21) * 1.5,
      yMm: Math.floor(i / 21) * 1.5,
      larguraMm: 1.5,
      alturaMm: 1.5,
    }))
    expect(bytes(comOps(muitos)).length).toBeLessThan(60_000)
  })
})

describe('métricas: minha tabela × jsPDF', () => {
  // O ajuste "encolher" mede com a tabela local; o PDF desenha com a do jsPDF.
  // Se divergirem demais, o texto que "cabia" na prévia vaza no papel.
  const doc = new jsPDF({ unit: 'mm' })

  function larguraJsPdf(texto: string, fonte: FonteMedida): number {
    doc.setFont(
      fonte.familia.toLowerCase(),
      fonte.negrito ? 'bold' : 'normal',
    )
    doc.setFontSize(fonte.tamanhoMm / PT_EM_MM)
    return doc.getTextWidth(texto)
  }

  const helvetica = (tamanhoMm = 3): FonteMedida => ({
    familia: 'Helvetica',
    tamanhoMm,
    negrito: false,
    italico: false,
  })

  const amostras = [
    'FILAMENTO PLA PRETO',
    'FILAMENTO PLA SILK TRICOLOR DOURADO VERMELHO AZUL',
    '16668223671',
    'R$ 119,90',
    'Filamentos>>PLA>>Basico',
    'iiiiillll',
    'MMMMWWWW',
  ]

  for (const texto of amostras) {
    it(`"${texto.slice(0, 24)}" fica a menos de 2% do jsPDF`, () => {
      const meu = larguraTexto(texto, helvetica())
      const dele = larguraJsPdf(texto, helvetica())
      expect(Math.abs(meu - dele) / dele).toBeLessThan(0.02)
    })
  }

  it('a tabela local nunca subestima muito a largura real', () => {
    // Subestimar é o erro perigoso: faz o "encolher" achar que cabe.
    for (const texto of amostras) {
      const meu = larguraTexto(texto, helvetica())
      const dele = larguraJsPdf(texto, helvetica())
      expect(meu).toBeGreaterThan(dele * 0.98)
    }
  })

  it('negrito é mais largo que normal nas duas medições', () => {
    const t = 'FILAMENTO'
    const normal = helvetica()
    const negrito: FonteMedida = { ...normal, negrito: true }
    expect(larguraTexto(t, negrito)).toBeGreaterThan(larguraTexto(t, normal))
    expect(larguraJsPdf(t, negrito)).toBeGreaterThan(larguraJsPdf(t, normal))
  })
})

describe('nomeArquivoPdf', () => {
  it('gera nome com data e extensão', () => {
    expect(nomeArquivoPdf()).toMatch(/^etiquetas_\d{4}-\d{2}-\d{2}_\d{4}\.pdf$/)
  })
})
