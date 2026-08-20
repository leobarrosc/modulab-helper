import { describe, expect, it } from 'vitest'
import { alocarEstante } from './alocar'
import {
  capacidadeDaCelula,
  conferidosDaCelula,
  iniciarConferencia,
  itensReposicao,
  marcarCelula,
  podarConferencia,
  progressoConferencia,
} from './conferencia'
import { criarEstante } from './template'
import type { EstadoConferencia, ProdutoEstante } from './tipos'

const produto = (codigo: string, cor: string, estoque = 6): ProdutoEstante => ({
  codigo,
  descricao: `FILAMENTO PLA ${cor}`,
  classificacao: { marca: 'MultFila', tipo: 'PLA', cor },
  estoqueDeposito: estoque,
})

// Estoque 6 de proposito: a capacidade e cortada pelo estoque, e um fixture
// curto faria estes testes medirem o corte em vez do que eles querem medir.
// O corte tem bloco proprio, mais abaixo.
const PRODUTOS = [produto('a', 'PRETO'), produto('b', 'BRANCO')]
const TEMPLATE = criarEstante({ andares: 2, colunas: 2, capacidadePorCelula: 2 })
const PLANO = alocarEstante(TEMPLATE, PRODUTOS)
const POR_CODIGO = new Map(PRODUTOS.map((p) => [p.codigo, p]))

const vazia = (): EstadoConferencia => iniciarConferencia('2026-08-14T10:00:00.000Z')

describe('marcarCelula', () => {
  it('cria a celula com o tamanho da capacidade e mexe so na posicao pedida', () => {
    const depois = marcarCelula(vazia(), 'a', 1, true, 2)
    expect(depois.itens['a']?.marcados).toEqual([false, true])
  })

  it('e imutavel', () => {
    const antes = vazia()
    marcarCelula(antes, 'a', 0, true, 2)
    expect(antes.itens['a']).toBeUndefined()
  })

  it('desmarca', () => {
    const marcado = marcarCelula(vazia(), 'a', 0, true, 2)
    expect(marcarCelula(marcado, 'a', 0, false, 2).itens['a']?.marcados).toEqual([false, false])
  })

  it('ignora posicao fora da capacidade', () => {
    const antes = vazia()
    expect(marcarCelula(antes, 'a', 5, true, 2)).toBe(antes)
    expect(marcarCelula(antes, 'a', -1, true, 2)).toBe(antes)
  })

  it('preserva a data de inicio', () => {
    expect(marcarCelula(vazia(), 'a', 0, true, 2).iniciadaEm).toBe('2026-08-14T10:00:00.000Z')
  })

  it('ajusta uma celula gravada com capacidade antiga', () => {
    // O usuario editou o template de 2 para 3 depois de ja ter conferido.
    const conferencia = marcarCelula(marcarCelula(vazia(), 'a', 0, true, 2), 'a', 1, true, 2)

    expect(marcarCelula(conferencia, 'a', 2, true, 3).itens['a']?.marcados).toEqual([
      true,
      true,
      true,
    ])
    // Diminuindo, as posicoes que sobram somem em vez de virar lixo no storage.
    expect(conferidosDaCelula(conferencia, 'a', 1)).toEqual([true])
  })
})

describe('podarConferencia', () => {
  it('remove quem saiu do plano e mantem o resto', () => {
    const conferencia = marcarCelula(marcarCelula(vazia(), 'a', 0, true, 2), 'z', 0, true, 2)
    const podada = podarConferencia(conferencia, new Set(['a']))

    expect(Object.keys(podada.itens)).toEqual(['a'])
  })

  it('nao cria objeto novo quando nao ha nada a podar', () => {
    const conferencia = marcarCelula(vazia(), 'a', 0, true, 2)
    expect(podarConferencia(conferencia, new Set(['a', 'b']))).toBe(conferencia)
  })
})

