import { describe, expect, it } from 'vitest'
import {
  calcularGrade,
  celulasDaPagina,
  contarPaginas,
  dimensoes,
  GRADE_PADRAO,
  PRESETS,
  paginaDoPreset,
  posicaoCelula,
  type Grade,
} from './index'

const grade = (p: Partial<Grade> = {}): Grade => ({ ...GRADE_PADRAO, ...p })
const margens = (v: number) => ({ topo: v, direita: v, base: v, esquerda: v })

describe('presets de pagina', () => {
  it('tem as quatro medidas pedidas, em mm', () => {
    const porId = Object.fromEntries(PRESETS.map((p) => [p.id, p]))
    expect(porId['a4']).toMatchObject({ larguraMm: 210, alturaMm: 297 })
    expect(porId['2x4']).toMatchObject({ larguraMm: 50.8, alturaMm: 101.6 })
    expect(porId['4x4']).toMatchObject({ larguraMm: 101.6, alturaMm: 101.6 })
    expect(porId['4x6']).toMatchObject({ larguraMm: 101.6, alturaMm: 152.4 })
  })

  it('paisagem troca largura por altura', () => {
    const p = paginaDoPreset('4x6', 'paisagem')
    expect(dimensoes(p)).toEqual({ larguraMm: 152.4, alturaMm: 101.6 })
  })

  it('retrato mantem as dimensoes', () => {
    expect(dimensoes(paginaDoPreset('4x6'))).toEqual({ larguraMm: 101.6, alturaMm: 152.4 })
  })
})

describe('calcularGrade', () => {
  it('1x1 em 2x4 pol da a pagina inteira menos as margens', () => {
    const r = calcularGrade(paginaDoPreset('2x4'), grade({ margens: margens(3) }))
    expect(r.etiqueta.larguraMm).toBeCloseTo(50.8 - 6, 6)
    expect(r.etiqueta.alturaMm).toBeCloseTo(101.6 - 6, 6)
    expect(r.porPagina).toBe(1)
    expect(r.valida).toBe(true)
  })

  it('A4 3x8 fecha exatamente 210 x 297', () => {
    const g = grade({ colunas: 3, linhas: 8, espacoXMm: 2, espacoYMm: 2, margens: margens(5) })
    const r = calcularGrade(paginaDoPreset('a4'), g)

    const larguraTotal = 5 + 5 + 2 * 2 + 3 * r.etiqueta.larguraMm
    const alturaTotal = 5 + 5 + 7 * 2 + 8 * r.etiqueta.alturaMm

    expect(larguraTotal).toBeCloseTo(210, 6)
    expect(alturaTotal).toBeCloseTo(297, 6)
    expect(r.porPagina).toBe(24)
  })

  it('mais colunas encolhe a etiqueta', () => {
    const pagina = paginaDoPreset('a4')
    const a = calcularGrade(pagina, grade({ colunas: 2 })).etiqueta.larguraMm
    const b = calcularGrade(pagina, grade({ colunas: 4 })).etiqueta.larguraMm
    expect(b).toBeLessThan(a)
  })

  it('mais espaco entre colunas encolhe a etiqueta', () => {
    const pagina = paginaDoPreset('a4')
    const a = calcularGrade(pagina, grade({ colunas: 3, espacoXMm: 0 })).etiqueta.larguraMm
    const b = calcularGrade(pagina, grade({ colunas: 3, espacoXMm: 10 })).etiqueta.larguraMm
    expect(a - b).toBeCloseTo((10 * 2) / 3, 6)
  })

  it('espaco nao e aplicado quando ha uma so coluna', () => {
    const pagina = paginaDoPreset('a4')
    const semEspaco = calcularGrade(pagina, grade({ colunas: 1, espacoXMm: 0 }))
    const comEspaco = calcularGrade(pagina, grade({ colunas: 1, espacoXMm: 20 }))
    expect(comEspaco.etiqueta.larguraMm).toBeCloseTo(semEspaco.etiqueta.larguraMm, 6)
  })

  it('acusa erro quando as margens engolem a etiqueta', () => {
    const r = calcularGrade(paginaDoPreset('2x4'), grade({ margens: margens(25) }))
    expect(r.valida).toBe(false)
    expect(r.erros.join(' ')).toMatch(/largura/i)
  })

  it('acusa erro quando ha colunas demais para a pagina', () => {
    const r = calcularGrade(paginaDoPreset('2x4'), grade({ colunas: 30 }))
    expect(r.valida).toBe(false)
  })

  it('trata colunas/linhas invalidas como 1', () => {
    const r = calcularGrade(paginaDoPreset('a4'), grade({ colunas: 0, linhas: -3 }))
    expect(r.porPagina).toBe(1)
  })
})

