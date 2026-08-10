import { describe, expect, it } from 'vitest'
import { colunasUsadas, resolver } from './resolver'
import { encaixarMovimento, encaixarRedimensionamento, limitarAEtiqueta, OPCOES_ENCAIXE_PADRAO } from './encaixe'
import { criarCampo, modeloPadrao, reordenarCampo, duplicarCampo, atualizarCampo } from './modelo'
import { cortarComReticencias, larguraTexto, quebrarLinhas, tamanhoQueCabe } from './metricas'
import { renderizarEtiqueta } from './render'
import type { LinhaCsv } from '../csv'
import type { FonteMedida } from './tipos'

const linha: LinhaCsv = {
  'ID': '16668223671',
  'Código': '261',
  'Descrição': 'FILAMENTO PLA PRETO',
  'Preço': '119,90',
  'Estoque': '42,0000',
  'GTIN/EAN': '',
  'Categoria do produto': 'Filamentos>>PLA>>Básico',
}

const ctx = { linha, indice: 3, total: 84 }
// As métricas trabalham em mm; a % só é resolvida pelo renderizador.
const fonte = (tamanhoMm = 2.8): FonteMedida => ({
  familia: 'Helvetica',
  tamanhoMm,
  negrito: false,
  italico: false,
})

describe('resolver', () => {
  it('substitui uma coluna', () => {
    expect(resolver('{Descrição}', ctx)).toBe('FILAMENTO PLA PRETO')
  })

  it('mistura texto livre com chaves', () => {
    expect(resolver('Cód. {Código} — un.', ctx)).toBe('Cód. 261 — un.')
  })

  it('formata moeda', () => {
    // O Intl do pt-BR separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0),
    // não com espaço comum. Escrito explícito para o teste não mentir.
    expect(resolver('{Preço|moeda}', ctx)).toBe('R$ 119,90')
  })

  it('encadeia formatadores', () => {
    expect(resolver('{Descrição|minuscula|corta:12}', ctx)).toBe('filamento p…')
  })

  it('extrai o último nível da categoria', () => {
    expect(resolver('{Categoria do produto|ultimo}', ctx)).toBe('Básico')
  })

  it('formata estoque sem as casas decimais', () => {
    expect(resolver('{Estoque|numero:0}', ctx)).toBe('42')
  })

  it('cai na alternativa quando a coluna está vazia', () => {
    // O caso real: 10 dos 12 produtos não têm GTIN/EAN.
    expect(resolver('{GTIN/EAN ?? Código}', ctx)).toBe('261')
  })

  it('usa a primeira alternativa quando ela tem valor', () => {
    expect(resolver('{Código ?? ID}', ctx)).toBe('261')
  })

  it('coluna inexistente vira vazio, nunca "undefined"', () => {
    expect(resolver('{NãoExiste}', ctx)).toBe('')
    expect(resolver('x{NãoExiste}y', ctx)).toBe('xy')
  })

  it('resolve colunas virtuais', () => {
    expect(resolver('{_indice}/{_total}', ctx)).toBe('3/84')
  })

  it('lista as colunas citadas', () => {
    expect(colunasUsadas('{Descrição} {Preço|moeda} {GTIN/EAN ?? Código}').sort()).toEqual(
      ['Código', 'Descrição', 'GTIN/EAN', 'Preço'].sort(),
    )
  })
})

