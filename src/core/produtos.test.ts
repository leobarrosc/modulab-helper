import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerCsv, type LinhaCsv, type Planilha } from './csv'
import {
  bloqueada,
  contarSemCodigo,
  contarSemEstoque,
  estoqueContavel,
  estoqueDe,
  etiquetasDaLinha,
  fonteEfetiva,
  fontesDisponiveis,
  purgarBloqueadas,
  selecaoInicial,
  semCodigo,
  semEstoque,
  temEstoque,
  totalEtiquetas,
  valorCodigo,
} from './produtos'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')
const planilhaReal = (): Planilha => lerCsv(new Uint8Array(readFileSync(CSV_REAL)))

const linha = (estoque?: string): LinhaCsv =>
  estoque === undefined ? { Descrição: 'X' } : { Descrição: 'X', Estoque: estoque }

describe('estoqueDe', () => {
  it('le o formato do Bling', () => {
    expect(estoqueDe(linha('42,0000'))).toBe(42)
  })

  it('devolve null quando a coluna nao existe', () => {
    expect(estoqueDe(linha())).toBeNull()
  })

  it('devolve null para valor nao numerico', () => {
    expect(estoqueDe(linha('indefinido'))).toBeNull()
  })
})

describe('estoqueContavel', () => {
  it('arredonda para baixo -- nao existe meia etiqueta', () => {
    expect(estoqueContavel(linha('1,5000'))).toBe(1)
    expect(estoqueContavel(linha('0,9000'))).toBe(0)
  })

  it('trava estoque negativo em zero', () => {
    // O Bling permite estoque negativo; sem a trava isso subtrairia do total.
    expect(estoqueContavel(linha('-3,0000'))).toBe(0)
  })
})

describe('etiquetasDaLinha', () => {
  it('multiplica quantidade por estoque', () => {
    expect(etiquetasDaLinha(linha('42,0000'), 1, true)).toBe(42)
    expect(etiquetasDaLinha(linha('42,0000'), 2, true)).toBe(84)
  })

  it('ignora o estoque quando o multiplicador esta desligado', () => {
    expect(etiquetasDaLinha(linha('42,0000'), 1, false)).toBe(1)
    expect(etiquetasDaLinha(linha('42,0000'), 3, false)).toBe(3)
  })

  it('rende zero para estoque zerado quando multiplicando', () => {
    expect(etiquetasDaLinha(linha('0,0000'), 5, true)).toBe(0)
  })

  it('cai para a quantidade pedida quando nao ha estoque legivel', () => {
    // Melhor imprimir o pedido do que zerar a linha silenciosamente.
    expect(etiquetasDaLinha(linha(), 3, true)).toBe(3)
    expect(etiquetasDaLinha(linha('indefinido'), 3, true)).toBe(3)
  })

  it('trata quantidade invalida como 1', () => {
    expect(etiquetasDaLinha(linha('4,0000'), 0, true)).toBe(4)
    expect(etiquetasDaLinha(linha('4,0000'), Number.NaN, true)).toBe(4)
  })
})

describe('semEstoque', () => {
  it('considera zero e negativo como sem estoque', () => {
    expect(semEstoque(linha('0,0000'))).toBe(true)
    expect(semEstoque(linha('-2,0000'))).toBe(true)
  })

  it('nao considera sem estoque quando a coluna falta', () => {
    expect(semEstoque(linha())).toBe(false)
  })
})

describe('bloqueada', () => {
  it('trava produto zerado quando multiplicando', () => {
    expect(bloqueada(linha('0,0000'), true)).toBe(true)
  })

  it('destrava o mesmo produto se o multiplicador for desligado', () => {
    // Sem multiplicar, um zerado ainda rende as etiquetas pedidas.
    expect(bloqueada(linha('0,0000'), false)).toBe(false)
  })

  it('nao trava produto com estoque', () => {
    expect(bloqueada(linha('1,0000'), true)).toBe(false)
  })

  it('nao trava quando nao ha coluna de estoque', () => {
    expect(bloqueada(linha(), true)).toBe(false)
  })
})

describe('purgarBloqueadas', () => {
  const planilha = (): Planilha => ({
    colunas: ['Descrição', 'Estoque'],
    linhas: [linha('4,0000'), linha('0,0000'), linha('2,0000')],
    meta: {
      encoding: 'utf-8',
      tinhaBom: false,
      delimitador: ';',
      linhasBrutas: 3,
      linhasVazias: 0,
    },
    avisos: [],
  })

  it('tira da selecao o que passou a render zero', () => {
    const restantes = purgarBloqueadas(planilha(), new Set([0, 1, 2]), true)
    expect([...restantes]).toEqual([0, 2])
  })

  it('nao mexe na selecao com o multiplicador desligado', () => {
    const restantes = purgarBloqueadas(planilha(), new Set([0, 1, 2]), false)
    expect([...restantes]).toEqual([0, 1, 2])
  })
})

