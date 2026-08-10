import { limpar, numeroBr, type LinhaCsv } from '../csv'

/**
 * Resolve templates com chaves: `{Coluna}`, `{Preço|moeda}`,
 * `{GTIN/EAN ?? Código}`.
 *
 * O `??` existe por causa do CSV real: 10 dos 12 produtos nao tem GTIN/EAN, e
 * cair para outra coluna e mais util que imprimir vazio.
 */

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export interface ContextoResolucao {
  linha: LinhaCsv
  /** Posicao da etiqueta na fila, base 1. */
  indice?: number
  total?: number
}

type Formatador = (valor: string, argumento?: string) => string

const FORMATADORES: Record<string, Formatador> = {
  moeda: (v) => {
    const n = numeroBr(v)
    return n === null ? v : MOEDA.format(n)
  },
  numero: (v, arg) => {
    const n = numeroBr(v)
    if (n === null) return v
    const casas = Math.max(0, Math.min(6, Number(arg ?? 0) || 0))
    return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  },
  maiuscula: (v) => v.toLocaleUpperCase('pt-BR'),
  minuscula: (v) => v.toLocaleLowerCase('pt-BR'),
  titulo: (v) =>
    v
      .toLocaleLowerCase('pt-BR')
      .replace(/(^|\s)(\p{L})/gu, (_, e: string, l: string) => e + l.toLocaleUpperCase('pt-BR')),
  corta: (v, arg) => {
    const n = Math.max(1, Number(arg ?? 20) || 20)
    return v.length <= n ? v : `${v.slice(0, n - 1)}…`
  },
  trim: (v) => limpar(v),
  /** Último nível de "Filamentos>>PLA>>Básico". */
  ultimo: (v) => v.split('>>').at(-1)?.trim() ?? v,
  primeiro: (v) => v.split('>>')[0]?.trim() ?? v,
  padleft: (v, arg) => {
    const [tamanho, char] = (arg ?? '0').split(':')
    const n = Math.max(0, Math.min(64, Number(tamanho) || 0))
    return v.padStart(n, (char || '0').charAt(0))
  },
}

export const NOMES_FORMATADORES = Object.keys(FORMATADORES)

/** Colunas que nao vem do CSV. */
export function colunasVirtuais(ctx: ContextoResolucao): Record<string, string> {
  return {
    _indice: String(ctx.indice ?? 1),
    _total: String(ctx.total ?? 1),
    _data: new Date().toLocaleDateString('pt-BR'),
  }
}

function valorDe(nome: string, ctx: ContextoResolucao): string {
  const chave = nome.trim()
  const virtuais = colunasVirtuais(ctx)
  if (chave in virtuais) return virtuais[chave] ?? ''
  return ctx.linha[chave] ?? ''
}

/** Resolve `Coluna|fmt:arg|fmt2` — sem as chaves nem o `??`. */
function resolverTermo(termo: string, ctx: ContextoResolucao): string {
  const partes = termo.split('|')
  let valor = valorDe(partes[0] ?? '', ctx)

  for (const parte of partes.slice(1)) {
    const [nome, ...resto] = parte.trim().split(':')
    const formatador = FORMATADORES[(nome ?? '').trim()]
    if (formatador) valor = formatador(valor, resto.join(':'))
  }

  return valor
}

/**
 * Resolve o template inteiro. Texto fora das chaves passa como está.
 *
 * Uma chave que aponta para coluna inexistente vira string vazia -- nunca
 * "undefined", que acabaria impresso numa etiqueta.
 */
export function resolver(template: string, ctx: ContextoResolucao): string {
  return template.replace(/\{([^{}]*)\}/g, (_, conteudo: string) => {
    for (const alternativa of conteudo.split('??')) {
      const valor = resolverTermo(alternativa.trim(), ctx)
      if (valor !== '') return valor
    }
    return ''
  })
}

/** Nomes de coluna citados no template, para validar contra o CSV. */
export function colunasUsadas(template: string): string[] {
  const nomes = new Set<string>()

  for (const [, conteudo] of template.matchAll(/\{([^{}]*)\}/g)) {
    for (const alternativa of (conteudo ?? '').split('??')) {
      const nome = alternativa.split('|')[0]?.trim()
      if (nome) nomes.add(nome)
    }
  }

  return [...nomes]
}
