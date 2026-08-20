import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerCsv, type Planilha } from '../csv'
import {
  alocarEstante,
  celulasOcupadas,
  chaveGrupo,
  excedeEstoque,
  larguraMaximaPeloEstoque,
  ordenarParaAlocacao,
} from './alocar'
import { produtosDaEstante } from './elegibilidade'
import { criarEstante } from './template'
import type { ProdutoEstante, RegraAndar } from './tipos'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')
const planilhaReal = (): Planilha => lerCsv(new Uint8Array(readFileSync(CSV_REAL)))

const produto = (
  codigo: string,
  marca: string,
  tipo: string,
  cor: string,
  estoque = 1,
): ProdutoEstante => ({
  codigo,
  descricao: `${tipo} ${cor}`,
  classificacao: { marca, tipo, cor },
  // 1 de proposito: com 2 em fila a sugestao da 1 coluna, e os testes de ordem
  // e de quebra por marca medem o layout, e nao a largura.
  estoqueDeposito: estoque,
})

const estante = (andares: number, colunas: number) =>
  criarEstante({ andares, colunas, capacidadePorCelula: 2 })

/** "andar.coluna:codigo" das celulas ocupadas, para ler o mapa de uma vez. */
const mapa = (plano: ReturnType<typeof alocarEstante>): string[] =>
  celulasOcupadas(plano).map((c) => `${c.andar}.${c.coluna}:${c.codigo}`)