describe('metricas de texto', () => {
  it('texto maior é mais largo', () => {
    expect(larguraTexto('MMMM', fonte())).toBeGreaterThan(larguraTexto('iiii', fonte()))
  })

  it('largura escala com o tamanho da fonte', () => {
    const a = larguraTexto('ABC', fonte(2.8))
    const b = larguraTexto('ABC', fonte(5.6))
    expect(b).toBeCloseTo(a * 2, 6)
  })

  it('acentuado mede como a letra base', () => {
    expect(larguraTexto('a', fonte())).toBeCloseTo(larguraTexto('á', fonte()), 9)
  })

  it('Courier tem largura fixa', () => {
    const f: FonteMedida = { ...fonte(), familia: 'Courier' }
    expect(larguraTexto('iii', f)).toBeCloseTo(larguraTexto('MMM', f), 9)
  })

  it('cortarComReticencias respeita a largura', () => {
    const largura = larguraTexto('FILAMENTO', fonte())
    const cortado = cortarComReticencias('FILAMENTO PLA PRETO MATTE', fonte(), largura)
    expect(cortado.endsWith('…')).toBe(true)
    expect(larguraTexto(cortado, fonte())).toBeLessThanOrEqual(largura + 1e-9)
  })

  it('não corta o que já cabe', () => {
    expect(cortarComReticencias('ABC', fonte(), 100)).toBe('ABC')
  })

  it('tamanhoQueCabe reduz o suficiente e não mais', () => {
    const texto = 'FILAMENTO PLA SILK TRICOLOR DOURADO VERMELHO AZUL'
    const alvo = 30
    const reduzido = tamanhoQueCabe(texto, fonte(3.5), alvo)

    expect(reduzido).toBeLessThan(3.5)
    expect(larguraTexto(texto, fonte(reduzido))).toBeLessThanOrEqual(alvo)
  })

  it('tamanhoQueCabe não aumenta o que já cabe', () => {
    expect(tamanhoQueCabe('AB', fonte(2.8), 500)).toBe(2.8)
  })

  it('quebrarLinhas respeita o máximo', () => {
    const linhas = quebrarLinhas('FILAMENTO PLA SILK TRICOLOR DOURADO VERMELHO AZUL', fonte(), 20, 2)
    expect(linhas.length).toBeLessThanOrEqual(2)
  })
})

describe('encaixe', () => {
  const opcoes = OPCOES_ENCAIXE_PADRAO
  const outro = criarCampo('texto', { x: 0.3, y: 0.4, w: 0.2, h: 0.1 })

  it('gruda na borda esquerda da etiqueta', () => {
    const r = encaixarMovimento({ x: 0.005, y: 0.5, w: 0.2, h: 0.1 }, [], opcoes)
    expect(r.retangulo.x).toBe(0)
    expect(r.guias.some((g) => g.eixo === 'vertical' && g.origem === 'borda')).toBe(true)
  })

  it('gruda no centro pela metade do campo', () => {
    // Centro do campo em 0,505 -> encaixa o campo centralizado na etiqueta.
    const r = encaixarMovimento({ x: 0.405, y: 0.1, w: 0.2, h: 0.1 }, [], opcoes)
    expect(r.retangulo.x).toBeCloseTo(0.4, 6)
    expect(r.guias.some((g) => g.origem === 'centro')).toBe(true)
  })

  it('gruda na borda de outro campo', () => {
    const r = encaixarMovimento({ x: 0.305, y: 0.8, w: 0.1, h: 0.1 }, [outro], opcoes)
    expect(r.retangulo.x).toBeCloseTo(0.3, 6)
    expect(r.guias.some((g) => g.origem === 'campo')).toBe(true)
  })

  it('não mexe no que está longe de tudo', () => {
    const r = encaixarMovimento({ x: 0.17, y: 0.62, w: 0.1, h: 0.1 }, [], { ...opcoes, passo: 0 })
    expect(r.retangulo.x).toBeCloseTo(0.17, 6)
    expect(r.guias).toEqual([])
  })

  it('a grade só age quando nenhuma guia pegou', () => {
    const comPasso = { ...opcoes, passo: 0.05 }
    // 0,005 está perto da borda 0: a guia ganha da grade.
    expect(encaixarMovimento({ x: 0.005, y: 0.5, w: 0.1, h: 0.1 }, [], comPasso).retangulo.x).toBe(0)
    // 0,17 não tem guia perto: cai no múltiplo de 0,05.
    expect(
      encaixarMovimento({ x: 0.17, y: 0.5, w: 0.1, h: 0.1 }, [], comPasso).retangulo.x,
    ).toBeCloseTo(0.15, 6)
  })

  it('redimensionar pelo leste move só a borda direita', () => {
    const r = encaixarRedimensionamento({ x: 0.2, y: 0.2, w: 0.795, h: 0.2 }, 'l', [], opcoes)
    expect(r.retangulo.x).toBe(0.2)
    expect(r.retangulo.x + r.retangulo.w).toBeCloseTo(1, 6)
  })

  it('redimensionar pelo oeste move só a borda esquerda', () => {
    const r = encaixarRedimensionamento({ x: 0.005, y: 0.2, w: 0.5, h: 0.2 }, 'o', [], opcoes)
    expect(r.retangulo.x).toBe(0)
    expect(r.retangulo.x + r.retangulo.w).toBeCloseTo(0.505, 6)
  })

  it('limitarAEtiqueta mantém o campo dentro', () => {
    expect(limitarAEtiqueta({ x: 0.9, y: -0.2, w: 0.5, h: 0.3 })).toEqual({
      x: 0.5,
      y: 0,
      w: 0.5,
      h: 0.3,
    })
  })
})

