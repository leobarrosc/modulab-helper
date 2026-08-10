import type { Campo } from './tipos'

/**
 * Encaixe com guias.
 *
 * Trabalha em fracoes da etiqueta (0..1), igual ao modelo. A tolerancia chega
 * em fracao tambem, convertida pela UI a partir de pixels na tela -- assim o
 * encaixe "gruda" com a mesma sensacao em qualquer zoom.
 */

export type EixoGuia = 'vertical' | 'horizontal'

export interface Guia {
  eixo: EixoGuia
  /** Posicao em fracao da etiqueta. */
  posicao: number
  /** De onde veio: ajuda a UI a desenhar diferente centro e borda. */
  origem: 'borda' | 'centro' | 'campo'
}

export interface Retangulo {
  x: number
  y: number
  w: number
  h: number
}

export interface OpcoesEncaixe {
  /** Passo da grade em fracao. 0 desliga. */
  passo: number
  /** Distancia maxima para grudar, em fracao. */
  tolerancia: number
  /** Encaixar nas bordas e no centro da etiqueta. */
  naEtiqueta: boolean
  /** Encaixar nos outros campos. */
  nosCampos: boolean
}

export const OPCOES_ENCAIXE_PADRAO: OpcoesEncaixe = {
  passo: 0,
  tolerancia: 0.012,
  naEtiqueta: true,
  nosCampos: true,
}

interface Candidato {
  posicao: number
  origem: Guia['origem']
}

function candidatosEixo(
  outros: Campo[],
  eixo: EixoGuia,
  opcoes: OpcoesEncaixe,
): Candidato[] {
  const lista: Candidato[] = []

  if (opcoes.naEtiqueta) {
    lista.push({ posicao: 0, origem: 'borda' })
    lista.push({ posicao: 1, origem: 'borda' })
    lista.push({ posicao: 0.5, origem: 'centro' })
  }

  if (opcoes.nosCampos) {
    for (const c of outros) {
      const inicio = eixo === 'vertical' ? c.x : c.y
      const tamanho = eixo === 'vertical' ? c.w : c.h
      lista.push({ posicao: inicio, origem: 'campo' })
      lista.push({ posicao: inicio + tamanho, origem: 'campo' })
      lista.push({ posicao: inicio + tamanho / 2, origem: 'campo' })
    }
  }

  return lista
}

/**
 * Encaixa um valor no melhor candidato dentro da tolerancia.
 * Devolve o valor original quando nada esta perto.
 */
function encaixarValor(
  valor: number,
  candidatos: Candidato[],
  opcoes: OpcoesEncaixe,
  eixo: EixoGuia,
): { valor: number; guia: Guia | null } {
  let melhor: { posicao: number; origem: Guia['origem']; distancia: number } | null = null

  for (const c of candidatos) {
    const distancia = Math.abs(valor - c.posicao)
    if (distancia <= opcoes.tolerancia && (!melhor || distancia < melhor.distancia)) {
      melhor = { posicao: c.posicao, origem: c.origem, distancia }
    }
  }

  if (melhor) {
    return { valor: melhor.posicao, guia: { eixo, posicao: melhor.posicao, origem: melhor.origem } }
  }

  // A grade so entra quando nenhuma guia pegou: uma borda alinhada vale mais
  // que um multiplo do passo.
  if (opcoes.passo > 0) {
    return { valor: Math.round(valor / opcoes.passo) * opcoes.passo, guia: null }
  }

  return { valor, guia: null }
}

export interface ResultadoEncaixe {
  retangulo: Retangulo
  guias: Guia[]
}

/**
 * Encaixa um retangulo ao move-lo.
 *
 * Testa as tres referencias de cada eixo -- inicio, centro e fim -- e fica com
 * a que grudar mais perto. Sem o centro, alinhar um campo ao meio da etiqueta
 * viraria trabalho manual de precisao.
 */
