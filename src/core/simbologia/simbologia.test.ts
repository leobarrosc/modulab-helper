import { describe, expect, it } from 'vitest'
import { codificar } from './codificar'
import { SIMBOLOGIAS } from './registro'
import { desenharCodigo, MODULO_MINIMO_MM } from '../render/codigo'

const ok = (id: string, valor: string) => {
  const r = codificar(id, valor)
  if (!r.ok) throw new Error(`esperava sucesso, veio: ${r.erro}`)
  return r.simbolo
}

describe('registro', () => {
  it('tem as 19 simbologias pedidas', () => {
    expect(SIMBOLOGIAS).toHaveLength(19)
  })

  it('nao tem id repetido', () => {
    const ids = SIMBOLOGIAS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todas estao prontas -- o bwip-js cobre as 19', () => {
    expect(SIMBOLOGIAS.filter((s) => s.estado !== 'pronta')).toEqual([])
  })
})

describe('codificar todas as simbologias do catalogo', () => {
  // Um valor valido para cada uma, para provar que o bcid esta certo.
  const amostras: Record<string, string> = {
    code128: '16668223671',
    qrcode: '16668223671',
    ean13: '789875718121',
    ean8: '1234567',
    upca: '12345678901',
    upce: '0123456',
    code39: 'ABC123',
    code39ext: 'Abc123',
    code93: 'ABC123',
    code11: '12345',
    'gs1-128': '(01)12345678901231',
    interleaved2of5: '123456',
    industrial2of5: '123456',
    msi: '1234567',
    rationalizedCodabar: 'A12345A',
    isbn: '978-1-56581-231-4',
    postnet: '12345',
    ean2: '12',
    ean5: '12345',
  }

  for (const simbologia of SIMBOLOGIAS) {
    it(`${simbologia.nome} gera um símbolo`, () => {
      const amostra = amostras[simbologia.id]
      expect(amostra, `falta amostra para ${simbologia.id}`).toBeDefined()

      const simbolo = ok(simbologia.id, amostra!)
      expect(simbolo.tipo).toBe(simbologia.tipo)

      if (simbolo.tipo === 'linear') {
        expect(simbolo.barras.length).toBeGreaterThan(0)
        expect(simbolo.larguraModulos).toBeGreaterThan(0)
      } else {
        expect(simbolo.colunas).toBeGreaterThan(0)
        expect(simbolo.modulos).toHaveLength(simbolo.colunas * simbolo.linhas)
      }
    })
  }
})

describe('estrutura do Code 128', () => {
  it('tem 31 barras e 112 modulos para o ID do CSV', () => {
    const s = ok('code128', '16668223671')
    if (s.tipo !== 'linear') throw new Error('esperava linear')
    expect(s.barras).toHaveLength(31)
    expect(s.larguraModulos).toBe(112)
  })

  it('as barras nao se sobrepoem e ficam em ordem', () => {
    const s = ok('code128', '16668223671')
    if (s.tipo !== 'linear') throw new Error('esperava linear')

    for (let i = 1; i < s.barras.length; i++) {
      const anterior = s.barras[i - 1]!
      const atual = s.barras[i]!
      expect(atual.xModulos).toBeGreaterThanOrEqual(anterior.xModulos + anterior.larguraModulos)
    }
  })

  it('todas as barras tem altura cheia', () => {
    const s = ok('code128', '16668223671')
    if (s.tipo !== 'linear') throw new Error('esperava linear')
    for (const b of s.barras) expect(b.alturaFracao).toBeCloseTo(1, 6)
  })
})

describe('PostNet usa barras de alturas diferentes', () => {
  it('tem barras cheias e barras curtas', () => {
    // Se `bhs` fosse ignorado, todas sairiam iguais e o codigo seria ilegivel.
    const s = ok('postnet', '12345')
    if (s.tipo !== 'linear') throw new Error('esperava linear')

    const alturas = [...new Set(s.barras.map((b) => Math.round(b.alturaFracao * 100)))]
    expect(alturas).toHaveLength(2)
    expect(Math.max(...alturas)).toBe(100)
    expect(Math.min(...alturas)).toBeLessThan(50)
  })
})

describe('QR Code', () => {
  it('gera matriz quadrada com os padroes de posicionamento', () => {
    const s = ok('qrcode', '16668223671')
    if (s.tipo !== 'matriz') throw new Error('esperava matriz')

    expect(s.colunas).toBe(s.linhas)
    // O olho de posicionamento do canto superior esquerdo e 7x7 com borda cheia.
    for (let i = 0; i < 7; i++) expect(s.modulos[i]).toBe(true)
  })
})