describe('ordenarParaAlocacao', () => {
  it('ordena Marca > Tipo > Cor', () => {
    const ordem = ['PLA', 'PLA Silk']
    const produtos = [
      produto('d', '3D Prime', 'PLA', 'PRETO'),
      produto('c', 'MultFila', 'PLA Silk', 'AZUL'),
      produto('b', 'MultFila', 'PLA', 'BRANCO'),
      produto('a', 'MultFila', 'PLA', 'PRETO'),
    ]

    expect(ordenarParaAlocacao(produtos, { ordemTipos: ordem }).map((p) => p.codigo)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('respeita a ordem de tipos escolhida pelo usuario', () => {
    const produtos = [produto('a', 'M', 'PLA', 'PRETO'), produto('b', 'M', 'PLA Silk', 'PRETO')]

    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA', 'PLA Silk'] }).map((p) => p.codigo)).toEqual(['a', 'b'])
    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA Silk', 'PLA'] }).map((p) => p.codigo)).toEqual(['b', 'a'])
  })

  it('joga marca vazia para o fim, como as celulas vazias da tabela', () => {
    const produtos = [produto('a', '', 'PLA', 'PRETO'), produto('b', 'MultFila', 'PLA', 'PRETO')]
    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] }).map((p) => p.codigo)).toEqual(['b', 'a'])
  })

  it('respeita a ordem de marcas escolhida pelo usuario', () => {
    const produtos = [
      produto('a', '3D Prime', 'PLA', 'PRETO'),
      produto('b', 'MultFila', 'PLA', 'PRETO'),
      produto('c', 'Voolt 3D', 'PLA', 'PRETO'),
    ]

    // Sem ordem definida, alfabetica.
    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] }).map((p) => p.codigo)).toEqual(['a', 'b', 'c'])

    // Com ordem, a marca escolhida toma o primeiro andar.
    expect(
      ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'], ordemMarcas: ['MultFila', 'Voolt 3D', '3D Prime'] }).map(
        (p) => p.codigo,
      ),
    ).toEqual(['b', 'c', 'a'])
  })

  it('marca fora da ordem vai para o fim, antes so das sem marca', () => {
    const produtos = [
      produto('a', 'Nova Marca', 'PLA', 'PRETO'),
      produto('b', 'MultFila', 'PLA', 'PRETO'),
      produto('c', '', 'PLA', 'PRETO'),
    ]

    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'], ordemMarcas: ['MultFila'] }).map((p) => p.codigo)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('respeita a ordem de cores escolhida', () => {
    const produtos = [
      produto('a', 'M', 'PLA', 'PRETO'),
      produto('b', 'M', 'PLA', 'VERMELHO'),
      produto('c', 'M', 'PLA', 'AZUL'),
    ]

    // Padrao: Preto (neutro) antes das cromaticas, e vermelho antes de azul.
    expect(ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] }).map((p) => p.codigo)).toEqual([
      'a',
      'b',
      'c',
    ])

    expect(
      ordenarParaAlocacao(produtos, {
        ordemTipos: ['PLA'],
        ordemCores: ['AZUL', 'VERMELHO', 'PRETO'],
      }).map((p) => p.codigo),
    ).toEqual(['c', 'b', 'a'])
  })

  it('a excecao vale so para o grupo marca+tipo dela', () => {
    const produtos = [
      produto('a1', 'M', 'PLA', 'PRETO'),
      produto('a2', 'M', 'PLA', 'AZUL'),
      produto('b1', 'M', 'PLA Silk', 'PRETO'),
      produto('b2', 'M', 'PLA Silk', 'AZUL'),
    ]

    const ordenados = ordenarParaAlocacao(produtos, {
      ordemTipos: ['PLA', 'PLA Silk'],
      ordemCoresPorGrupo: { [chaveGrupo('M', 'PLA Silk')]: ['AZUL', 'PRETO'] },
    })

    // PLA segue o padrao (Preto primeiro); so o PLA Silk inverte.
    expect(ordenados.map((p) => p.codigo)).toEqual(['a1', 'a2', 'b2', 'b1'])
  })

  it('a variacao continua colada na cor base mesmo com ordem propria', () => {
    const produtos = [
      produto('a', 'M', 'PLA', 'VERDE MILITAR'),
      produto('b', 'M', 'PLA', 'PRETO'),
      produto('c', 'M', 'PLA', 'VERDE'),
    ]

    expect(
      ordenarParaAlocacao(produtos, {
        ordemTipos: ['PLA'],
        ordemCores: ['VERDE', 'PRETO'],
      }).map((p) => p.codigo),
    ).toEqual(['c', 'a', 'b'])
  })

  it('desempata pelo codigo, para o mapa nao mudar sozinho', () => {
    const iguais = [produto('b', 'M', 'PLA', 'PRETO'), produto('a', 'M', 'PLA', 'PRETO')]
    expect(ordenarParaAlocacao(iguais, { ordemTipos: ['PLA'] }).map((p) => p.codigo)).toEqual(['a', 'b'])
  })

  it('nao altera a lista recebida', () => {
    const produtos = [produto('b', 'M', 'PLA', 'BRANCO'), produto('a', 'M', 'PLA', 'PRETO')]
    ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] })
    expect(produtos.map((p) => p.codigo)).toEqual(['b', 'a'])
  })
})

