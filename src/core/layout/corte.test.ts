import { describe, expect, it } from 'vitest'
import { calcularGrade, GRADE_PADRAO, paginaDoPreset, type Grade } from './index'
import { CORTE_PADRAO, opsDeCorte, posicoesDeCorte, type ConfigCorte } from './corte'

const grade = (p: Partial<Grade> = {}): Grade => ({ ...GRADE_PADRAO, ...p })
const margens = (v: number) => ({ topo: v, direita: v, base: v, esquerda: v })
const corte = (p: Partial<ConfigCorte> = {}): ConfigCorte => ({ ...CORTE_PADRAO, ...p })

describe('posicoesDeCorte', () => {
  it('uma etiqueta rende só as duas bordas', () => {
    expect(posicoesDeCorte(10, 1, 50, 4)).toEqual([10, 60])
  })

  it('corta no MEIO do espaço entre etiquetas', () => {
    // Início 10, 3 etiquetas de 50, espaço 4.
    // Etiqueta 0: 10–60. Espaço: 60–64, meio em 62.
    // Etiqueta 1: 64–114. Espaço: 114–118, meio em 116.
    // Etiqueta 2: 118–168.
    expect(posicoesDeCorte(10, 3, 50, 4)).toEqual([10, 62, 116, 168])
  })

  it('com espaço 0 o meio é a borda compartilhada', () => {
    // Grade colada: um corte só serve às duas etiquetas vizinhas.
    expect(posicoesDeCorte(0, 3, 50, 0)).toEqual([0, 50, 100, 150])
  })

  it('sempre rende quantidade + 1 posições', () => {
    for (const n of [1, 2, 5, 12]) {
      expect(posicoesDeCorte(5, n, 20, 3)).toHaveLength(n + 1)
    }
  })

  it('as posições ficam em ordem crescente', () => {
    const p = posicoesDeCorte(5, 6, 20, 3)
    for (let i = 1; i < p.length; i++) expect(p[i]!).toBeGreaterThan(p[i - 1]!)
  })
})

describe('opsDeCorte', () => {
  const pagina = paginaDoPreset('a4')
  const g = grade({ colunas: 3, linhas: 8, espacoXMm: 2, espacoYMm: 2, margens: margens(5) })
  const resultado = calcularGrade(pagina, g)

  it('não gera nada quando desligado', () => {
    expect(opsDeCorte(g, resultado, corte({ estilo: 'nenhum' }))).toEqual([])
  })

  it('não gera nada com grade inválida', () => {
    const ruim = grade({ colunas: 40, linhas: 40 })
    const r = calcularGrade(pagina, ruim)
    expect(opsDeCorte(ruim, r, corte({ estilo: 'linhas' }))).toEqual([])
  })

  it('linhas: uma por corredor mais as bordas', () => {
    const ops = opsDeCorte(g, resultado, corte({ estilo: 'linhas' }))
    // 3 colunas -> 4 verticais; 8 linhas -> 9 horizontais.
    expect(ops).toHaveLength(4 + 9)
  })

  it('linhas atravessam a folha inteira', () => {
    const ops = opsDeCorte(g, resultado, corte({ estilo: 'linhas' }))
    const verticais = ops.filter((o) => o.op === 'linha' && o.x1Mm === o.x2Mm)

    for (const v of verticais) {
      if (v.op !== 'linha') throw new Error('esperava linha')
      expect(v.y1Mm).toBe(0)
      expect(v.y2Mm).toBe(297)
    }
  })

  it('nenhuma linha cruza uma etiqueta', () => {
    // É a garantia que permite riscar a folha toda sem estragar a impressão.
    const ops = opsDeCorte(g, resultado, corte({ estilo: 'linhas' }))
    const { larguraMm } = resultado.etiqueta

    const verticais = ops
      .filter((o) => o.op === 'linha' && o.x1Mm === o.x2Mm)
      .map((o) => (o.op === 'linha' ? o.x1Mm : 0))

    for (let coluna = 0; coluna < resultado.colunas; coluna++) {
      const esq = g.margens.esquerda + coluna * (larguraMm + g.espacoXMm)
      const dir = esq + larguraMm
      // Tolerância mínima: a borda compartilhada é limite, não invasão.
      for (const x of verticais) {
        expect(x > esq + 1e-6 && x < dir - 1e-6).toBe(false)
      }
    }
  })

  it('marcas: só ticks nas bordas do papel', () => {
    const ops = opsDeCorte(g, resultado, corte({ estilo: 'marcas', marcaMm: 3 }))
    // 4 verticais x 2 pontas + 9 horizontais x 2 pontas.
    expect(ops).toHaveLength((4 + 9) * 2)

    for (const op of ops) {
      if (op.op !== 'linha') throw new Error('esperava linha')
      const comprimento = Math.hypot(op.x2Mm - op.x1Mm, op.y2Mm - op.y1Mm)
      expect(comprimento).toBeCloseTo(3, 6)
    }
  })

  it('marcas encostam nas bordas do papel', () => {
    const ops = opsDeCorte(g, resultado, corte({ estilo: 'marcas', marcaMm: 3 }))
    for (const op of ops) {
      if (op.op !== 'linha') throw new Error('esperava linha')
      const naBorda =
        op.x1Mm === 0 || op.y1Mm === 0 || op.x2Mm === 210 || op.y2Mm === 297
      expect(naBorda).toBe(true)
    }
  })

  it('etiquetadora 1×1 rende um retângulo de corte', () => {
    const g1 = grade({ colunas: 1, linhas: 1, margens: margens(3) })
    const r1 = calcularGrade(paginaDoPreset('2x4'), g1)
    expect(opsDeCorte(g1, r1, corte({ estilo: 'linhas' }))).toHaveLength(2 + 2)
  })
})
