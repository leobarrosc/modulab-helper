import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerCsv } from '../csv'
import { modeloPadrao } from '../etiqueta/modelo'
import { calcularGrade, GRADE_PADRAO, paginaDoPreset, type Grade } from '../layout'
import { filaEtiquetas, selecaoInicial } from '../produtos'
import { montarFolhas } from './folha'
import { opsParaSvg, paginaParaSvg } from './svg'
import type { DrawOp } from './tipos'

const planilha = lerCsv(
  new Uint8Array(readFileSync(join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv'))),
)

const grade = (p: Partial<Grade> = {}): Grade => ({ ...GRADE_PADRAO, ...p })

function montar(g: Grade, preset: 'a4' | '2x4' = 'a4', pular = 0) {
  const pagina = paginaDoPreset(preset)
  const resultado = calcularGrade(pagina, g)
  const selecionados = selecaoInicial(planilha, 'Código')
  const indices = planilha.linhas.map((_, i) => i)
  const fila = filaEtiquetas(planilha, indices, selecionados, new Map(), true)

  return {
    fila,
    resultado,
    folhas: montarFolhas({
      planilha,
      fila,
      modelo: modeloPadrao(),
      grade: g,
      resultado,
      pularCelulas: pular,
    }),
  }
}

describe('montarFolhas com o arquivo real', () => {
  it('84 etiquetas numa grade 3×8 dão 4 folhas', () => {
    const { fila, folhas } = montar(grade({ colunas: 3, linhas: 8 }))
    expect(fila).toHaveLength(84)
    expect(folhas.totalEtiquetas).toBe(84)
    expect(folhas.paginas).toHaveLength(4)
  })

  it('cada folha tem o tamanho da página, não da etiqueta', () => {
    const { folhas } = montar(grade({ colunas: 3, linhas: 8 }))
    for (const p of folhas.paginas) {
      expect(p.larguraMm).toBe(210)
      expect(p.alturaMm).toBe(297)
    }
  })

  it('a última folha tem menos conteúdo que uma cheia', () => {
    // 84 em folhas de 24: a quarta leva só 12.
    const { folhas } = montar(grade({ colunas: 3, linhas: 8 }))
    expect(folhas.paginas.at(-1)!.ops.length).toBeLessThan(folhas.paginas[0]!.ops.length)
  })

  it('todas as ops ficam dentro da página', () => {
    const { folhas } = montar(grade({ colunas: 3, linhas: 8 }))
    for (const pagina of folhas.paginas) {
      for (const op of pagina.ops) {
        if (op.op !== 'rect') continue
        expect(op.xMm).toBeGreaterThanOrEqual(-1e-6)
        expect(op.yMm).toBeGreaterThanOrEqual(-1e-6)
        expect(op.xMm + op.larguraMm).toBeLessThanOrEqual(pagina.larguraMm + 1e-6)
        expect(op.yMm + op.alturaMm).toBeLessThanOrEqual(pagina.alturaMm + 1e-6)
      }
    }
  })

  it('as etiquetas ocupam colunas diferentes na mesma linha', () => {
    // Se o deslocamento por célula falhasse, tudo se empilharia no mesmo x.
    const { folhas } = montar(grade({ colunas: 3, linhas: 8 }))
    const xs = new Set(folhas.paginas[0]!.ops.map((o) => (o.op === 'texto' ? Math.round(o.xMm) : -1)))
    xs.delete(-1)
    expect(xs.size).toBeGreaterThanOrEqual(3)
  })

  it('pular células empurra a primeira etiqueta para frente', () => {
    const semPular = montar(grade({ colunas: 3, linhas: 8 }))
    const pulando = montar(grade({ colunas: 3, linhas: 8 }), 'a4', 5)

    const primeiroY = (f: typeof semPular.folhas) => {
      const textos = f.paginas[0]!.ops.filter((o) => o.op === 'texto')
      return Math.min(...textos.map((o) => (o.op === 'texto' ? o.yMm : Infinity)))
    }

    expect(primeiroY(pulando.folhas)).toBeGreaterThan(primeiroY(semPular.folhas))
    expect(pulando.folhas.paginas.length).toBeGreaterThanOrEqual(semPular.folhas.paginas.length)
  })

  it('uma etiqueta por folha na etiquetadora', () => {
    const { folhas } = montar(grade({ colunas: 1, linhas: 1 }), '2x4')
    expect(folhas.paginas).toHaveLength(84)
    expect(folhas.paginas[0]!.larguraMm).toBe(50.8)
  })

  it('devolve vazio quando a grade é inválida', () => {
    const { folhas } = montar(grade({ colunas: 40, linhas: 40 }))
    expect(folhas.paginas).toEqual([])
    expect(folhas.totalEtiquetas).toBe(0)
  })

  it('deduplica problemas repetidos em todas as etiquetas', () => {
    // Com EAN-13 e códigos de 3 dígitos, as 84 falham pelo mesmo motivo:
    // tem que sair UM aviso, não 84.
    const g = grade({ colunas: 3, linhas: 8 })
    const pagina = paginaDoPreset('a4')
    const resultado = calcularGrade(pagina, g)
    const base = modeloPadrao()
    const modelo = {
      ...base,
      campos: base.campos.map((c) => (c.tipo === 'codigo' ? { ...c, simbologia: 'ean13' } : c)),
    }

    const selecionados = selecaoInicial(planilha, 'Código')
    const fila = filaEtiquetas(
      planilha,
      planilha.linhas.map((_, i) => i),
      selecionados,
      new Map(),
      true,
    )

    const folhas = montarFolhas({ planilha, fila, modelo, grade: g, resultado, pularCelulas: 0 })
    expect(folhas.problemas).toHaveLength(1)
    expect(folhas.problemas[0]!.mensagem).toMatch(/EAN-13/)
  })
})

describe('svg', () => {
  const rect: DrawOp = {
    op: 'rect',
    xMm: 1,
    yMm: 2,
    larguraMm: 3,
    alturaMm: 4,
    cinza: 0,
    preenchido: true,
  }

  it('barra preenchida usa crispEdges', () => {
    // Sem isso aparece costura clara entre barras vizinhas.
    expect(opsParaSvg([rect])).toContain('shape-rendering="crispEdges"')
  })

  it('retângulo sem preenchimento vira contorno', () => {
    const svg = opsParaSvg([{ ...rect, preenchido: false, espessuraMm: 0.3 }])
    expect(svg).toContain('fill="none"')
    expect(svg).toContain('stroke-width="0.3"')
  })

  it('cinza vira tom de cinza, nunca cor', () => {
    const svg = opsParaSvg([{ ...rect, cinza: 0.5 }])
    expect(svg).toContain('rgb(128,128,128)')
  })

  it('escapa XML no texto', () => {
    const svg = opsParaSvg([
      {
        op: 'texto',
        xMm: 0,
        yMm: 0,
        texto: 'A & B <c> "d"',
        fonte: { familia: 'Helvetica', tamanhoPt: 8, negrito: false, italico: false },
        alinhamento: 'esquerda',
        cinza: 0,
      },
    ])
    expect(svg).toContain('A &amp; B &lt;c&gt;')
    expect(svg).not.toMatch(/<c>/)
  })

  it('converte o tamanho da fonte de pt para mm', () => {
    const svg = opsParaSvg([
      {
        op: 'texto',
        xMm: 0,
        yMm: 0,
        texto: 'x',
        fonte: { familia: 'Helvetica', tamanhoPt: 72, negrito: false, italico: false },
        alinhamento: 'esquerda',
        cinza: 0,
      },
    ])
    // 72 pt = 1 pol = 25,4 mm
    expect(svg).toContain('font-size="25.4"')
  })

  it('a página declara tamanho em mm e viewBox correspondente', () => {
    const svg = paginaParaSvg([rect], 50.8, 101.6)
    expect(svg).toContain('width="50.8mm"')
    expect(svg).toContain('height="101.6mm"')
    expect(svg).toContain('viewBox="0 0 50.8 101.6"')
  })

  it('corta casas decimais inúteis', () => {
    expect(opsParaSvg([{ ...rect, xMm: 0.1 + 0.2 }])).toContain('x="0.3"')
  })
})
