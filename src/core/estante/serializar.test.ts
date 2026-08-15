import { describe, expect, it } from 'vitest'
import {
  lerConferencia,
  lerConferencias,
  lerCorrecoes,
  lerOrdemNomes,
  lerTemplate,
  lerTemplates,
} from './serializar'
import { ESTANTE_PADRAO } from './template'

const templateBom = {
  id: 'estante-1',
  nome: 'Vitrine',
  andares: 6,
  colunas: 12,
  capacidadePorCelula: 2,
  raizCategoria: 'Filamentos',
  marcasPermitidas: ['MultFila'],
  andaresBloqueados: [6],
  regrasAndar: [{ andar: 1, marcas: [], tipos: ['PLA'], cores: ['PRETO', 'BRANCO'] }],
}

describe('lerTemplate', () => {
  it('aceita um template inteiro', () => {
    expect(lerTemplate(templateBom)).toEqual(templateBom)
  })

  it('recusa o que nem id tem -- sem id nao da para casar a conferencia', () => {
    expect(lerTemplate({ ...templateBom, id: '' })).toBeNull()
    expect(lerTemplate(null)).toBeNull()
    expect(lerTemplate('estante')).toBeNull()
    expect(lerTemplate([templateBom])).toBeNull()
  })

  it('coage numero fora da faixa', () => {
    expect(lerTemplate({ ...templateBom, andares: -3 })?.andares).toBe(1)
    expect(lerTemplate({ ...templateBom, colunas: 999 })?.colunas).toBe(60)
    expect(lerTemplate({ ...templateBom, capacidadePorCelula: 0 })?.capacidadePorCelula).toBe(1)
  })

  it('trunca fracao', () => {
    expect(lerTemplate({ ...templateBom, andares: 6.7 })?.andares).toBe(6)
  })

  it('cai no padrao quando o campo nao da para aproveitar', () => {
    expect(lerTemplate({ ...templateBom, andares: 'seis' })?.andares).toBe(ESTANTE_PADRAO.andares)
    expect(lerTemplate({ id: 'x' })).toEqual({ id: 'x', ...ESTANTE_PADRAO })
  })

  it('limpa as listas de marcas e andares', () => {
    const t = lerTemplate({
      ...templateBom,
      marcasPermitidas: ['MultFila', 'MultFila', 7, ''],
      andaresBloqueados: [3, 3, 0, -2, 'x', 1],
    })

    expect(t?.marcasPermitidas).toEqual(['MultFila'])
    // Sem repetidos, sem andar zero ou negativo, e em ordem.
    expect(t?.andaresBloqueados).toEqual([1, 3])
  })

  it('nome vazio volta ao padrao', () => {
    expect(lerTemplate({ ...templateBom, nome: '' })?.nome).toBe(ESTANTE_PADRAO.nome)
  })
})

describe('lerTemplates', () => {
  it('devolve null quando a chave nunca foi gravada', () => {
    // Distingue "primeira execucao" de "o usuario apagou todas as estantes".
    expect(lerTemplates(undefined)).toBeNull()
    expect(lerTemplates({})).toBeNull()
  })

  it('respeita a lista vazia gravada de proposito', () => {
    expect(lerTemplates([])).toEqual({ templates: [], avisos: [] })
  })

  it('descarta so a entrada podre e avisa', () => {
    const r = lerTemplates([templateBom, null, { semId: true }])

    expect(r?.templates.map((t) => t.id)).toEqual(['estante-1'])
    expect(r?.avisos).toHaveLength(2)
  })

  it('descarta id repetido', () => {
    const r = lerTemplates([templateBom, { ...templateBom, nome: 'Outra' }])
    expect(r?.templates).toHaveLength(1)
  })
})

describe('lerCorrecoes', () => {
  it('aceita so os tres campos conhecidos', () => {
    expect(lerCorrecoes({ '261': { cor: 'AZUL', tipo: 'PLA', lixo: 1 } })).toEqual({
      '261': { cor: 'AZUL', tipo: 'PLA' },
    })
  })

  it('ignora entrada sem nenhum campo aproveitavel', () => {
    expect(lerCorrecoes({ '261': {}, '262': { cor: 7 }, '263': null })).toEqual({})
  })

  it('ignora codigo vazio', () => {
    expect(lerCorrecoes({ '': { cor: 'AZUL' } })).toEqual({})
  })

  it('devolve vazio para lixo', () => {
    expect(lerCorrecoes(null)).toEqual({})
    expect(lerCorrecoes(['261'])).toEqual({})
  })
})

describe('lerOrdemNomes', () => {
  it('mantem a ordem e descarta o que nao e texto', () => {
    expect(lerOrdemNomes(['PLA', 3, 'PETG', null])).toEqual(['PLA', 'PETG'])
  })

  it('nao repete', () => {
    expect(lerOrdemNomes(['PLA', 'PLA'])).toEqual(['PLA'])
  })

  it('devolve vazio para lixo', () => {
    expect(lerOrdemNomes({ PLA: 1 })).toEqual([])
  })
})

describe('lerConferencia', () => {
  it('le itens e data', () => {
    expect(
      lerConferencia({ iniciadaEm: '2026-08-14', itens: { '261': { marcados: [true, false] } } }),
    ).toEqual({ iniciadaEm: '2026-08-14', itens: { '261': { marcados: [true, false] } } })
  })

  it('coage qualquer coisa que nao seja true para false', () => {
    expect(
      lerConferencia({ itens: { '261': { marcados: [1, 'sim', true, null] } } })?.itens['261']
        ?.marcados,
    ).toEqual([false, false, true, false])
  })

  it('rejeita marcados que nao e array', () => {
    expect(lerConferencia({ itens: { '261': { marcados: true } } })?.itens).toEqual({})
  })

  it('aguenta itens ausente', () => {
    expect(lerConferencia({ iniciadaEm: '2026-08-14' })).toEqual({
      iniciadaEm: '2026-08-14',
      itens: {},
    })
  })
})

describe('lerConferencias', () => {
  it('indexa por estante e descarta entrada podre', () => {
    const r = lerConferencias({
      'estante-1': { iniciadaEm: 'x', itens: {} },
      'estante-2': 'lixo',
    })

    expect(Object.keys(r)).toEqual(['estante-1'])
  })

  it('devolve vazio para lixo', () => {
    expect(lerConferencias(null)).toEqual({})
  })
})