export function encaixarMovimento(
  retangulo: Retangulo,
  outros: Campo[],
  opcoes: OpcoesEncaixe,
): ResultadoEncaixe {
  const guias: Guia[] = []
  const resultado = { ...retangulo }

  for (const eixo of ['vertical', 'horizontal'] as const) {
    const candidatos = candidatosEixo(outros, eixo, opcoes)
    const inicio = eixo === 'vertical' ? retangulo.x : retangulo.y
    const tamanho = eixo === 'vertical' ? retangulo.w : retangulo.h

    const tentativas = [
      { referencia: inicio, deslocamento: 0 },
      { referencia: inicio + tamanho / 2, deslocamento: tamanho / 2 },
      { referencia: inicio + tamanho, deslocamento: tamanho },
    ]

    let escolhido: { valor: number; guia: Guia | null; distancia: number } | null = null

    for (const t of tentativas) {
      const r = encaixarValor(t.referencia, candidatos, opcoes, eixo)
      const distancia = r.guia ? Math.abs(t.referencia - r.valor) : Number.POSITIVE_INFINITY
      const novoInicio = r.valor - t.deslocamento

      if (r.guia && (!escolhido || distancia < escolhido.distancia)) {
        escolhido = { valor: novoInicio, guia: r.guia, distancia }
      } else if (!escolhido && !r.guia && t.deslocamento === 0) {
        escolhido = { valor: r.valor, guia: null, distancia: Number.POSITIVE_INFINITY }
      }
    }

    if (escolhido) {
      if (eixo === 'vertical') resultado.x = escolhido.valor
      else resultado.y = escolhido.valor
      if (escolhido.guia) guias.push(escolhido.guia)
    }
  }

  return { retangulo: resultado, guias }
}

/** Qual borda esta sendo puxada. */
export type Alca = 'n' | 's' | 'l' | 'o' | 'no' | 'ne' | 'so' | 'se'

const MINIMO = 0.02

/**
 * Encaixa um retangulo ao redimensiona-lo pela alca.
 * As bordas que a alca nao toca ficam paradas.
 */
export function encaixarRedimensionamento(
  retangulo: Retangulo,
  alca: Alca,
  outros: Campo[],
  opcoes: OpcoesEncaixe,
): ResultadoEncaixe {
  const guias: Guia[] = []
  let { x, y, w, h } = retangulo

  const mexeOeste = alca.includes('o')
  const mexeLeste = alca.includes('l') || alca.includes('e')
  const mexeNorte = alca.includes('n')
  const mexeSul = alca.includes('s')

  if (mexeOeste || mexeLeste) {
    const candidatos = candidatosEixo(outros, 'vertical', opcoes)
    if (mexeOeste) {
      const r = encaixarValor(x, candidatos, opcoes, 'vertical')
      const direita = x + w
      x = Math.min(r.valor, direita - MINIMO)
      w = direita - x
      if (r.guia) guias.push(r.guia)
    } else {
      const r = encaixarValor(x + w, candidatos, opcoes, 'vertical')
      w = Math.max(MINIMO, r.valor - x)
      if (r.guia) guias.push(r.guia)
    }
  }

  if (mexeNorte || mexeSul) {
    const candidatos = candidatosEixo(outros, 'horizontal', opcoes)
    if (mexeNorte) {
      const r = encaixarValor(y, candidatos, opcoes, 'horizontal')
      const base = y + h
      y = Math.min(r.valor, base - MINIMO)
      h = base - y
      if (r.guia) guias.push(r.guia)
    } else {
      const r = encaixarValor(y + h, candidatos, opcoes, 'horizontal')
      h = Math.max(MINIMO, r.valor - y)
      if (r.guia) guias.push(r.guia)
    }
  }

  return { retangulo: { x, y, w, h }, guias }
}

/** Mantem o campo dentro da etiqueta, preservando o tamanho quando possivel. */
export function limitarAEtiqueta(r: Retangulo): Retangulo {
  const w = Math.min(1, Math.max(MINIMO, r.w))
  const h = Math.min(1, Math.max(MINIMO, r.h))
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, r.x)),
    y: Math.min(1 - h, Math.max(0, r.y)),
  }
}
