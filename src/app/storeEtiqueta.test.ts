import { describe, expect, it } from 'vitest'
import { modeloPadrao } from '@/core/etiqueta/modelo'
import type { Modelo } from '@/core/etiqueta/tipos'
import { desfazer, HISTORICO_VAZIO, refazer, registrar } from './storeEtiqueta'

const comNome = (nome: string): Modelo => ({ ...modeloPadrao(), nome })

describe('historico', () => {
  it('nao desfaz nada quando esta vazio', () => {
    expect(desfazer(HISTORICO_VAZIO, comNome('a'))).toBeNull()
  })

  it('nao refaz nada quando esta vazio', () => {
    expect(refazer(HISTORICO_VAZIO, comNome('a'))).toBeNull()
  })

  it('desfaz de volta ao estado registrado', () => {
    const a = comNome('a')
    const h = registrar(HISTORICO_VAZIO, a)
    const r = desfazer(h, comNome('b'))

    expect(r?.modelo.nome).toBe('a')
    expect(r?.historico.passado).toHaveLength(0)
    expect(r?.historico.futuro).toHaveLength(1)
  })

  it('refaz o que foi desfeito', () => {
    const h = registrar(HISTORICO_VAZIO, comNome('a'))
    const desfeito = desfazer(h, comNome('b'))!
    const refeito = refazer(desfeito.historico, desfeito.modelo)

    expect(refeito?.modelo.nome).toBe('b')
  })

  it('faz e desfaz varios passos na ordem certa', () => {
    let historico = HISTORICO_VAZIO
    historico = registrar(historico, comNome('1'))
    historico = registrar(historico, comNome('2'))

    const p1 = desfazer(historico, comNome('3'))!
    expect(p1.modelo.nome).toBe('2')
    const p2 = desfazer(p1.historico, p1.modelo)!
    expect(p2.modelo.nome).toBe('1')
  })

  it('uma alteracao nova descarta o futuro', () => {
    // É o que todo editor faz: desfazer e então mexer em outra coisa
    // apaga o caminho que havia à frente.
    const h = registrar(HISTORICO_VAZIO, comNome('a'))
    const desfeito = desfazer(h, comNome('b'))!
    expect(desfeito.historico.futuro).toHaveLength(1)

    const novo = registrar(desfeito.historico, comNome('c'))
    expect(novo.futuro).toHaveLength(0)
  })

  it('limita o tamanho do passado', () => {
    let historico = HISTORICO_VAZIO
    for (let i = 0; i < 200; i++) historico = registrar(historico, comNome(String(i)))

    expect(historico.passado.length).toBeLessThanOrEqual(60)
    // O mais recente sobrevive; os antigos é que caem.
    expect(historico.passado.at(-1)!.nome).toBe('199')
  })
})