describe('alocarEstante', () => {
  it('preenche da esquerda para a direita e de cima para baixo', () => {
    const produtos = ['a', 'b', 'c', 'd', 'e'].map((c) => produto(c, 'M', 'PLA', c))
    const plano = alocarEstante(estante(3, 2), produtos)

    expect(mapa(plano)).toEqual(['1.1:a', '1.2:b', '2.1:c', '2.2:d', '3.1:e'])
  })

  it('devolve a grade inteira, inclusive as celulas vazias', () => {
    const plano = alocarEstante(estante(2, 3), [produto('a', 'M', 'PLA', 'PRETO')])

    expect(plano.celulas).toHaveLength(6)
    expect(plano.celulas.filter((c) => c.codigo === null)).toHaveLength(5)
  })

  it('marca nova comeca andar novo, mesmo sobrando coluna', () => {
    const produtos = [
      produto('a', 'MultFila', 'PLA', 'PRETO'),
      produto('b', 'MultFila', 'PLA', 'BRANCO'),
      produto('c', 'Outra', 'PLA', 'PRETO'),
    ]
    const plano = alocarEstante(estante(3, 4), ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] }))

    // MultFila ocupa 1.1 e 1.2 e deixa 1.3 e 1.4 livres; "Outra" nao encosta
    // nela mesmo assim, e comeca o andar 2.
    expect(mapa(plano)).toEqual(['1.1:a', '1.2:b', '2.1:c'])
  })

  it('nao desperdica um andar inteiro quando a marca muda no comeco de um', () => {
    const produtos = [
      produto('a', 'A', 'PLA', 'PRETO'),
      produto('b', 'A', 'PLA', 'BRANCO'),
      produto('c', 'B', 'PLA', 'PRETO'),
    ]
    const plano = alocarEstante(estante(3, 2), produtos)

    // "A" fecha o andar 1 exatamente; "B" comeca o 2 sem pular o andar.
    expect(mapa(plano)).toEqual(['1.1:a', '1.2:b', '2.1:c'])
  })

  it('duas grafias da mesma marca ficam no mesmo andar', () => {
    // O Bling aceita "MultFila" e "MULTFILA" no mesmo cadastro. Comparando as
    // strings cruas, a segunda grafia ganharia um andar so para ela.
    const produtos = [
      produto('a', 'MultFila', 'PLA', 'PRETO'),
      produto('b', 'MULTFILA', 'PLA', 'BRANCO'),
      produto('c', 'MultFila', 'PLA', 'AZUL'),
    ]
    const plano = alocarEstante(estante(3, 4), ordenarParaAlocacao(produtos, { ordemTipos: ['PLA'] }))

    expect(celulasOcupadas(plano).every((c) => c.andar === 1)).toBe(true)
  })

  it('manda o excesso para naoAlocados, na ordem em que teria entrado', () => {
    const produtos = ['a', 'b', 'c', 'd'].map((c) => produto(c, 'M', 'PLA', c))
    const plano = alocarEstante(estante(1, 2), produtos)

    expect(mapa(plano)).toEqual(['1.1:a', '1.2:b'])
    expect(plano.naoAlocados.map((n) => n.codigo)).toEqual(['c', 'd'])
    expect(plano.avisos.join(' ')).toContain('não couberam')
  })

  it('sem produtos, a grade fica toda vazia e sem aviso', () => {
    const plano = alocarEstante(estante(2, 2), [])

    expect(plano.celulas).toHaveLength(4)
    expect(celulasOcupadas(plano)).toHaveLength(0)
    expect(plano.avisos).toEqual([])
  })

  it('pula o andar fora de uso', () => {
    const produtos = ['a', 'b', 'c'].map((c) => produto(c, 'M', 'PLA', c))
    const plano = alocarEstante(
      { ...estante(3, 2), andaresBloqueados: [1] },
      produtos,
    )

    // O andar 1 continua na grade, mas ninguem cai nele.
    expect(mapa(plano)).toEqual(['2.1:a', '2.2:b', '3.1:c'])
    expect(plano.celulas.filter((c) => c.bloqueada)).toHaveLength(2)
  })

  it('bloquear um andar do meio nao deixa buraco na sequencia', () => {
    const produtos = ['a', 'b', 'c', 'd'].map((c) => produto(c, 'M', 'PLA', c))
    const plano = alocarEstante({ ...estante(3, 2), andaresBloqueados: [2] }, produtos)

    expect(mapa(plano)).toEqual(['1.1:a', '1.2:b', '3.1:c', '3.2:d'])
  })

  it('com todos os andares bloqueados nada e alocado', () => {
    const plano = alocarEstante({ ...estante(2, 2), andaresBloqueados: [1, 2] }, [
      produto('a', 'M', 'PLA', 'X'),
    ])

    expect(celulasOcupadas(plano)).toHaveLength(0)
    expect(plano.naoAlocados.map((n) => n.codigo)).toEqual(['a'])
  })

  it('estante sem colunas nao trava: tudo vira naoAlocado', () => {

    const plano = alocarEstante({ ...estante(2, 2), colunas: 0 }, [produto('a', 'M', 'PLA', 'X')])

    expect(plano.celulas).toEqual([])
    expect(plano.naoAlocados.map((n) => n.codigo)).toEqual(['a'])
  })
})

