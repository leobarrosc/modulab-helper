import { SIMBOLOGIAS } from '../simbologia/registro'
import { criarCampo, novoId } from './modelo'
import type { Alinhamento } from '../render/tipos'
import { BORDA_PADRAO } from './tipos'
import type { Ajuste, Campo, Familia, Modelo, Rotacao, TipoCampo } from './tipos'

/**
 * Validacao de modelo vindo de fora: `chrome.storage`, arquivo .json importado
 * ou um formato antigo.
 *
 * O formato do modelo ja mudou dentro do proprio desenvolvimento (a fonte era
 * em pt e virou fracao). Confiar no que esta gravado quebraria o renderizador
 * com um `undefined` no meio do desenho. Aqui tudo e coagido ou descartado, e
 * o que foi consertado vira aviso para o usuario.
 */

export const VERSAO_MODELO = 1

export interface ModeloSerializado {
  versao: number
  modelo: Modelo
}

export interface ResultadoLeitura {
  modelo: Modelo
  avisos: string[]
}

const TIPOS: TipoCampo[] = ['texto', 'codigo', 'linha', 'caixa']
const FAMILIAS: Familia[] = ['Helvetica', 'Times', 'Courier']
const ALINHAMENTOS: Alinhamento[] = ['esquerda', 'centro', 'direita']
const AJUSTES: Ajuste[] = ['encolher', 'reticencias', 'cortar']
const ROTACOES: Rotacao[] = [0, 90, 180, 270]

const eObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Número finito dentro de [min, max]; `padrao` quando não dá para aproveitar. */
function num(valor: unknown, padrao: number, min: number, max: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return padrao
  return Math.min(max, Math.max(min, n))
}

function texto(valor: unknown, padrao: string, limite = 500): string {
  if (typeof valor !== 'string') return padrao
  return valor.slice(0, limite)
}

const umDe = <T extends string | number>(valor: unknown, opcoes: T[], padrao: T): T =>
  opcoes.includes(valor as T) ? (valor as T) : padrao

function lerCampo(bruto: unknown, avisos: string[]): Campo | null {
  if (!eObjeto(bruto)) return null

  const tipo = umDe(bruto['tipo'], TIPOS, 'texto')
  const base = criarCampo(tipo)

  const campo: Campo = {
    ...base,
    id: texto(bruto['id'], base.id, 80) || base.id,
    tipo,
    nome: texto(bruto['nome'], base.nome, 80),
    x: num(bruto['x'], base.x, 0, 1),
    y: num(bruto['y'], base.y, 0, 1),
    w: num(bruto['w'], base.w, 0.01, 1),
    h: num(bruto['h'], base.h, 0.01, 1),
    rotacao: umDe(bruto['rotacao'], ROTACOES, 0),
    cinza: num(bruto['cinza'], 0, 0, 1),
    travado: bruto['travado'] === true,
    template: texto(bruto['template'], base.template),
  }

  // O campo não pode nascer fora da etiqueta. Primeiro encolhe; se nem a
  // largura mínima couber (x coagido a 1), puxa o campo de volta.
  if (campo.x + campo.w > 1) campo.w = Math.max(0.01, 1 - campo.x)
  if (campo.x + campo.w > 1) campo.x = 1 - campo.w
  if (campo.y + campo.h > 1) campo.h = Math.max(0.01, 1 - campo.y)
  if (campo.y + campo.h > 1) campo.y = 1 - campo.h

  if (tipo === 'texto') {
    const fonte = eObjeto(bruto['fonte']) ? bruto['fonte'] : {}
    campo.fonte = {
      familia: umDe(fonte['familia'], FAMILIAS, 'Helvetica'),
      // Um modelo antigo trazia `tamanhoPt`. Converter seria adivinhar a
      // altura da etiqueta de então; o padrão é mais honesto que um chute.
      tamanhoPct: num(fonte['tamanhoPct'], base.fonte?.tamanhoPct ?? 0.09, 0.005, 1),
      negrito: fonte['negrito'] === true,
      italico: fonte['italico'] === true,
    }
    if ('tamanhoPt' in fonte && !('tamanhoPct' in fonte)) {
      avisos.push(`"${campo.nome}": tamanho de fonte em formato antigo, voltou ao padrão.`)
    }
    campo.alinhamento = umDe(bruto['alinhamento'], ALINHAMENTOS, 'esquerda')
    campo.ajuste = umDe(bruto['ajuste'], AJUSTES, 'encolher')
    campo.maxLinhas = Math.round(num(bruto['maxLinhas'], 1, 1, 12))
  }

  if (tipo === 'codigo') {
    const pedida = texto(bruto['simbologia'], '')
    const existe = SIMBOLOGIAS.some((s) => s.id === pedida)
    if (pedida && !existe) {
      avisos.push(`"${campo.nome}": simbologia "${pedida}" é desconhecida, usando Code 128.`)
    }
    campo.simbologia = existe ? pedida : 'code128'
    campo.mostrarLegenda = bruto['mostrarLegenda'] !== false
    campo.legendaPct = num(bruto['legendaPct'], 0.07, 0.005, 1)
  }

  if (tipo === 'linha' || tipo === 'caixa') {
    campo.espessuraMm = num(bruto['espessuraMm'], 0.3, 0.05, 10)
    campo.preenchido = bruto['preenchido'] === true
  }

  return campo
}

