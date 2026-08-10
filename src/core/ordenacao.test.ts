import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerCsv, type LinhaCsv, type Planilha } from './csv'
import { ordenar, proximaOrdem } from './ordenacao'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')
const planilhaReal = (): Planilha => lerCsv(new Uint8Array(readFileSync(CSV_REAL)))

function planilhaDe(linhas: LinhaCsv[], colunas: string[]): Planilha {
  return {
    colunas,
    linhas,
    meta: {
      encoding: 'utf-8',
      tinhaBom: false,
      delimitador: ';',
      linhasBrutas: linhas.length,
      linhasVazias: 0,
    },
    avisos: [],
  }
}

const todos = (p: Planilha) => p.linhas.map((_, i) => i)
const valores = (p: Planilha, indices: number[], coluna: string) =>
  indices.map((i) => p.linhas[i]?.[coluna])

describe('ordenar', () => {
  it('devolve a ordem original quando nao ha ordenacao', () => {
    const p = planilhaDe([{ A: 'c' }, { A: 'a' }, { A: 'b' }], ['A'])
    expect(ordenar(p, todos(p), null)).toEqual([0, 1, 2])
  })

  it('ordena texto respeitando o portugues', () => {
    const p = planilhaDe([{ A: 'Único' }, { A: 'Amarelo' }, { A: 'Ébano' }], ['A'])
    const r = ordenar(p, todos(p), { coluna: 'A', direcao: 'asc' })
    expect(valores(p, r, 'A')).toEqual(['Amarelo', 'Ébano', 'Único'])
  })

  it('ordena numeros como numeros, nao como texto', () => {
    const p = planilhaDe([{ N: '9' }, { N: '10' }, { N: '1' }], ['N'])
    const r = ordenar(p, todos(p), { coluna: 'N', direcao: 'asc' })
    expect(valores(p, r, 'N')).toEqual(['1', '9', '10'])
  })

  it('ordena preco no formato brasileiro pelo valor', () => {
    // Por texto, "1.234,56" viria antes de "999,00".
    const p = planilhaDe([{ P: '1.234,56' }, { P: '999,00' }, { P: '119,90' }], ['P'])
    const r = ordenar(p, todos(p), { coluna: 'P', direcao: 'asc' })
    expect(valores(p, r, 'P')).toEqual(['119,90', '999,00', '1.234,56'])
  })

  it('inverte na direcao decrescente', () => {
    const p = planilhaDe([{ N: '1' }, { N: '3' }, { N: '2' }], ['N'])
    const r = ordenar(p, todos(p), { coluna: 'N', direcao: 'desc' })
    expect(valores(p, r, 'N')).toEqual(['3', '2', '1'])
  })

  it('joga os vazios para o fim na ordem crescente', () => {
    const p = planilhaDe([{ C: '' }, { C: '2' }, { C: '' }, { C: '1' }], ['C'])
    const r = ordenar(p, todos(p), { coluna: 'C', direcao: 'asc' })
    expect(valores(p, r, 'C')).toEqual(['1', '2', '', ''])
  })

  it('mantem os vazios no fim TAMBEM na ordem decrescente', () => {
    // Se os vazios subissem, os 10 produtos sem GTIN/EAN tomariam o topo.
    const p = planilhaDe([{ C: '' }, { C: '2' }, { C: '' }, { C: '1' }], ['C'])
    const r = ordenar(p, todos(p), { coluna: 'C', direcao: 'desc' })
    expect(valores(p, r, 'C')).toEqual(['2', '1', '', ''])
  })

  it('e estavel: empates mantem a ordem do arquivo', () => {
    const p = planilhaDe([{ A: 'x', id: '1' }, { A: 'x', id: '2' }, { A: 'x', id: '3' }], ['A', 'id'])
    const r = ordenar(p, todos(p), { coluna: 'A', direcao: 'asc' })
    expect(valores(p, r, 'id')).toEqual(['1', '2', '3'])
  })

  it('nao altera o array recebido', () => {
    const p = planilhaDe([{ N: '3' }, { N: '1' }], ['N'])
    const entrada = todos(p)
    ordenar(p, entrada, { coluna: 'N', direcao: 'asc' })
    expect(entrada).toEqual([0, 1])
  })

  it('ordena apenas os indices recebidos, respeitando o filtro', () => {
    const p = planilhaDe([{ N: '3' }, { N: '1' }, { N: '2' }], ['N'])
    const r = ordenar(p, [0, 2], { coluna: 'N', direcao: 'asc' })
    expect(r).toEqual([2, 0])
  })
})

describe('proximaOrdem', () => {
  it('primeiro clique numa coluna nova ordena crescente', () => {
    expect(proximaOrdem(null, 'A')).toEqual({ coluna: 'A', direcao: 'asc' })
    expect(proximaOrdem({ coluna: 'B', direcao: 'desc' }, 'A')).toEqual({
      coluna: 'A',
      direcao: 'asc',
    })
  })

  it('segundo clique inverte', () => {
    expect(proximaOrdem({ coluna: 'A', direcao: 'asc' }, 'A')).toEqual({
      coluna: 'A',
      direcao: 'desc',
    })
  })

  it('terceiro clique volta a ordem do arquivo', () => {
    expect(proximaOrdem({ coluna: 'A', direcao: 'desc' }, 'A')).toBeNull()
  })
})

describe('com o arquivo real do Bling', () => {
  it('ordena por GTIN/EAN pondo os 10 sem codigo no fim', () => {
    const p = planilhaReal()
    const r = ordenar(p, todos(p), { coluna: 'GTIN/EAN', direcao: 'asc' })
    const lista = valores(p, r, 'GTIN/EAN')
    expect(lista.slice(0, 2)).toEqual(['7898757180990', '7898757181218'])
    expect(lista.slice(2).every((v) => v === '')).toBe(true)
  })

  it('ordena por Codigo numericamente', () => {
    const p = planilhaReal()
    const r = ordenar(p, todos(p), { coluna: 'Código', direcao: 'desc' })
    expect(valores(p, r, 'Código').slice(0, 3)).toEqual(['272', '271', '270'])
  })

  it('ordena por Estoque pelo valor, nao pelo texto "42,0000"', () => {
    const p = planilhaReal()
    const r = ordenar(p, todos(p), { coluna: 'Estoque', direcao: 'desc' })
    expect(valores(p, r, 'Estoque')?.[0]).toBe('42,0000')
  })
})