describe('largura da celula', () => {
  it('um bloco largo ocupa colunas seguidas', () => {
    const produtos = ['a', 'b'].map((c) => produto(c, 'M', 'PLA', c))
    const plano = alocarEstante(estante(2, 6), produtos, { a: 3 })

    const [primeira, segunda] = celulasOcupadas(plano)
    expect(primeira).toMatchObject({ andar: 1, coluna: 1, largura: 3 })
    // O vizinho comeca depois do bloco, nao na coluna 2.
    expect(segunda).toMatchObject({ andar: 1, coluna: 4, largura: 1 })
  })

  it('o bloco nunca e partido entre dois andares', () => {
    const produtos = ['a', 'b'].map((c) => produto(c, 'M', 'PLA', c))
    // "a" ocupa 3 das 4 colunas; "b" pede 3 e nao cabe no que sobrou.
    const plano = alocarEstante(estante(2, 4), produtos, { a: 3, b: 3 })

    expect(mapa(plano)).toEqual(['1.1:a', '2.1:b'])
  })

  it('largura maior que a estante e limitada as colunas', () => {
    const plano = alocarEstante(estante(2, 3), [produto('a', 'M', 'PLA', 'X')], { a: 99 })
    expect(celulasOcupadas(plano)[0]?.largura).toBe(3)
  })

  it('largura invalida vale 1', () => {
    const plano = alocarEstante(estante(2, 4), [produto('a', 'M', 'PLA', 'X')], { a: 0 })
    expect(celulasOcupadas(plano)[0]?.largura).toBe(1)
  })

  it('a grade continua com uma entrada por coluna livre', () => {
    const plano = alocarEstante(estante(1, 5), [produto('a', 'M', 'PLA', 'X')], { a: 3 })

    // 1 bloco de 3 + 2 celulas vazias = 3 entradas cobrindo 5 colunas.
    expect(plano.celulas).toHaveLength(3)
    expect(plano.celulas.reduce((s, c) => s + c.largura, 0)).toBe(5)
  })
})

describe('a estante e fixa: a largura nunca deriva do estoque sozinha', () => {
  it('toda celula nasce com 1 coluna, estoque alto ou baixo', () => {
    expect(celulasOcupadas(alocarEstante(estante(2, 6), [produto('a', 'M', 'PLA', 'X', 1)]))[0]
      ?.largura).toBe(1)
    expect(celulasOcupadas(alocarEstante(estante(2, 6), [produto('a', 'M', 'PLA', 'X', 42)]))[0]
      ?.largura).toBe(1)
  })

  it('so a escolha manual muda a largura', () => {
    const produtos = [produto('a', 'M', 'PLA', 'X', 9)]
    const largura = (larguras?: Record<string, number>) =>
      celulasOcupadas(alocarEstante(estante(2, 6), produtos, larguras))[0]?.largura

    expect(largura()).toBe(1)
    expect(largura({ a: 4 })).toBe(4)
  })
})

describe('larguraMaximaPeloEstoque', () => {
  it('e quantas colunas os rolos precisam ocupar -- ceil, nao floor', () => {
    // 3 rolos com 2 de profundidade pedem 2 colunas: o terceiro precisa de
    // lugar. Com floor daria 1 e o terceiro rolo ficaria sem casa.
    expect(larguraMaximaPeloEstoque(1, 2)).toBe(1)
    expect(larguraMaximaPeloEstoque(2, 2)).toBe(1)
    expect(larguraMaximaPeloEstoque(3, 2)).toBe(2)
    expect(larguraMaximaPeloEstoque(4, 2)).toBe(2)
    expect(larguraMaximaPeloEstoque(9, 2)).toBe(5)
  })

  it('nunca devolve 0 -- celula de largura 0 nao existe', () => {
    expect(larguraMaximaPeloEstoque(0, 2)).toBe(1)
  })

  it('libera exatamente enquanto sobrar rolo fora da largura atual', () => {
    // O "+" pergunta `largura < max`, que equivale a `estoque > largura x fila`.
    for (const [estoque, largura, cabe] of [
      [2, 1, false],
      [3, 1, true],
      [4, 2, false],
      [5, 2, true],
    ] as const) {
      expect(largura < larguraMaximaPeloEstoque(estoque, 2)).toBe(cabe)
      expect(estoque > largura * 2).toBe(cabe)
    }
  })
})