/** Lê um modelo de qualquer coisa, sem nunca lançar. */
export function lerModelo(bruto: unknown, nomePadrao = 'Importado'): ResultadoLeitura {
  const avisos: string[] = []

  // Aceita tanto `{ versao, modelo }` quanto o modelo solto.
  const envelope = eObjeto(bruto) && 'modelo' in bruto ? bruto : null
  const cru = envelope ? envelope['modelo'] : bruto

  if (envelope) {
    const versao = num(envelope['versao'], 0, 0, 999)
    if (versao > VERSAO_MODELO) {
      avisos.push(
        `O arquivo veio de uma versão mais nova (${versao}). Campos desconhecidos foram ignorados.`,
      )
    }
  }

  if (!eObjeto(cru)) {
    throw new Error('O arquivo não parece um modelo de etiqueta.')
  }

  const brutoCampos = Array.isArray(cru['campos']) ? cru['campos'] : []
  const campos: Campo[] = []
  let descartados = 0

  for (const item of brutoCampos) {
    const campo = lerCampo(item, avisos)
    if (campo) campos.push(campo)
    else descartados++
  }

  if (descartados > 0) avisos.push(`${descartados} campo(s) ilegível(is) foram descartados.`)
  if (campos.length === 0) avisos.push('O modelo não tinha nenhum campo válido.')

  // Ids repetidos quebrariam a seleção no editor.
  const vistos = new Set<string>()
  for (const campo of campos) {
    if (vistos.has(campo.id)) campo.id = novoId(campo.tipo)
    vistos.add(campo.id)
  }

  const bordaBruta = eObjeto(cru['borda']) ? cru['borda'] : null

  return {
    modelo: {
      id: texto(cru['id'], novoId('modelo'), 80) || novoId('modelo'),
      nome: texto(cru['nome'], nomePadrao, 80) || nomePadrao,
      campos,
      borda: bordaBruta
        ? {
            mostrar: bordaBruta['mostrar'] === true,
            espessuraMm: num(bordaBruta['espessuraMm'], 0.2, 0.05, 5),
            cinza: num(bordaBruta['cinza'], 0, 0, 1),
          }
        : { ...BORDA_PADRAO },
    },
    avisos,
  }
}

export function serializarModelo(modelo: Modelo): ModeloSerializado {
  return { versao: VERSAO_MODELO, modelo }
}

export function modeloParaJson(modelo: Modelo): string {
  return JSON.stringify(serializarModelo(modelo), null, 2)
}
