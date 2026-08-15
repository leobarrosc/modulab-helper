import { describe, expect, it } from 'vitest'
import {
  comItensNovos,
  compararPorOrdem,
  moverItem,
  moverItemParaIndice,
  nomesDistintos,
  posicaoNaOrdem,
} from './ordemManual'

const ORDEM = ['PLA', 'PLA Matte/Fosco', 'PLA Silk']

describe('posicaoNaOrdem', () => {
  it('devolve o indice, e infinito para quem nao esta na lista', () => {
    expect(posicaoNaOrdem(ORDEM, 'PLA Matte/Fosco')).toBe(1)
    expect(posicaoNaOrdem(ORDEM, 'PETG')).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('nomesDistintos', () => {
  it('funde as grafias e mantem a primeira que apareceu', () => {
    // "MultFila" e "MULTFILA" convivem no cadastro real do Bling.
    expect(nomesDistintos(['MultFila', 'MULTFILA', '3D Prime', 'multfila'])).toEqual([
      'MultFila',
      '3D Prime',
    ])
  })

  it('ignora acento', () => {
    expect(nomesDistintos(['Básico', 'BASICO'])).toEqual(['Básico'])
  })

  it('descarta o vazio', () => {
    expect(nomesDistintos(['', 'MultFila', ''])).toEqual(['MultFila'])
  })
})

describe('comItensNovos', () => {
  it('acrescenta ao fim, em ordem alfabetica entre si', () => {
    // Vao para o fim porque a ordem existente e decisao do usuario: um tipo
    // novo do Bling nao reorganiza a prateleira sozinho.
    expect(comItensNovos(ORDEM, ['TPU', 'PLA', 'ABS'])).toEqual([...ORDEM, 'ABS', 'TPU'])
  })

  it('nao mexe quando nao ha novidade', () => {
    expect(comItensNovos(ORDEM, ['PLA', 'PLA Silk'])).toBe(ORDEM)
  })

  it('nao duplica um nome repetido na entrada', () => {
    expect(comItensNovos(ORDEM, ['ABS', 'ABS'])).toEqual([...ORDEM, 'ABS'])
  })

  it('nunca dá lugar ao nome vazio -- "sem marca" nao e uma escolha a arrastar', () => {
    expect(comItensNovos(ORDEM, [''])).toBe(ORDEM)
    expect(comItensNovos([], ['', 'ABS'])).toEqual(['ABS'])
  })

  it('parte de uma ordem vazia', () => {
    expect(comItensNovos([], ['PETG', 'ABS'])).toEqual(['ABS', 'PETG'])
  })

  it('serve igual para marcas', () => {
    expect(comItensNovos(['MultFila'], ['3D Prime', 'MultFila', 'Voolt 3D'])).toEqual([
      'MultFila',
      '3D Prime',
      'Voolt 3D',
    ])
  })

  it('nao abre uma segunda linha para outra grafia da mesma marca', () => {
    // Sem isto, MULTFILA viraria uma linha arrastavel separada e o usuario
    // poderia afastar da MultFila produtos da mesma marca.
    const ordem = ['MultFila']
    expect(comItensNovos(ordem, ['MULTFILA', 'multfila'])).toBe(ordem)
    expect(comItensNovos([], ['MultFila', 'MULTFILA'])).toEqual(['MultFila'])
  })
})

describe('moverItem', () => {
  it('move uma posicao para cada lado', () => {
    expect(moverItem(ORDEM, 'PLA Silk', -1)).toEqual(['PLA', 'PLA Silk', 'PLA Matte/Fosco'])
    expect(moverItem(ORDEM, 'PLA', 1)).toEqual(['PLA Matte/Fosco', 'PLA', 'PLA Silk'])
  })

  it('trava nas pontas', () => {
    expect(moverItem(ORDEM, 'PLA', -1)).toBe(ORDEM)
    expect(moverItem(ORDEM, 'PLA Silk', 1)).toBe(ORDEM)
  })

  it('ignora nome que nao esta na lista', () => {
    expect(moverItem(ORDEM, 'PETG', 1)).toBe(ORDEM)
  })
})

describe('moverItemParaIndice', () => {
  it('leva para um indice arbitrario -- e o que o soltar do arraste precisa', () => {
    expect(moverItemParaIndice(ORDEM, 'PLA', 2)).toEqual([
      'PLA Matte/Fosco',
      'PLA Silk',
      'PLA',
    ])
    expect(moverItemParaIndice(ORDEM, 'PLA Silk', 0)).toEqual([
      'PLA Silk',
      'PLA',
      'PLA Matte/Fosco',
    ])
  })

  it('limita o destino a lista', () => {
    expect(moverItemParaIndice(ORDEM, 'PLA', 99)).toEqual([
      'PLA Matte/Fosco',
      'PLA Silk',
      'PLA',
    ])
    expect(moverItemParaIndice(ORDEM, 'PLA Silk', -5)).toEqual([
      'PLA Silk',
      'PLA',
      'PLA Matte/Fosco',
    ])
  })

  it('nao mexe quando o destino e a posicao atual', () => {
    expect(moverItemParaIndice(ORDEM, 'PLA Matte/Fosco', 1)).toBe(ORDEM)
  })
})

describe('compararPorOrdem', () => {
  it('ordena pela lista e joga os desconhecidos ao fim, alfabeticos', () => {
    const tipos = ['TPU', 'PLA Silk', 'ABS', 'PLA']
    expect([...tipos].sort(compararPorOrdem(ORDEM))).toEqual(['PLA', 'PLA Silk', 'ABS', 'TPU'])
  })

  it('poe o nome vazio por ultimo, mesmo com a ordem vazia', () => {
    // Sem esta regra, "" viria antes de tudo no collator e um produto sem marca
    // cadastrada tomaria o primeiro andar.
    expect(['', 'MultFila', '3D Prime'].sort(compararPorOrdem([]))).toEqual([
      '3D Prime',
      'MultFila',
      '',
    ])
    expect(['', 'MultFila'].sort(compararPorOrdem(['MultFila']))).toEqual(['MultFila', ''])
  })

  it('respeita a ordem de marcas escolhida', () => {
    const marcas = ['Voolt 3D', '3D Prime', 'MultFila']
    expect([...marcas].sort(compararPorOrdem(['MultFila', 'Voolt 3D']))).toEqual([
      'MultFila',
      'Voolt 3D',
      '3D Prime',
    ])
  })

  it('outra grafia cai na mesma posicao da ordem', () => {
    // A ordem guarda "MultFila"; os produtos gravados como "MULTFILA" tem de
    // ficar colados nela, e nao no fim junto com os desconhecidos.
    const ordem = ['MultFila', '3D Prime']
    expect(['3D Prime', 'MULTFILA'].sort(compararPorOrdem(ordem))).toEqual([
      'MULTFILA',
      '3D Prime',
    ])
    expect(posicaoNaOrdem(ordem, 'MULTFILA')).toBe(0)
  })
})

describe('moverItem com outra grafia', () => {
  it('acha o item pela forma normalizada e preserva a grafia gravada', () => {
    const ordem = ['3D Prime', 'MultFila']
    expect(moverItem(ordem, 'MULTFILA', -1)).toEqual(['MultFila', '3D Prime'])
  })
})