describe('excedeEstoque', () => {
  it('nunca acende na largura 1 de fabrica, mesmo com estoque impar', () => {
    expect(excedeEstoque(1, 1, 2)).toBe(false)
    expect(excedeEstoque(1, 0, 2)).toBe(false)
  })

  it('nao acende na ultima coluna pela metade, que e o arredondamento normal', () => {
    // 3 rolos em 2 colunas: 4 lugares, 3 ocupados. Foi o "+" que permitiu, e
    // acender aqui contradiria o proprio botao.
    expect(excedeEstoque(2, 3, 2)).toBe(false)
    expect(excedeEstoque(5, 9, 2)).toBe(false)
  })

  it('acende quando a largura passou do que os rolos pedem', () => {
    // O caso da bandeira: 1 rolo numa celula de 3 colunas.
    expect(excedeEstoque(3, 1, 2)).toBe(true)
    // Estoque caiu depois: 2 rolos cabem em 1 coluna, entao a de 2 sobra.
    // A largura de 2 so se justifica a partir de 3 rolos.
    expect(excedeEstoque(2, 2, 2)).toBe(true)
    expect(excedeEstoque(2, 3, 2)).toBe(false)
  })

  it('e o espelho exato do limite do botao +', () => {
    for (let estoque = 0; estoque <= 10; estoque++) {
      const max = larguraMaximaPeloEstoque(estoque, 2)
      for (let largura = 1; largura <= 8; largura++) {
        expect(excedeEstoque(largura, estoque, 2)).toBe(largura > max)
      }
    }
  })
})

