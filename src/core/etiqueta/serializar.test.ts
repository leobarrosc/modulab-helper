import { describe, expect, it } from 'vitest'
import { modeloPadrao } from './modelo'
import { lerModelo, modeloParaJson, serializarModelo, VERSAO_MODELO } from './serializar'

describe('ida e volta', () => {
  it('serializar e ler devolve o mesmo modelo', () => {
    const original = modeloPadrao()
    const { modelo, avisos } = lerModelo(JSON.parse(modeloParaJson(original)))

    expect(avisos).toEqual([])
    expect(modelo.nome).toBe(original.nome)
    expect(modelo.campos).toHaveLength(original.campos.length)
    expect(modelo.campos.map((c) => c.tipo)).toEqual(original.campos.map((c) => c.tipo))
    expect(modelo.campos[0]!.fonte?.tamanhoPct).toBe(original.campos[0]!.fonte?.tamanhoPct)
  })

  it('o envelope declara a versão atual', () => {
    expect(serializarModelo(modeloPadrao()).versao).toBe(VERSAO_MODELO)
  })

  it('aceita o modelo solto, sem envelope', () => {
    const { modelo } = lerModelo(modeloPadrao())
    expect(modelo.campos).toHaveLength(3)
  })
})

describe('entrada hostil ou corrompida', () => {
  it('rejeita o que não é modelo', () => {
    expect(() => lerModelo('texto qualquer')).toThrow(/não parece/i)
    expect(() => lerModelo(null)).toThrow()
    expect(() => lerModelo(42)).toThrow()
  })

  it('descarta campos ilegíveis e avisa', () => {
    const { modelo, avisos } = lerModelo({
      nome: 'X',
      campos: [{ tipo: 'texto', template: '{A}' }, 'lixo', null, 7],
    })
    expect(modelo.campos).toHaveLength(1)
    expect(avisos.join(' ')).toMatch(/descartad/i)
  })

  it('coage números fora da faixa para dentro da etiqueta', () => {
    const { modelo } = lerModelo({
      campos: [{ tipo: 'texto', x: 5, y: -3, w: 99, h: 0.5, template: '{A}' }],
    })
    const c = modelo.campos[0]!
    expect(c.x).toBeLessThanOrEqual(1)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.x + c.w).toBeLessThanOrEqual(1)
    expect(c.y + c.h).toBeLessThanOrEqual(1)
  })

  it('NaN e Infinity viram padrão, nunca passam', () => {
    const { modelo } = lerModelo({
      campos: [{ tipo: 'texto', x: Number.NaN, w: Number.POSITIVE_INFINITY, template: '{A}' }],
    })
    const c = modelo.campos[0]!
    expect(Number.isFinite(c.x)).toBe(true)
    expect(Number.isFinite(c.w)).toBe(true)
  })

  it('simbologia desconhecida cai para Code 128 com aviso', () => {
    const { modelo, avisos } = lerModelo({
      campos: [{ tipo: 'codigo', simbologia: 'datamatrix-do-futuro', template: '{A}' }],
    })
    expect(modelo.campos[0]!.simbologia).toBe('code128')
    expect(avisos.join(' ')).toMatch(/desconhecida/i)
  })

  it('fonte em pt (formato antigo) volta ao padrão com aviso', () => {
    const { modelo, avisos } = lerModelo({
      campos: [{ tipo: 'texto', template: '{A}', fonte: { familia: 'Helvetica', tamanhoPt: 8 } }],
    })
    expect(modelo.campos[0]!.fonte?.tamanhoPct).toBeCloseTo(0.09, 6)
    expect(avisos.join(' ')).toMatch(/formato antigo/i)
  })

  it('ids repetidos são renumerados', () => {
    const { modelo } = lerModelo({
      campos: [
        { tipo: 'texto', id: 'igual', template: '{A}' },
        { tipo: 'texto', id: 'igual', template: '{B}' },
      ],
    })
    expect(modelo.campos[0]!.id).not.toBe(modelo.campos[1]!.id)
  })

  it('versão mais nova gera aviso mas não trava', () => {
    const { avisos } = lerModelo({ versao: 99, modelo: modeloPadrao() })
    expect(avisos.join(' ')).toMatch(/versão mais nova/i)
  })

  it('tipo desconhecido vira texto em vez de quebrar', () => {
    const { modelo } = lerModelo({ campos: [{ tipo: 'holograma', template: '{A}' }] })
    expect(modelo.campos[0]!.tipo).toBe('texto')
  })

  it('strings gigantes são truncadas', () => {
    const { modelo } = lerModelo({
      nome: 'N'.repeat(5000),
      campos: [{ tipo: 'texto', template: 'T'.repeat(5000) }],
    })
    expect(modelo.nome.length).toBeLessThanOrEqual(80)
    expect(modelo.campos[0]!.template.length).toBeLessThanOrEqual(500)
  })
})