describe('erros de conteudo viram mensagem, nao excecao', () => {
  it('letra numa simbologia numerica', () => {
    const r = codificar('ean13', 'ABC')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/EAN-13/)
  })

  it('quantidade errada de digitos', () => {
    const r = codificar('ean13', '123')
    expect(r.ok).toBe(false)
  })

  it('valor vazio', () => {
    const r = codificar('code128', '')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/sem valor/i)
  })

  it('simbologia desconhecida', () => {
    const r = codificar('inexistente', '123')
    expect(r.ok).toBe(false)
  })

  it('o GTIN real do CSV funciona em EAN-13', () => {
    expect(codificar('ean13', '7898757181218').ok).toBe(true)
  })
})

describe('desenharCodigo', () => {
  const caixa = { xMm: 5, yMm: 10, larguraMm: 40, alturaMm: 15 }

  it('gera um retangulo por barra, dentro da caixa', () => {
    const s = ok('code128', '16668223671')
    const { ops } = desenharCodigo(s, caixa)

    expect(ops).toHaveLength(31)
    for (const op of ops) {
      if (op.op !== 'rect') throw new Error('esperava rect')
      expect(op.xMm).toBeGreaterThanOrEqual(caixa.xMm - 1e-9)
      expect(op.xMm + op.larguraMm).toBeLessThanOrEqual(caixa.xMm + caixa.larguraMm + 1e-9)
      expect(op.yMm).toBeGreaterThanOrEqual(caixa.yMm - 1e-9)
      expect(op.yMm + op.alturaMm).toBeLessThanOrEqual(caixa.yMm + caixa.alturaMm + 1e-9)
    }
  })

  it('calcula a largura do modulo e avisa quando fica ilegivel', () => {
    const s = ok('code128', '16668223671')

    // 112 modulos em 40 mm -> 0,357 mm por modulo: legivel.
    const largo = desenharCodigo(s, caixa)
    expect(largo.diagnostico.moduloMm).toBeCloseTo(40 / 112, 6)
    expect(largo.diagnostico.legivel).toBe(true)

    // 112 modulos em 20 mm -> 0,179 mm: fino demais.
    const estreito = desenharCodigo(s, { ...caixa, larguraMm: 20 })
    expect(estreito.diagnostico.moduloMm).toBeLessThan(MODULO_MINIMO_MM)
    expect(estreito.diagnostico.legivel).toBe(false)
  })

  it('a barra curta do PostNet fica assentada na base', () => {
    const s = ok('postnet', '12345')
    const { ops } = desenharCodigo(s, caixa)
    const base = caixa.yMm + caixa.alturaMm

    for (const op of ops) {
      if (op.op !== 'rect') throw new Error('esperava rect')
      expect(op.yMm + op.alturaMm).toBeCloseTo(base, 6)
    }
  })

  it('QR sai quadrado e centralizado numa caixa retangular', () => {
    const s = ok('qrcode', '16668223671')
    const { ops, diagnostico } = desenharCodigo(s, caixa)

    // Menor lado = 15 mm; sobra 25 mm na largura, 12,5 de cada lado.
    expect(diagnostico.larguraUsadaMm).toBe(15)
    const xs = ops.map((o) => (o.op === 'rect' ? o.xMm : 0))
    expect(Math.min(...xs)).toBeCloseTo(caixa.xMm + 12.5, 6)
  })

  it('junta modulos vizinhos do QR em menos retangulos', () => {
    const s = ok('qrcode', '16668223671')
    if (s.tipo !== 'matriz') throw new Error('esperava matriz')

    const escuros = s.modulos.filter(Boolean).length
    const { ops } = desenharCodigo(s, caixa)
    expect(ops.length).toBeLessThan(escuros)
  })

  it('os retangulos juntados reconstroem a matriz exata', () => {
    // Comparar só a área total passaria mesmo com módulos em posições erradas.
    // Aqui a matriz é remontada célula a célula a partir dos retângulos.
    const s = ok('qrcode', '16668223671')
    if (s.tipo !== 'matriz') throw new Error('esperava matriz')

    const { ops, diagnostico } = desenharCodigo(s, caixa)
    const m = diagnostico.moduloMm
    const lado = diagnostico.larguraUsadaMm
    const x0 = caixa.xMm + (caixa.larguraMm - lado) / 2
    const y0 = caixa.yMm + (caixa.alturaMm - lado) / 2

    const remontada = new Array<boolean>(s.colunas * s.linhas).fill(false)
    for (const op of ops) {
      if (op.op !== 'rect') throw new Error('esperava rect')
      const coluna = Math.round((op.xMm - x0) / m)
      const linha = Math.round((op.yMm - y0) / m)
      const largura = Math.round(op.larguraMm / m)
      for (let c = coluna; c < coluna + largura; c++) remontada[linha * s.colunas + c] = true
    }

    expect(remontada).toEqual(s.modulos)
  })
})