describe('regras de andar', () => {
  const comRegra = (andares: number, colunas: number, regras: RegraAndar[]) => ({
    ...estante(andares, colunas),
    regrasAndar: regras,
  })

  const REGRA_PRETO_BRANCO: RegraAndar = {
    andar: 1,
    marcas: [],
    tipos: ['PLA'],
    cores: ['PRETO', 'BRANCO'],
  }

  it('o andar com regra so recebe quem a atende', () => {
    const produtos = [
      produto('preto', 'M', 'PLA', 'PRETO'),
      produto('azul', 'M', 'PLA', 'AZUL'),
      produto('branco', 'M', 'PLA', 'BRANCO'),
    ]
    const plano = alocarEstante(comRegra(3, 4, [REGRA_PRETO_BRANCO]), produtos)

    const andar1 = celulasOcupadas(plano).filter((c) => c.andar === 1)
    expect(andar1.map((c) => c.codigo)).toEqual(['preto', 'branco'])
  })

  it('quem atende a regra nao vai para outro andar', () => {
    const produtos = [
      produto('azul', 'M', 'PLA', 'AZUL'),
      produto('preto', 'M', 'PLA', 'PRETO'),
    ]
    const plano = alocarEstante(comRegra(3, 4, [REGRA_PRETO_BRANCO]), produtos)

    // Mesmo o azul vindo primeiro na ordem, o preto fica no andar reservado.
    expect(mapa(plano)).toEqual(['1.1:preto', '2.1:azul'])
  })

  it('a regra pega as variacoes da cor base', () => {
    // "PRETO FOSCO" e preto: a regra compara a cor base, nao o texto.
    const produtos = [produto('a', 'M', 'PLA', 'PRETO FOSCO')]
    const plano = alocarEstante(comRegra(2, 4, [REGRA_PRETO_BRANCO]), produtos)

    expect(celulasOcupadas(plano)[0]?.andar).toBe(1)
  })

  it('eixo vazio aceita qualquer valor', () => {
    const soCor: RegraAndar = { andar: 1, marcas: [], tipos: [], cores: ['PRETO'] }
    const produtos = [
      produto('a', 'Outra', 'PETG', 'PRETO'),
      produto('b', 'M', 'PLA', 'AZUL'),
    ]
    const plano = alocarEstante(comRegra(3, 4, [soCor]), produtos)

    // Marca e tipo diferentes, mas a cor bate: entra no andar 1.
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'a')?.andar).toBe(1)
  })

  it('o excesso do andar reservado nao vaza para outro', () => {
    const produtos = ['p1', 'p2', 'p3'].map((c) => produto(c, 'M', 'PLA', 'PRETO'))
    const plano = alocarEstante(comRegra(3, 2, [REGRA_PRETO_BRANCO]), produtos)

    // Cabem 2 no andar 1; o terceiro sai, senao a regra deixaria de valer.
    expect(celulasOcupadas(plano).map((c) => c.codigo)).toEqual(['p1', 'p2'])
    expect(plano.naoAlocados.map((n) => n.codigo)).toEqual(['p3'])
    expect(plano.avisos.join(' ')).toContain('Andar 1')
  })

  it('regra em andar bloqueado e ignorada', () => {
    const produtos = [produto('a', 'M', 'PLA', 'PRETO')]
    const plano = alocarEstante(
      { ...comRegra(3, 4, [REGRA_PRETO_BRANCO]), andaresBloqueados: [1] },
      produtos,
    )

    expect(celulasOcupadas(plano)[0]?.andar).toBe(2)
  })

  it('cor por tipo: so PLA preto, mas qualquer PLA Matte', () => {
    // O caso que motivou `coresPorTipo`: os tres eixos sao um E que vale para
    // a regra inteira, entao marcar PRETO em `cores` limitaria o Matte a preto.
    const regra: RegraAndar = {
      andar: 1,
      marcas: [],
      tipos: ['PLA', 'PLA Matte/Fosco'],
      cores: [],
      coresPorTipo: { PLA: ['PRETO'] },
    }

    const produtos = [
      produto('pla-preto', 'M', 'PLA', 'PRETO'),
      produto('pla-azul', 'M', 'PLA', 'AZUL'),
      produto('matte-preto', 'M', 'PLA Matte/Fosco', 'PRETO'),
      produto('matte-verde', 'M', 'PLA Matte/Fosco', 'VERDE'),
    ]
    const plano = alocarEstante(comRegra(3, 6, [regra]), produtos)

    const andar1 = celulasOcupadas(plano)
      .filter((c) => c.andar === 1)
      .map((c) => c.codigo)
    expect(andar1).toEqual(['pla-preto', 'matte-preto', 'matte-verde'])
    // O PLA azul nao atende a regra, entao cai no andar seguinte.
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'pla-azul')?.andar).toBe(2)
  })

  it('a excecao vazia vence o padrao, e nao herda dele', () => {
    // A outra forma de escrever o mesmo: padrao PRETO, e Matte liberado.
    const regra: RegraAndar = {
      andar: 1,
      marcas: [],
      tipos: ['PLA', 'PLA Matte/Fosco'],
      cores: ['PRETO'],
      coresPorTipo: { 'PLA MATTE/FOSCO': [] },
    }

    const produtos = [
      produto('pla-azul', 'M', 'PLA', 'AZUL'),
      produto('matte-verde', 'M', 'PLA Matte/Fosco', 'VERDE'),
    ]
    const plano = alocarEstante(comRegra(3, 6, [regra]), produtos)

    // Se o array vazio herdasse `cores`, o verde teria sido barrado.
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'matte-verde')?.andar).toBe(1)
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'pla-azul')?.andar).toBe(2)
  })

  it('a chave da excecao casa normalizada, como todo o resto do modulo', () => {
    const regra: RegraAndar = {
      andar: 1,
      marcas: [],
      tipos: [],
      cores: [],
      coresPorTipo: { 'pla matte/fosco': ['PRETO'] },
    }

    const produtos = [
      produto('a', 'M', 'PLA Matte/Fosco', 'PRETO'),
      produto('b', 'M', 'PLA Matte/Fosco', 'AZUL'),
    ]
    const plano = alocarEstante(comRegra(3, 6, [regra]), produtos)

    expect(celulasOcupadas(plano).find((c) => c.codigo === 'a')?.andar).toBe(1)
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'b')?.andar).toBe(2)
  })

  it('tipo sem excecao continua caindo no padrao de cores', () => {
    const regra: RegraAndar = {
      andar: 1,
      marcas: [],
      tipos: [],
      cores: ['PRETO'],
      coresPorTipo: { PLA: ['AZUL'] },
    }

    const produtos = [
      produto('petg-preto', 'M', 'PETG', 'PRETO'),
      produto('petg-azul', 'M', 'PETG', 'AZUL'),
    ]
    const plano = alocarEstante(comRegra(3, 6, [regra]), produtos)

    expect(celulasOcupadas(plano).find((c) => c.codigo === 'petg-preto')?.andar).toBe(1)
    expect(celulasOcupadas(plano).find((c) => c.codigo === 'petg-azul')?.andar).toBe(2)
  })

  it('regra vazia vale como andar sem regra', () => {
    const vazia: RegraAndar = { andar: 1, marcas: [], tipos: [], cores: [] }
    const produtos = [produto('a', 'M', 'PLA', 'AZUL')]
    const plano = alocarEstante(comRegra(2, 4, [vazia]), produtos)

    expect(celulasOcupadas(plano)[0]?.andar).toBe(1)
  })
})