describe('itensReposicao', () => {
  it('lista so as celulas incompletas', () => {
    // "a" fica cheia; so "b" precisa de reposicao.
    let conferencia = marcarCelula(vazia(), 'a', 0, true, 2)
    conferencia = marcarCelula(conferencia, 'a', 1, true, 2)
    conferencia = marcarCelula(conferencia, 'b', 0, true, 2)

    const itens = itensReposicao(PLANO, conferencia, 2, POR_CODIGO)

    expect(itens.map((i) => i.codigo)).toEqual(['b'])
    expect(itens[0]?.faltam).toBe(1)
  })

  it('com nada conferido, tudo falta pela capacidade cheia', () => {
    const itens = itensReposicao(PLANO, vazia(), 2, POR_CODIGO)

    expect(itens.map((i) => i.codigo)).toEqual(['a', 'b'])
    expect(itens.every((i) => i.faltam === 2)).toBe(true)
  })

  it('leva posicao e estoque do deposito, que e a resposta de "da para repor?"', () => {
    const itens = itensReposicao(PLANO, vazia(), 2, POR_CODIGO)
    const b = itens.find((i) => i.codigo === 'b')

    expect(b).toMatchObject({ andar: 1, coluna: 2, estoqueDeposito: 6 })
    expect(b?.descricao).toBe('FILAMENTO PLA BRANCO')
  })

  it('sai em ordem de leitura da estante, que e a ordem de caminhar na frente dela', () => {
    const itens = itensReposicao(PLANO, vazia(), 2, POR_CODIGO)
    expect(itens.map((i) => `${i.andar}.${i.coluna}`)).toEqual(['1.1', '1.2'])
  })

  it('ignora celula vazia', () => {
    expect(itensReposicao(alocarEstante(TEMPLATE, []), vazia(), 2, new Map())).toEqual([])
  })

  it('aguenta produto que sumiu do mapa de produtos', () => {
    const itens = itensReposicao(PLANO, vazia(), 2, new Map())
    expect(itens[0]).toMatchObject({ descricao: '', estoqueDeposito: 0 })
  })

  it('marca a linha em que a largura manual passou do que ha no deposito', () => {
    // "x" tem 1 rolo e ganhou 3 colunas na mao: 6 vagas fisicas para 1 rolo.
    const larga = criarEstante({ andares: 1, colunas: 6, capacidadePorCelula: 2 })
    const produtos = [produto('x', 'PRETO', 1), produto('y', 'BRANCO', 4)]
    const plano = alocarEstante(larga, produtos, { x: 3 })
    const porCodigo = new Map(produtos.map((p) => [p.codigo, p]))
    const itens = itensReposicao(plano, vazia(), 2, porCodigo)

    // faltam 1, e nao 6: a conferencia so pede o rolo que existe.
    expect(itens.find((i) => i.codigo === 'x')).toMatchObject({
      faltam: 1,
      excedeEstoque: true,
    })
    // "y" ficou na largura 1: 2 lugares para 4 rolos, nada a sinalizar.
    expect(itens.find((i) => i.codigo === 'y')?.excedeEstoque).toBe(false)
  })
})

describe('a capacidade e cortada pelo estoque', () => {
  const TEMPLATE_2 = criarEstante({ andares: 1, colunas: 4, capacidadePorCelula: 2 })

  const capacidadeDe = (estoque: number, largura: number): number => {
    const produtos = [produto('p', 'PRETO', estoque)]
    const plano = alocarEstante(TEMPLATE_2, produtos, { p: largura })
    const celula = plano.celulas.find((c) => c.codigo === 'p')!
    return capacidadeDaCelula(celula, TEMPLATE_2.capacidadePorCelula)
  }

  it('3 rolos numa celula de 2 colunas dao 3 caixinhas, e nao 4', () => {
    // A quarta seria uma posicao que ninguem pode preencher, e entraria na
    // reposicao como um rolo a buscar num deposito que nao tem.
    expect(capacidadeDe(3, 2)).toBe(3)
  })

  it('nao corta quando o estoque cobre as vagas fisicas', () => {
    expect(capacidadeDe(4, 2)).toBe(4)
    expect(capacidadeDe(9, 2)).toBe(4)
  })

  it('corta tambem a celula de largura 1', () => {
    expect(capacidadeDe(1, 1)).toBe(1)
    expect(capacidadeDe(2, 1)).toBe(2)
  })

  it('a reposicao nunca pede mais rolos do que existem', () => {
    const produtos = [produto('p', 'PRETO', 3)]
    const plano = alocarEstante(TEMPLATE_2, produtos, { p: 2 })
    const itens = itensReposicao(plano, vazia(), 2, new Map(produtos.map((p) => [p.codigo, p])))

    expect(itens[0]?.faltam).toBe(3)
  })
})

describe('celula larga', () => {
  // "a" ocupa 3 colunas com 2 em fila: 6 rolos. Precisa de estante larga o
  // bastante, senao a largura e limitada as colunas.
  const LARGA = criarEstante({ andares: 2, colunas: 6, capacidadePorCelula: 2 })
  const planoLargo = alocarEstante(LARGA, PRODUTOS, { a: 3 })

  it('a capacidade acompanha a largura', () => {
    const celula = planoLargo.celulas.find((c) => c.codigo === 'a')!
    expect(capacidadeDaCelula(celula, LARGA.capacidadePorCelula)).toBe(6)
  })

  it('faltam os 6 quando nada foi conferido', () => {
    const itens = itensReposicao(planoLargo, vazia(), 2, POR_CODIGO)
    expect(itens.find((i) => i.codigo === 'a')?.faltam).toBe(6)
  })

  it('o progresso conta os 6, e nao 2', () => {
    // 6 do bloco largo + 2 do vizinho.
    expect(progressoConferencia(planoLargo, vazia(), 2).total).toBe(8)
  })
})

describe('progressoConferencia', () => {
  it('conta so as posicoes das celulas ocupadas', () => {
    // Duas celulas ocupadas x capacidade 2 = 4 posicoes, nao as 8 da grade.
    expect(progressoConferencia(PLANO, vazia(), 2)).toEqual({ conferidas: 0, total: 4 })
  })

  it('anda conforme se marca', () => {
    const conferencia = marcarCelula(vazia(), 'a', 0, true, 2)
    expect(progressoConferencia(PLANO, conferencia, 2)).toEqual({ conferidas: 1, total: 4 })
  })
})