describe('modo porEtiqueta', () => {
  const porEtiqueta = (p: Partial<Grade> = {}) => grade({ modo: 'porEtiqueta', ...p })

  it('deriva quantas etiquetas cabem, deixando sobra', () => {
    // Util: 210-10 = 200 mm. Com etiqueta 60 e espaco 0: cabem 3, sobram 20.
    const g = porEtiqueta({
      etiquetaLarguraMm: 60,
      etiquetaAlturaMm: 40,
      espacoXMm: 0,
      espacoYMm: 0,
      margens: margens(5),
    })
    const r = calcularGrade(paginaDoPreset('a4'), g)

    expect(r.colunas).toBe(3)
    expect(r.sobra.larguraMm).toBeCloseTo(20, 6)
    expect(r.etiqueta.larguraMm).toBe(60)
    expect(r.valida).toBe(true)
  })

  it('nao cobra espaco depois da ultima etiqueta', () => {
    // Util 200, etiqueta 60, espaco 10: 3*60 + 2*10 = 200. Cabem 3, sobra 0.
    // Somando o espaco tambem no fim daria 190+10 > 200 e caberiam so 2.
    const g = porEtiqueta({
      etiquetaLarguraMm: 60,
      etiquetaAlturaMm: 40,
      espacoXMm: 10,
      margens: margens(5),
    })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    expect(r.colunas).toBe(3)
    expect(r.sobra.larguraMm).toBeCloseTo(0, 6)
  })

  it('respeita o tamanho pedido mesmo sobrando espaco', () => {
    const g = porEtiqueta({
      etiquetaLarguraMm: 30,
      etiquetaAlturaMm: 20,
      espacoXMm: 0,
      espacoYMm: 0,
      margens: margens(0),
    })
    const r = calcularGrade(paginaDoPreset('4x4'), g)
    // Util 101,6: cabem 3 de 30 mm, sobram 11,6.
    expect(r.colunas).toBe(3)
    expect(r.linhas).toBe(5)
    expect(r.porPagina).toBe(15)
    expect(r.sobra.larguraMm).toBeCloseTo(11.6, 6)
    expect(r.sobra.alturaMm).toBeCloseTo(1.6, 6)
  })

  it('acusa erro quando a etiqueta nao cabe na pagina', () => {
    const g = porEtiqueta({ etiquetaLarguraMm: 300, etiquetaAlturaMm: 40 })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    expect(r.valida).toBe(false)
    expect(r.colunas).toBe(0)
    expect(r.porPagina).toBe(0)
    expect(r.erros.join(' ')).toMatch(/não cabe/i)
  })

  it('acusa erro para etiqueta pequena demais', () => {
    const g = porEtiqueta({ etiquetaLarguraMm: 2, etiquetaAlturaMm: 2 })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    expect(r.valida).toBe(false)
    expect(r.erros.join(' ')).toMatch(/pelo menos/i)
  })

  it('arredondar a etiqueta para baixo preserva a grade; para cima derruba uma coluna', () => {
    // A4, margem 3, 3 colunas, espaco 2 -> etiqueta de 66,666... mm de largura.
    // Arredondar para 66,7 faz 3 * 66,7 + 2 * 2 = 204,1 > 204 de area util,
    // e a grade cai para 2 colunas. Este e o bug que a troca de modo tinha.
    const original = calcularGrade(
      paginaDoPreset('a4'),
      grade({ colunas: 3, linhas: 8, espacoXMm: 2, espacoYMm: 2, margens: margens(3) }),
    )
    expect(original.etiqueta.larguraMm).toBeCloseTo(66.6667, 3)

    const comBase = (largura: number) =>
      calcularGrade(
        paginaDoPreset('a4'),
        porEtiqueta({
          etiquetaLarguraMm: largura,
          etiquetaAlturaMm: Math.floor(original.etiqueta.alturaMm * 10) / 10,
          espacoXMm: 2,
          espacoYMm: 2,
          margens: margens(3),
        }),
      ).colunas

    expect(comBase(Math.floor(original.etiqueta.larguraMm * 10) / 10)).toBe(3)
    expect(comBase(Math.round(original.etiqueta.larguraMm * 10) / 10)).toBe(2)
  })

  it('no modo porGrade a sobra e sempre zero', () => {
    const r = calcularGrade(paginaDoPreset('a4'), grade({ colunas: 3, linhas: 8 }))
    expect(r.sobra).toEqual({ larguraMm: 0, alturaMm: 0 })
  })
})