describe('modelo', () => {
  it('o padrão tem descrição, preço e código', () => {
    const m = modeloPadrao()
    expect(m.campos.map((c) => c.tipo)).toEqual(['texto', 'texto', 'codigo'])
  })

  it('campos não se sobrepõem no modelo padrão', () => {
    const m = modeloPadrao()
    for (let i = 1; i < m.campos.length; i++) {
      const anterior = m.campos[i - 1]!
      const atual = m.campos[i]!
      expect(atual.y).toBeGreaterThanOrEqual(anterior.y + anterior.h - 1e-9)
    }
  })

  it('duplicar cria id novo e desloca', () => {
    const m = modeloPadrao()
    const alvo = m.campos[0]!
    const { modelo, novoId } = duplicarCampo(m, alvo.id)

    expect(modelo.campos).toHaveLength(m.campos.length + 1)
    expect(novoId).not.toBe(alvo.id)
    const copia = modelo.campos.find((c) => c.id === novoId)!
    expect(copia.x).toBeGreaterThan(alvo.x)
  })

  it('reordenar muda a ordem de desenho', () => {
    const m = modeloPadrao()
    const primeiro = m.campos[0]!.id
    const movido = reordenarCampo(m, primeiro, 2)
    expect(movido.campos.at(-1)!.id).toBe(primeiro)
  })

  it('reordenar não sai dos limites', () => {
    const m = modeloPadrao()
    expect(reordenarCampo(m, m.campos[0]!.id, -5).campos[0]!.id).toBe(m.campos[0]!.id)
  })
})