describe('fonte do codigo de barras', () => {
  const comAmbas = (): Planilha => ({
    colunas: ['Código', 'GTIN/EAN'],
    linhas: [
      { 'Código': '261', 'GTIN/EAN': '7898757181218' },
      { 'Código': '262', 'GTIN/EAN': '' },
    ],
    meta: { encoding: 'utf-8', tinhaBom: false, delimitador: ';', linhasBrutas: 2, linhasVazias: 0 },
    avisos: [],
  })

  it('le o valor da coluna escolhida', () => {
    const p = comAmbas()
    expect(valorCodigo(p.linhas[0]!, 'GTIN/EAN')).toBe('7898757181218')
    expect(valorCodigo(p.linhas[0]!, 'Código')).toBe('261')
  })

  it('detecta a linha sem valor na fonte escolhida', () => {
    const p = comAmbas()
    expect(semCodigo(p.linhas[1]!, 'GTIN/EAN')).toBe(true)
    expect(semCodigo(p.linhas[1]!, 'Código')).toBe(false)
  })

  it('cai para a fonte que existe quando a preferida falta', () => {
    const soCodigo: Planilha = { ...comAmbas(), colunas: ['Código'] }
    expect(fonteEfetiva(soCodigo, 'GTIN/EAN')).toBe('Código')
    expect(fontesDisponiveis(soCodigo)).toEqual(['Código'])
  })

  it('mantem a preferida quando ela existe', () => {
    expect(fonteEfetiva(comAmbas(), 'GTIN/EAN')).toBe('GTIN/EAN')
  })

  it('nao conta faltantes se a coluna nem existe no arquivo', () => {
    const soCodigo: Planilha = { ...comAmbas(), colunas: ['Código'] }
    expect(contarSemCodigo(soCodigo, 'GTIN/EAN')).toBe(0)
  })

  it('desmarca quem esta sem valor na fonte escolhida', () => {
    const p = comAmbas()
    expect([...selecaoInicial(p, 'GTIN/EAN')]).toEqual([0])
    expect([...selecaoInicial(p, 'Código')]).toEqual([0, 1])
  })

  it('nao zera a selecao quando a coluna escolhida nao existe', () => {
    // Sem essa guarda, um CSV sem GTIN/EAN abriria com zero produtos marcados.
    const soCodigo: Planilha = { ...comAmbas(), colunas: ['Código'] }
    expect(selecaoInicial(soCodigo, 'GTIN/EAN').size).toBe(2)
  })
})

describe('com o arquivo real do Bling', () => {
  it('reconhece a coluna Estoque', () => {
    expect(temEstoque(planilhaReal())).toBe(true)
  })

  it('acha exatamente 1 produto zerado -- o codigo 272', () => {
    const p = planilhaReal()
    expect(contarSemEstoque(p)).toBe(1)
    const zerados = p.linhas.filter(semEstoque)
    expect(zerados[0]?.['Código']).toBe('272')
  })

  it('desmarca o zerado na selecao inicial', () => {
    const p = planilhaReal()
    const sel = selecaoInicial(p, 'Código')
    expect(sel.size).toBe(11)
    const indiceDo272 = p.linhas.findIndex((l) => l['Código'] === '272')
    expect(sel.has(indiceDo272)).toBe(false)
  })

  it('o codigo 261 com 42 em estoque rende 42 etiquetas', () => {
    const p = planilhaReal()
    const l261 = p.linhas.find((l) => l['Código'] === '261')!
    expect(etiquetasDaLinha(l261, 1, true)).toBe(42)
  })

  it('soma 84 etiquetas para os 11 produtos com estoque', () => {
    // 42+4+4+5+3+1+9+4+4+4+4 = 84 (o 272, zerado, esta fora da selecao)
    const p = planilhaReal()
    const total = totalEtiquetas(p, selecaoInicial(p, 'Código'), new Map(), true)
    expect(total).toBe(84)
  })

  it('soma 11 etiquetas com o multiplicador desligado', () => {
    const p = planilhaReal()
    expect(totalEtiquetas(p, selecaoInicial(p, 'Código'), new Map(), false)).toBe(11)
  })

  it('com GTIN/EAN padrao, so 2 dos 12 produtos ficam marcados', () => {
    // Consequencia real do arquivo: 10 produtos nao tem GTIN/EAN.
    const p = planilhaReal()
    expect(contarSemCodigo(p, 'GTIN/EAN')).toBe(10)
    expect(selecaoInicial(p, 'GTIN/EAN').size).toBe(2)
  })

  it('trocar para Codigo devolve os 11 com estoque', () => {
    const p = planilhaReal()
    expect(contarSemCodigo(p, 'Código')).toBe(0)
    expect(selecaoInicial(p, 'Código').size).toBe(11)
  })

  it('o zerado 272 fica de fora mesmo tendo Codigo', () => {
    const p = planilhaReal()
    const sel = selecaoInicial(p, 'Código')
    const i272 = p.linhas.findIndex((l) => l['Código'] === '272')
    expect(sel.has(i272)).toBe(false)
  })

  it('aplica a quantidade por linha em cima do estoque', () => {
    const p = planilhaReal()
    const indiceDo261 = p.linhas.findIndex((l) => l['Código'] === '261')
    // 261 vai a 2x: 84 - 42 + 84 = 126
    const total = totalEtiquetas(p, selecaoInicial(p, 'Código'), new Map([[indiceDo261, 2]]), true)
    expect(total).toBe(126)
  })
})