describe('posicaoCelula', () => {
  it('a primeira celula fica no canto das margens', () => {
    const g = grade({ colunas: 3, linhas: 2, margens: margens(5) })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    expect(posicaoCelula(g, r, 0)).toEqual({ xMm: 5, yMm: 5 })
  })

  it('avanca em coluna e depois quebra para a linha de baixo', () => {
    const g = grade({ colunas: 3, linhas: 2, espacoXMm: 2, espacoYMm: 2, margens: margens(5) })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    const { etiqueta } = r

    expect(posicaoCelula(g, r, 1).xMm).toBeCloseTo(5 + etiqueta.larguraMm + 2, 6)
    expect(posicaoCelula(g, r, 1).yMm).toBeCloseTo(5, 6)
    // indice 3 = comeco da segunda linha
    expect(posicaoCelula(g, r, 3).xMm).toBeCloseTo(5, 6)
    expect(posicaoCelula(g, r, 3).yMm).toBeCloseTo(5 + etiqueta.alturaMm + 2, 6)
  })

  it('a ultima celula termina exatamente na margem oposta', () => {
    const g = grade({ colunas: 3, linhas: 8, espacoXMm: 2, espacoYMm: 2, margens: margens(5) })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    const p = posicaoCelula(g, r, 23)

    expect(p.xMm + r.etiqueta.larguraMm).toBeCloseTo(210 - 5, 6)
    expect(p.yMm + r.etiqueta.alturaMm).toBeCloseTo(297 - 5, 6)
  })

  it('no modo porEtiqueta a ultima celula deixa a sobra a direita', () => {
    const g = grade({
      modo: 'porEtiqueta',
      etiquetaLarguraMm: 60,
      etiquetaAlturaMm: 40,
      espacoXMm: 0,
      espacoYMm: 0,
      margens: margens(5),
    })
    const r = calcularGrade(paginaDoPreset('a4'), g)
    const ultima = posicaoCelula(g, r, r.colunas - 1)

    expect(ultima.xMm + r.etiqueta.larguraMm).toBeCloseTo(210 - 5 - r.sobra.larguraMm, 6)
  })
})

describe('contarPaginas', () => {
  it('84 etiquetas em folhas de 24 dao 4 paginas', () => {
    expect(contarPaginas(84, 24)).toBe(4)
  })

  it('uma etiqueta por pagina em etiquetadora', () => {
    expect(contarPaginas(84, 1)).toBe(84)
  })

  it('divisao exata nao cria pagina sobrando', () => {
    expect(contarPaginas(48, 24)).toBe(2)
  })

  it('zero etiquetas dao zero paginas', () => {
    expect(contarPaginas(0, 24)).toBe(0)
  })

  it('pular celulas pode acrescentar uma pagina', () => {
    // 24 etiquetas cabem em 1 folha; pulando 5, passam a precisar de 2.
    expect(contarPaginas(24, 24)).toBe(1)
    expect(contarPaginas(24, 24, 5)).toBe(2)
  })
})

describe('celulasDaPagina', () => {
  it('preenche a pagina cheia em ordem', () => {
    expect(celulasDaPagina(10, 4, 0)).toEqual([0, 1, 2, 3])
    expect(celulasDaPagina(10, 4, 1)).toEqual([4, 5, 6, 7])
  })

  it('deixa as sobras vazias na ultima pagina', () => {
    expect(celulasDaPagina(10, 4, 2)).toEqual([8, 9, null, null])
  })

  it('pula as celulas iniciais de uma folha ja usada', () => {
    expect(celulasDaPagina(10, 4, 0, 2)).toEqual([null, null, 0, 1])
    expect(celulasDaPagina(10, 4, 1, 2)).toEqual([2, 3, 4, 5])
  })
})
