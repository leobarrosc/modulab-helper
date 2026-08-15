import { describe, expect, it } from 'vitest'
import {
  compararCor,
  compararTextoCor,
  hexDaCor,
  identificarCor,

  CORES_CONHECIDAS,
} from './cores'
import { normalizarTexto } from './texto'

/** Ordena uma lista de cores pelo comparador, para ler o resultado de uma vez. */
const ordenar = (cores: string[]): string[] => [...cores].sort(compararTextoCor)

describe('normalizarTexto', () => {
  it('tira acento e sobe para maiuscula', () => {
    expect(normalizarTexto('Lilás')).toBe('LILAS')
    expect(normalizarTexto('limão')).toBe('LIMAO')
    expect(normalizarTexto('  Rosa Claro  ')).toBe('ROSA CLARO')
  })
})

describe('identificarCor', () => {
  it('reconhece a cor pura', () => {
    const info = identificarCor('PRETO')
    expect(info.grupo).toBe('neutro')
    expect(info.base?.chave).toBe('PRETO')
    expect(info.qualificador).toBe('')
  })

  it('separa a cor base do qualificador', () => {
    const info = identificarCor('ROSA CLARO')
    expect(info.base?.chave).toBe('ROSA')
    expect(info.qualificador).toBe('CLARO')
    expect(info.bruta).toBe('ROSA CLARO')
  })

  it('aceita MARRON sem M, que e como o Bling grava', () => {
    expect(identificarCor('MARRON MADEIRA').base?.chave).toBe('MARROM')
    expect(identificarCor('MARROM').base?.chave).toBe('MARROM')
  })

  it('reconhece LAVANDA, que existe no arquivo real', () => {
    expect(identificarCor('LAVANDA').grupo).toBe('cromatica')
  })

  it('manda multicolor e efeito para desconhecida', () => {
    // Nao tem matiz unico: nao ha lugar no arco-iris para um rolo tricolor.
    for (const cor of ['MARMORIZADO', 'RAINBOW CANDY COLORS', 'TRICOLOR DOURADO VERMELHO AZUL']) {
      const info = identificarCor(cor)
      expect(info.grupo).toBe('desconhecida')
      expect(info.base).toBeNull()
    }
  })

  it('acha a cor mesmo quando ela nao abre o nome', () => {
    // "LUMINOSO VERDE" e verde; o que vem antes vira qualificador.
    expect(identificarCor('LUMINOSO VERDE').base?.chave).toBe('VERDE')
    expect(identificarCor('Cor De Pele Caucasiano').base?.chave).toBe('PELE')
    expect(identificarCor('Ht Grafite').base?.chave).toBe('GRAFITE')
  })

  it('marcador de multicor vence a busca por cor', () => {
    // Sem isso, o TRICOLOR seria arquivado como dourado e o rolo iria parar no
    // meio dos dourados de uma cor so.
    const info = identificarCor('TRICOLOR COLOR DOURADO VERMELHO AZUL')
    expect(info.grupo).toBe('desconhecida')
    expect(info.base).toBeNull()

    expect(identificarCor('DUAL COLOR PRETO E VERMELHO').grupo).toBe('desconhecida')
    expect(identificarCor('Duo Color Shadow Verde e Ametista').grupo).toBe('desconhecida')
    expect(identificarCor('CRISTAL RAINBOW CORAL').grupo).toBe('desconhecida')
  })

  it('trata string vazia sem lancar', () => {
    const info = identificarCor('')
    expect(info.grupo).toBe('desconhecida')
    expect(info.bruta).toBe('')
  })

  it('ignora caixa e acento', () => {
    expect(identificarCor('lilás').base?.chave).toBe('LILAS')
  })
})

describe('compararCor', () => {
  it('poe Preto e Branco na frente de tudo -- sao os mais vendidos', () => {
    expect(ordenar(['VERMELHO', 'BRANCO', 'AZUL', 'PRETO'])).toEqual([
      'PRETO',
      'BRANCO',
      'VERMELHO',
      'AZUL',
    ])
  })

  it('ordena as cromaticas como um arco-iris', () => {
    const embaralhado = ['AZUL', 'AMARELO', 'VERMELHO', 'ROXO', 'VERDE', 'LARANJA']
    expect(ordenar(embaralhado)).toEqual([
      'VERMELHO',
      'LARANJA',
      'AMARELO',
      'VERDE',
      'AZUL',
      'ROXO',
    ])
  })

  it('poe os tres grupos nesta ordem: neutro, cromatica, desconhecida', () => {
    expect(ordenar(['MARMORIZADO', 'AZUL', 'PRETO'])).toEqual(['PRETO', 'AZUL', 'MARMORIZADO'])
  })

  it('mantem as variacoes coladas na cor que as nomeia', () => {
    // VERDE MILITAR fica no bloco verde, nao no M do alfabeto.
    expect(ordenar(['VERDE MILITAR', 'VERMELHO', 'VERDE', 'AZUL'])).toEqual([
      'VERMELHO',
      'VERDE',
      'VERDE MILITAR',
      'AZUL',
    ])
  })

  it('poe a cor pura antes das qualificadas', () => {
    expect(ordenar(['ROSA CLARO', 'ROSA', 'ROSA ESCURO'])).toEqual([
      'ROSA',
      'ROSA CLARO',
      'ROSA ESCURO',
    ])
  })

  it('desempata duas desconhecidas pelo collator pt-BR', () => {
    expect(ordenar(['ZEBRA', 'ÁGUA', 'MARMORIZADO'])).toEqual(['ÁGUA', 'MARMORIZADO', 'ZEBRA'])
  })

  it('e uma ordenacao total: comparar consigo mesmo da zero', () => {
    for (const cor of CORES_CONHECIDAS) {
      const info = identificarCor(cor.chave)
      expect(compararCor(info, info)).toBe(0)
    }
  })
})

describe('hexDaCor', () => {
  it('devolve o hex da cor base, para a bolinha da UI', () => {
    expect(hexDaCor('VERDE MILITAR')).toBe('#43a047')
  })

  it('devolve null quando nao ha cor base', () => {
    expect(hexDaCor('MARMORIZADO')).toBeNull()
  })
})

describe('catalogo de cores', () => {
  it('nao tem chave nem sinonimo repetido', () => {
    const palavras = CORES_CONHECIDAS.flatMap((c) => [c.chave, ...(c.sinonimos ?? [])])
    expect(new Set(palavras).size).toBe(palavras.length)
  })

  it('tem exatamente um dos dois campos de ordem, conforme o grupo', () => {
    for (const cor of CORES_CONHECIDAS) {
      if (cor.neutro) {
        expect(cor.ordemNeutro, cor.chave).toBeTypeOf('number')
        expect(cor.matizGraus, cor.chave).toBeUndefined()
      } else {
        expect(cor.matizGraus, cor.chave).toBeTypeOf('number')
        expect(cor.ordemNeutro, cor.chave).toBeUndefined()
      }
    }
  })

  it('nao repete grau de matiz -- empate deixaria a ordem ao acaso', () => {
    const graus = CORES_CONHECIDAS.filter((c) => !c.neutro).map((c) => c.matizGraus)
    expect(new Set(graus).size).toBe(graus.length)
  })
})