describe('renderizarEtiqueta', () => {
  const caixa = { xMm: 0, yMm: 0, larguraMm: 66.7, alturaMm: 34.6 }

  it('gera texto e código para o modelo padrão', () => {
    const { ops, problemas } = renderizarEtiqueta(modeloPadrao(), ctx, caixa)

    expect(problemas).toEqual([])
    const textos = ops.filter((o) => o.op === 'texto')
    const rects = ops.filter((o) => o.op === 'rect')

    expect(textos.some((t) => t.op === 'texto' && t.texto === 'FILAMENTO PLA PRETO')).toBe(true)
    expect(textos.some((t) => t.op === 'texto' && t.texto === 'R$ 119,90')).toBe(true)
    expect(rects.length).toBeGreaterThan(10)
  })

  it('todos os ops ficam dentro da caixa', () => {
    const { ops } = renderizarEtiqueta(modeloPadrao(), ctx, caixa)
    for (const op of ops) {
      if (op.op !== 'rect') continue
      expect(op.xMm).toBeGreaterThanOrEqual(-1e-9)
      expect(op.xMm + op.larguraMm).toBeLessThanOrEqual(caixa.larguraMm + 1e-9)
    }
  })

  it('posiciona o campo pela fração, não por mm fixo', () => {
    const modelo = modeloPadrao()
    const grande = renderizarEtiqueta(modelo, ctx, { ...caixa, larguraMm: 133.4 })
    const pequena = renderizarEtiqueta(modelo, ctx, caixa)

    const xGrande = grande.ops.find((o) => o.op === 'texto')!
    const xPequena = pequena.ops.find((o) => o.op === 'texto')!
    if (xGrande.op !== 'texto' || xPequena.op !== 'texto') throw new Error('esperava texto')

    // Dobrar a largura dobra o x do campo.
    expect(xGrande.xMm).toBeCloseTo(xPequena.xMm * 2, 6)
  })

  it('a fonte acompanha a altura da etiqueta na mesma proporção', () => {
    // É o ponto todo da fonte em %: metade da altura => metade da letra.
    const modelo = modeloPadrao()
    const inteira = renderizarEtiqueta(modelo, ctx, caixa)
    const metade = renderizarEtiqueta(modelo, ctx, {
      ...caixa,
      larguraMm: caixa.larguraMm / 2,
      alturaMm: caixa.alturaMm / 2,
    })

    const a = inteira.ops.find((o) => o.op === 'texto')
    const b = metade.ops.find((o) => o.op === 'texto')
    if (a?.op !== 'texto' || b?.op !== 'texto') throw new Error('esperava texto')

    expect(b.fonte.tamanhoPt).toBeCloseTo(a.fonte.tamanhoPt / 2, 6)
  })

  it('a proporção entre letra e etiqueta não muda com o tamanho', () => {
    // Campo com "cortar" para medir a % pura: com "encolher", um campo estreito
    // reduziria a letra por não caber, mascarando a proporcionalidade.
    const modelo = {
      ...modeloPadrao(),
      campos: [
        criarCampo('texto', {
          template: '{Descrição}',
          x: 0,
          y: 0,
          w: 1,
          h: 0.3,
          ajuste: 'cortar' as const,
          fonte: { familia: 'Helvetica' as const, tamanhoPct: 0.1, negrito: false, italico: false },
        }),
      ],
    }

    const razao = (alturaMm: number) => {
      const r = renderizarEtiqueta(modelo, ctx, { ...caixa, alturaMm })
      const t = r.ops.find((o) => o.op === 'texto')
      if (t?.op !== 'texto') throw new Error('esperava texto')
      return t.fonte.tamanhoPt / alturaMm
    }

    expect(razao(20)).toBeCloseTo(razao(90), 6)
  })

  it('avisa quando a letra fica pequena demais para imprimir', () => {
    const { problemas } = renderizarEtiqueta(modeloPadrao(), ctx, {
      ...caixa,
      larguraMm: 20,
      alturaMm: 8,
    })
    expect(problemas.some((p) => /pequena demais/i.test(p.mensagem))).toBe(true)
  })

  it('reporta problema quando o código não tem valor', () => {
    const modelo = atualizarCampo(modeloPadrao(), modeloPadrao().campos[2]!.id, {})
    const semValor = {
      ...modelo,
      campos: modelo.campos.map((c) =>
        c.tipo === 'codigo' ? { ...c, template: '{GTIN/EAN}' } : c,
      ),
    }
    const { problemas } = renderizarEtiqueta(semValor, ctx, caixa)
    expect(problemas.some((p) => /sem valor/i.test(p.mensagem))).toBe(true)
  })

  it('reporta barra fina demais numa etiqueta apertada', () => {
    const { problemas } = renderizarEtiqueta(modeloPadrao(), ctx, {
      ...caixa,
      larguraMm: 14,
      alturaMm: 12,
    })
    expect(problemas.some((p) => /fina demais/i.test(p.mensagem))).toBe(true)
  })

  it('campo de linha vira uma op de linha', () => {
    const modelo = modeloPadrao()
    modelo.campos.push(criarCampo('linha', { x: 0, y: 0.5, w: 1, h: 0.02 }))
    const { ops } = renderizarEtiqueta(modelo, ctx, caixa)
    expect(ops.some((o) => o.op === 'linha')).toBe(true)
  })
})