describe('com o arquivo real', () => {
  const ORDEM = ['PLA', 'PLA Matte/Fosco', 'PLA Silk', 'PLA Especiais']

  it('os 11 elegiveis cabem no primeiro andar de uma 6 x 12', () => {
    const { produtos } = produtosDaEstante(planilhaReal(), { raizCategoria: 'Filamentos' })
    const plano = alocarEstante(criarEstante(), ordenarParaAlocacao(produtos, { ordemTipos: ORDEM }))
    const ocupadas = celulasOcupadas(plano)

    expect(ocupadas).toHaveLength(11)
    expect(ocupadas.every((c) => c.andar === 1 && c.largura === 1)).toBe(true)
    expect(plano.naoAlocados).toEqual([])
  })

  it('sai na ordem tipo > cor, com Preto na frente dentro de cada tipo', () => {
    const { produtos } = produtosDaEstante(planilhaReal(), { raizCategoria: 'Filamentos' })
    const plano = alocarEstante(criarEstante(), ordenarParaAlocacao(produtos, { ordemTipos: ORDEM }))

    expect(
      celulasOcupadas(plano).map((c) => `${c.classificacao?.tipo} / ${c.classificacao?.cor}`),
    ).toEqual([
      'PLA / PRETO',
      'PLA / LAVANDA',
      'PLA Matte/Fosco / PRETO',
      'PLA Matte/Fosco / BRANCO',
      'PLA Matte/Fosco / VERDE MILITAR',
      'PLA Matte/Fosco / ROSA CLARO',
      'PLA Silk / RAINBOW ALGODAO DOCE',
      'PLA Silk / RAINBOW FADA',
      'PLA Especiais / MARRON MADEIRA',
      'PLA Especiais / MARMORIZADO',
      'PLA Especiais / RAINBOW CANDY COLORS',
    ])
  })

  it('arrastar PLA Silk para o topo reordena o mapa', () => {
    const { produtos } = produtosDaEstante(planilhaReal(), { raizCategoria: 'Filamentos' })
    const plano = alocarEstante(
      criarEstante(),
      ordenarParaAlocacao(produtos, { ordemTipos: ['PLA Silk', 'PLA', 'PLA Matte/Fosco', 'PLA Especiais'] }),
    )

    expect(celulasOcupadas(plano)[0]?.classificacao?.tipo).toBe('PLA Silk')
  })
})
