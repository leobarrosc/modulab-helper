import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerCsv, type LinhaCsv, type Planilha } from '../csv'
import { ehNomeDeCor } from './cores'
import {
  aplicarCorrecao,
  classificarLinha,
  classificarProduto,
  codigoDaLinha,
  corDaDescricao,
  niveisCategoria,
  tipoDaCategoria,
} from './classificar'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')
const planilhaReal = (): Planilha => lerCsv(new Uint8Array(readFileSync(CSV_REAL)))

const linha = (campos: Partial<LinhaCsv> = {}): LinhaCsv => ({
  'Código': '',
  'Descrição': '',
  'Marca': '',
  'Categoria do produto': '',
  ...campos,
})

describe('niveisCategoria', () => {
  it('quebra na hierarquia do Bling e descarta niveis vazios', () => {
    expect(niveisCategoria('Filamentos>>PLA>>Silk')).toEqual(['Filamentos', 'PLA', 'Silk'])
    expect(niveisCategoria('Filamentos>>>>PLA')).toEqual(['Filamentos', 'PLA'])
    expect(niveisCategoria('')).toEqual([])
  })
})

describe('tipoDaCategoria', () => {
  it('junta os niveis 2 e 3', () => {
    expect(tipoDaCategoria('Filamentos>>PLA>>Matte/Fosco')).toBe('PLA Matte/Fosco')
    expect(tipoDaCategoria('Filamentos>>PLA>>Silk')).toBe('PLA Silk')
    expect(tipoDaCategoria('Filamentos>>PLA>>Especiais')).toBe('PLA Especiais')
  })

  it('some com o nivel 3 generico -- "PLA Básico" na prateleira e so "PLA"', () => {
    expect(tipoDaCategoria('Filamentos>>PLA>>Básico')).toBe('PLA')
    expect(tipoDaCategoria('Filamentos>>PLA>>BASICO')).toBe('PLA')
    expect(tipoDaCategoria('Filamentos>>PETG>>Comum')).toBe('PETG')
  })

  it('aceita categoria de dois niveis', () => {
    expect(tipoDaCategoria('Filamentos>>TPU')).toBe('TPU')
  })

  it('devolve vazio quando nao ha nivel 2', () => {
    expect(tipoDaCategoria('Filamentos')).toBe('')
    expect(tipoDaCategoria('')).toBe('')
  })
})

describe('corDaDescricao', () => {
  it('tira FILAMENTO e as palavras do tipo', () => {
    expect(corDaDescricao('FILAMENTO PLA MATTE ROSA CLARO', 'PLA Matte/Fosco')).toBe('ROSA CLARO')
  })

  it('casa MATTE da descricao contra Matte/Fosco da categoria', () => {
    // A categoria escreve "Matte/Fosco" e a descricao so "MATTE". Sem quebrar
    // no "/", o MATTE vazaria para dentro da cor.
    expect(corDaDescricao('FILAMENTO PLA MATTE PRETO', 'PLA Matte/Fosco')).toBe('PRETO')
  })

  it('preserva o que nao faz parte do tipo', () => {
    expect(corDaDescricao('FILAMENTO PLA MARRON MADEIRA', 'PLA Especiais')).toBe('MARRON MADEIRA')
    expect(corDaDescricao('FILAMENTO PLA SILK RAINBOW FADA', 'PLA Silk')).toBe('RAINBOW FADA')
  })

  it('devolve vazio quando a descricao e so o tipo', () => {
    expect(corDaDescricao('FILAMENTO PLA', 'PLA')).toBe('')
    expect(corDaDescricao('', 'PLA')).toBe('')
  })

  it('ignora acento e caixa ao comparar', () => {
    expect(corDaDescricao('Filamento Pla Silk Azul', 'PLA Silk')).toBe('Azul')
  })
})

describe('corDaDescricao com o ruido das marcas reais', () => {
  const cor = (descricao: string, tipo = 'PLA', marca = '') =>
    corDaDescricao(descricao, tipo, { marca, ehCor: ehNomeDeCor })

  it('tira o nome da linha comercial e o peso -- 3D Prime', () => {
    expect(cor('Pla Basic Amarelo Peso:1KG')).toBe('Amarelo')
    expect(cor('Pla Premium Ht High Speed Verde Escuro Peso:1KG')).toBe('Verde Escuro')
    expect(cor('Pla Silk Rose Gold Peso:1KG', 'PLA Silk')).toBe('Rose Gold')
  })

  it('tira ruido depois da cor, e nao so antes -- MasterPrint', () => {
    // "1KG (1.75MM) DER 4" vem DEPOIS do nome da cor: um recorte so de prefixo
    // nao alcancaria.
    expect(cor('MP-FILAMENTO 3D - PETG VERDE 1KG (1.75MM) DER 4', 'PETG')).toBe('VERDE')
    expect(cor('MP-FILAMENTO 3D - ASA BRANCO ROLO 1KG (1.75MM) DER 4', 'ASA')).toBe('BRANCO')
  })

  it('tira o prefixo de uso -- Creality', () => {
    expect(cor('FILAMENTO P/ IMP 3D CR-PETG Branco', 'PETG')).toBe('Branco')
    expect(cor('FILAMENTO P/ IMP 3D HYPER PLA CINZA')).toBe('CINZA')
  })

  it('quebra no hifen e tira a marca -- Bambu Lab', () => {
    expect(cor('BAMBU PLA LITE-CIANO', 'PLA', 'Bambu Lab')).toBe('CIANO')
    expect(cor('FILAMENTO PLA LITE LARANJA REFIL')).toBe('LARANJA')
  })

  it('tira numero de serie solto', () => {
    expect(cor('FILAMENTO TPU 9075 PRETO', 'TPU/Flexivel')).toBe('PRETO')
  })

  it('mantem o acabamento, que faz parte do nome da cor', () => {
    expect(cor('Petg  Preto Fume Translucido Peso:1KG', 'PETG')).toBe('Preto Fume Translucido')
    expect(cor('Filamento PLA Marrom Cappuccino Velvet - 1kg')).toBe('Marrom Cappuccino Velvet')
  })

  it('nunca descarta uma palavra que e nome de cor', () => {
    // "CINZA" nao pode sumir so porque o usuario mandou ignora-la.
    expect(corDaDescricao('FILAMENTO PLA CINZA', 'PLA', {
      palavrasIgnoradas: ['CINZA'],
      ehCor: ehNomeDeCor,
    })).toBe('CINZA')
  })

  it('aceita as palavras extras do usuario', () => {
    expect(
      corDaDescricao('FILAMENTO PLA EDITION AZUL', 'PLA', {
        palavrasIgnoradas: ['edition'],
        ehCor: ehNomeDeCor,
      }),
    ).toBe('AZUL')
  })

  it('deixa o multicolor inteiro, que e onde a regra para', () => {
    // Nao tem matiz unico; o lugar dele e o grupo do fim, nao uma cor errada.
    expect(cor('FILAMENTO PLA SILK DUAL COLOR DOURADO E VERMELHO', 'PLA Silk')).toBe(
      'DUAL COLOR DOURADO E VERMELHO',
    )
  })
})

