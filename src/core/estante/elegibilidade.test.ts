import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { lerCsv, type LinhaCsv, type Planilha } from '../csv'
import {
  ativo,
  categoriaNaRaiz,
  marcaPermitida,
  marcasDaRaiz,
  produtoElegivel,
  produtosDaEstante,
  raizesCategoria,
} from './elegibilidade'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')
const planilhaReal = (): Planilha => lerCsv(new Uint8Array(readFileSync(CSV_REAL)))

const linha = (campos: Partial<LinhaCsv> = {}): LinhaCsv => ({
  'Código': '1',
  'Descrição': 'FILAMENTO PLA PRETO',
  'Marca': 'MultFila',
  'Categoria do produto': 'Filamentos>>PLA>>Básico',
  'Situação': 'Ativo',
  'Estoque': '5,0000',
  ...campos,
})

const planilhaDe = (linhas: LinhaCsv[]): Planilha => ({
  colunas: Object.keys(linhas[0] ?? {}),
  linhas,
  meta: {
    encoding: 'utf-8',
    tinhaBom: false,
    delimitador: ';',
    linhasBrutas: linhas.length,
    linhasVazias: 0,
  },
  avisos: [],
})

describe('categoriaNaRaiz', () => {
  it('aceita a raiz e o que desce dela', () => {
    expect(categoriaNaRaiz('Filamentos', 'Filamentos')).toBe(true)
    expect(categoriaNaRaiz('Filamentos>>PLA>>Silk', 'Filamentos')).toBe(true)
    expect(categoriaNaRaiz('Filamentos>>PLA>>Silk', 'Filamentos>>PLA')).toBe(true)
  })

  it('recusa quem so tem o prefixo de string', () => {
    // "FilamentosXPTO" comeca com "Filamentos" e nao e filamento nenhum.
    expect(categoriaNaRaiz('FilamentosXPTO>>Coisa', 'Filamentos')).toBe(false)
  })

  it('recusa outra arvore', () => {
    expect(categoriaNaRaiz('Resinas>>Standard', 'Filamentos')).toBe(false)
    expect(categoriaNaRaiz('Filamentos>>PLA', 'Filamentos>>PETG')).toBe(false)
  })

  it('ignora acento e caixa', () => {
    expect(categoriaNaRaiz('filamentos>>pla', 'Filamentos')).toBe(true)
  })

  it('raiz vazia nao casa com nada -- um template mal preenchido nao engole o catalogo', () => {
    expect(categoriaNaRaiz('Filamentos>>PLA', '')).toBe(false)
    expect(categoriaNaRaiz('', '')).toBe(false)
  })
})

describe('ativo', () => {
  it('so aceita Ativo', () => {
    expect(ativo(linha({ 'Situação': 'Ativo' }))).toBe(true)
    expect(ativo(linha({ 'Situação': 'Inativo' }))).toBe(false)
    expect(ativo(linha({ 'Situação': '' }))).toBe(false)
  })
})

describe('produtoElegivel', () => {
  it('exige ativo, dentro da raiz e com estoque', () => {
    expect(produtoElegivel(linha(), 'Filamentos')).toBe(true)
    expect(produtoElegivel(linha({ 'Situação': 'Inativo' }), 'Filamentos')).toBe(false)
    expect(produtoElegivel(linha({ 'Categoria do produto': 'Resinas>>X' }), 'Filamentos')).toBe(false)
  })

  it('estoque zero fica de fora -- a celula nao e reservada', () => {
    expect(produtoElegivel(linha({ Estoque: '0,0000' }), 'Filamentos')).toBe(false)
    expect(produtoElegivel(linha({ Estoque: '-3,0000' }), 'Filamentos')).toBe(false)
  })

  it('estoque fracionario arredonda para baixo', () => {
    // Meio rolo nao vai para a prateleira.
    expect(produtoElegivel(linha({ Estoque: '0,9000' }), 'Filamentos')).toBe(false)
    expect(produtoElegivel(linha({ Estoque: '1,4000' }), 'Filamentos')).toBe(true)
  })
})

describe('marcaPermitida', () => {
  it('lista vazia aceita todas -- e o estado de fabrica', () => {
    expect(marcaPermitida('MultFila', [])).toBe(true)
    expect(marcaPermitida('', [])).toBe(true)
  })

  it('so aceita quem esta na lista', () => {
    expect(marcaPermitida('MultFila', ['MultFila', '3D Prime'])).toBe(true)
    expect(marcaPermitida('Creality', ['MultFila', '3D Prime'])).toBe(false)
  })

  it('casa outra grafia da mesma marca', () => {
    expect(marcaPermitida('MULTFILA', ['MultFila'])).toBe(true)
  })
})

describe('produtoElegivel com marcas permitidas', () => {
  it('recusa a marca que nao esta na estante', () => {
    expect(produtoElegivel(linha({ Marca: 'Creality' }), 'Filamentos', ['MultFila'])).toBe(false)
    expect(produtoElegivel(linha({ Marca: 'MultFila' }), 'Filamentos', ['MultFila'])).toBe(true)
  })
})

