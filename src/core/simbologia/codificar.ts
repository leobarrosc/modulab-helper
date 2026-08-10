// Subcaminho explicito: o mapa `exports` do bwip-js nao tem condicao `default`,
// entao o import generico nao resolve sob `moduleResolution: bundler`.
// `/browser` tambem e o alvo certo -- a extensao roda no navegador.
import bwipjs from 'bwip-js/browser'
import { acharSimbologia } from './registro'

/** Uma barra, em unidades de modulo (horizontal) e fracao da altura (vertical). */
export interface Barra {
  xModulos: number
  larguraModulos: number
  /** Distancia da base do simbolo ate o pe da barra, 0..1. */
  baseFracao: number
  /** Altura da barra, 0..1. PostNet usa barras curtas e altas. */
  alturaFracao: number
}

export type Simbolo =
  | { tipo: 'linear'; barras: Barra[]; larguraModulos: number }
  | { tipo: 'matriz'; modulos: boolean[]; colunas: number; linhas: number }

export type ResultadoCodificacao =
  | { ok: true; simbolo: Simbolo }
  | { ok: false; erro: string }

interface CruLinear {
  sbs: number[]
  bbs: number[]
  bhs: number[]
}

interface CruMatriz {
  pixs: number[]
  pixx: number
  pixy: number
}

/**
 * Converte a saida crua do bwip-js em barras posicionadas.
 *
 * `sbs` alterna barra/espaco COMECANDO POR BARRA -- os indices pares sao
 * barras. `bbs`/`bhs` trazem base e altura de cada barra em unidades absolutas
 * (polegadas): normalizamos pela altura total para virar fracao, senao o
 * PostNet, cujas barras medem 0,125 e 0,05, sairia com barras uniformes e
 * ilegivel.
 */
function normalizarLinear(cru: CruLinear): Simbolo {
  const { sbs, bbs, bhs } = cru

  let alturaTotal = 0
  for (let i = 0; i < bhs.length; i++) {
    alturaTotal = Math.max(alturaTotal, (bbs[i] ?? 0) + (bhs[i] ?? 0))
  }
  if (alturaTotal <= 0) alturaTotal = 1

  const barras: Barra[] = []
  let x = 0
  let indiceBarra = 0

  for (let i = 0; i < sbs.length; i++) {
    const largura = sbs[i] ?? 0
    if (i % 2 === 0) {
      barras.push({
        xModulos: x,
        larguraModulos: largura,
        baseFracao: (bbs[indiceBarra] ?? 0) / alturaTotal,
        alturaFracao: (bhs[indiceBarra] ?? alturaTotal) / alturaTotal,
      })
      indiceBarra++
    }
    x += largura
  }

  return { tipo: 'linear', barras, larguraModulos: x }
}

function normalizarMatriz(cru: CruMatriz): Simbolo {
  return {
    tipo: 'matriz',
    modulos: cru.pixs.map((p) => p === 1),
    colunas: cru.pixx,
    linhas: cru.pixy,
  }
}

/**
 * Codifica um valor na simbologia pedida.
 *
 * Nunca lanca: erros de conteudo (letra num codigo numerico, tamanho errado,
 * digito verificador invalido) sao comuns num CSV real e viram mensagem para
 * o usuario, celula a celula.
 */
export function codificar(idSimbologia: string, valor: string): ResultadoCodificacao {
  const simbologia = acharSimbologia(idSimbologia)
  if (!simbologia) return { ok: false, erro: `Simbologia desconhecida: ${idSimbologia}` }
  if (simbologia.estado !== 'pronta') return { ok: false, erro: `${simbologia.nome} ainda não está disponível.` }
  if (valor === '') return { ok: false, erro: 'Sem valor para codificar.' }

  try {
    const cru = bwipjs.raw(simbologia.bcid, valor)[0]
    if (!cru) return { ok: false, erro: 'O codificador não retornou nada.' }

    if ('pixs' in cru) return { ok: true, simbolo: normalizarMatriz(cru as CruMatriz) }
    return { ok: true, simbolo: normalizarLinear(cru as CruLinear) }
  } catch (e) {
    return { ok: false, erro: limparErro(e, simbologia.nome) }
  }
}

/** As mensagens do BWIPP vem em ingles e com prefixo tecnico. */
function limparErro(e: unknown, nomeSimbologia: string): string {
  const bruto = e instanceof Error ? e.message : String(e)
  const semPrefixo = bruto.replace(/^bwipp?\.[\w]+:\s*/i, '').trim()

  const traducoes: [RegExp, string][] = [
    [/must be .*digits/i, 'o valor precisa ter a quantidade certa de dígitos'],
    [/invalid.*check.*digit/i, 'dígito verificador inválido'],
    [/character.*not.*valid|invalid character/i, 'o valor tem caracteres que esta simbologia não aceita'],
    [/must be numeric|non-?numeric/i, 'esta simbologia aceita apenas dígitos'],
    [/too long|exceeds/i, 'o valor é longo demais para esta simbologia'],
    [/even number/i, 'esta simbologia exige uma quantidade par de dígitos'],
  ]

  for (const [padrao, texto] of traducoes) {
    if (padrao.test(semPrefixo)) return `${nomeSimbologia}: ${texto}.`
  }

  return `${nomeSimbologia}: ${semPrefixo || 'não foi possível gerar o código.'}`
}