describe('classificarLinha', () => {
  it('junta os tres eixos', () => {
    expect(
      classificarLinha(
        linha({
          Marca: 'MultFila',
          'Descrição': 'FILAMENTO PLA MATTE VERDE MILITAR',
          'Categoria do produto': 'Filamentos>>PLA>>Matte/Fosco',
        }),
      ),
    ).toEqual({ marca: 'MultFila', tipo: 'PLA Matte/Fosco', cor: 'VERDE MILITAR' })
  })

  it('aguenta linha sem nenhuma das colunas', () => {
    expect(classificarLinha({})).toEqual({ marca: '', tipo: '', cor: '' })
  })
})

describe('aplicarCorrecao', () => {
  const base = { marca: 'MultFila', tipo: 'PLA Especiais', cor: 'MARMORIZADO' }

  it('sobrescreve so o campo informado', () => {
    expect(aplicarCorrecao(base, { cor: 'CINZA' })).toEqual({ ...base, cor: 'CINZA' })
  })

  it('mantem o derivado quando a correcao vem vazia', () => {
    // Apagar o texto na tela volta ao automatico, em vez de gravar vazio.
    expect(aplicarCorrecao(base, { cor: '' })).toEqual(base)
    expect(aplicarCorrecao(base, {})).toEqual(base)
    expect(aplicarCorrecao(base, undefined)).toEqual(base)
  })
})

describe('classificarProduto com o arquivo real', () => {
  it('classifica os 12 produtos do export do Bling', () => {
    const planilha = planilhaReal()
    const resultado = planilha.linhas.map((l) => ({
      codigo: codigoDaLinha(l),
      ...classificarProduto(l, {}),
    }))

    expect(resultado).toEqual([
      { codigo: '261', marca: 'MultFila', tipo: 'PLA', cor: 'PRETO' },
      { codigo: '262', marca: 'MultFila', tipo: 'PLA Especiais', cor: 'MARRON MADEIRA' },
      { codigo: '263', marca: 'MultFila', tipo: 'PLA Especiais', cor: 'MARMORIZADO' },
      { codigo: '264', marca: 'MultFila', tipo: 'PLA', cor: 'LAVANDA' },
      { codigo: '265', marca: 'MultFila', tipo: 'PLA Matte/Fosco', cor: 'BRANCO' },
      { codigo: '266', marca: 'MultFila', tipo: 'PLA Matte/Fosco', cor: 'ROSA CLARO' },
      { codigo: '267', marca: 'MultFila', tipo: 'PLA Matte/Fosco', cor: 'PRETO' },
      { codigo: '268', marca: 'MultFila', tipo: 'PLA Matte/Fosco', cor: 'VERDE MILITAR' },
      { codigo: '269', marca: 'MultFila', tipo: 'PLA Especiais', cor: 'RAINBOW CANDY COLORS' },
      { codigo: '270', marca: 'MultFila', tipo: 'PLA Silk', cor: 'RAINBOW FADA' },
      { codigo: '271', marca: 'MultFila', tipo: 'PLA Silk', cor: 'RAINBOW ALGODAO DOCE' },
      {
        codigo: '272',
        marca: 'MultFila',
        tipo: 'PLA Silk',
        cor: 'TRICOLOR DOURADO VERMELHO AZUL',
      },
    ])
  })

  it('a correcao manual e chaveada pelo Código', () => {
    const planilha = planilhaReal()
    const correcoes = { '263': { cor: 'CINZA', tipo: 'PLA Cristal' } }

    const linha263 = planilha.linhas.find((l) => codigoDaLinha(l) === '263')
    expect(linha263).toBeDefined()
    expect(classificarProduto(linha263!, correcoes)).toEqual({
      marca: 'MultFila',
      tipo: 'PLA Cristal',
      cor: 'CINZA',
    })
  })

  it('limpa a tab que o Bling cola no Código', () => {
    const planilha = planilhaReal()
    // O valor cru vem como "261\t"; a chave de persistencia nao pode levar isso.
    expect(codigoDaLinha(planilha.linhas[0]!)).toBe('261')
  })
})