describe('produtosDaEstante', () => {
  it('filtra pelas marcas da estante', () => {
    const { produtos } = produtosDaEstante(
      planilhaDe([
        linha({ 'Código': '1', Marca: 'MultFila' }),
        linha({ 'Código': '2', Marca: 'Creality' }),
        linha({ 'Código': '3', Marca: 'MULTFILA' }),
      ]),
      { raizCategoria: 'Filamentos', marcasPermitidas: ['MultFila'] },
    )

    // A grafia diferente entra junto: e a mesma marca.
    expect(produtos.map((p) => p.codigo)).toEqual(['1', '3'])
  })

  it('deduplica por Código e avisa', () => {
    const { produtos, avisos } = produtosDaEstante(planilhaDe([linha({ 'Código': '10' }), linha({ 'Código': '10' }), linha({ 'Código': '11' })]), { raizCategoria: 'Filamentos', correcoes: {} })

    expect(produtos.map((p) => p.codigo)).toEqual(['10', '11'])
    expect(avisos.join(' ')).toContain('10')
  })

  it('avisa quando a Marca vazia deixa o produto fora do filtro', () => {
    // O caso real: filamento ativo, com estoque, que o Bling gravou sem Marca.
    // A lista de marcas da estante nao mostra "vazio", entao sem aviso ele
    // sumiria do mapa sem explicacao e sem como incluir.
    const { produtos, avisos } = produtosDaEstante(
      planilhaDe([linha({ 'Código': '292', 'Marca': '' }), linha({ 'Código': '11' })]),
      { raizCategoria: 'Filamentos', marcasPermitidas: ['MultFila'] },
    )

    expect(produtos.map((p) => p.codigo)).toEqual(['11'])
    expect(avisos.join(' ')).toContain('292')
    expect(avisos.join(' ')).toContain('sem Marca')
  })

  it('sem filtro de marca o produto sem Marca entra, e nao ha o que avisar', () => {
    const { produtos, avisos } = produtosDaEstante(
      planilhaDe([linha({ 'Código': '292', 'Marca': '' })]),
      { raizCategoria: 'Filamentos' },
    )

    expect(produtos.map((p) => p.codigo)).toEqual(['292'])
    expect(avisos.join(' ')).not.toContain('sem Marca')
  })

  it('nao avisa por Marca quando o produto ja estava fora por outro motivo', () => {
    // Estoque zero: nao e o filtro de marca que o tirou, e apontar a Marca
    // mandaria o usuario corrigir o campo errado.
    const { avisos } = produtosDaEstante(
      planilhaDe([linha({ 'Código': '292', 'Marca': '', 'Estoque': '0' })]),
      { raizCategoria: 'Filamentos', marcasPermitidas: ['MultFila'] },
    )

    expect(avisos.join(' ')).not.toContain('sem Marca')
  })

  it('descarta linha sem Código, que e a chave de tudo', () => {
    const { produtos, avisos } = produtosDaEstante(planilhaDe([linha({ 'Código': '' }), linha({ 'Código': '11' })]), { raizCategoria: 'Filamentos', correcoes: {} })

    expect(produtos.map((p) => p.codigo)).toEqual(['11'])
    expect(avisos.join(' ')).toContain('sem Código')
  })

  it('aplica a correcao manual', () => {
    const { produtos } = produtosDaEstante(planilhaDe([linha({ 'Código': '10' })]), {
      raizCategoria: 'Filamentos',
      correcoes: { '10': { cor: 'AZUL' } },
    })
    expect(produtos[0]?.classificacao.cor).toBe('AZUL')
  })

  it('leva o estoque do deposito junto, para saber se da para repor', () => {
    const { produtos } = produtosDaEstante(planilhaDe([linha({ 'Código': '10', Estoque: '42,0000' })]), { raizCategoria: 'Filamentos', correcoes: {} })
    expect(produtos[0]?.estoqueDeposito).toBe(42)
  })
})

describe('com o arquivo real', () => {
  it('a raiz Filamentos rende 11 produtos -- o 272, zerado, fica de fora', () => {
    const { produtos } = produtosDaEstante(planilhaReal(), { raizCategoria: 'Filamentos', correcoes: {} })

    expect(produtos).toHaveLength(11)
    expect(produtos.map((p) => p.codigo)).not.toContain('272')
  })

  it('uma raiz que nao existe no arquivo rende zero', () => {
    expect(produtosDaEstante(planilhaReal(), { raizCategoria: 'Resinas', correcoes: {} }).produtos).toHaveLength(0)
  })

  it('raizesCategoria lista o nivel 1 do arquivo', () => {
    expect(raizesCategoria(planilhaReal())).toEqual(['Filamentos'])
  })

  it('marcasDaRaiz nao aplica o filtro de marcas', () => {
    // Se aplicasse, escolher uma marca faria as outras sumirem da tela e nao
    // daria para marcar de volta.
    expect(marcasDaRaiz(planilhaReal(), 'Filamentos')).toEqual(['MultFila'])
  })
})
