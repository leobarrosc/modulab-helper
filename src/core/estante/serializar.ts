/**
 * Validacao do que volta do `chrome.storage`.
 *
 * Mesmo principio de `core/etiqueta/serializar.ts`: nada aqui confia no que
 * esta gravado. Tudo e coagido ou descartado, e nenhuma funcao lanca -- estado
 * corrompido nunca pode impedir o app de abrir.
 *
 * Os coercitivos sao locais de proposito. Sao quatro linhas cada e mante-los
 * aqui evita que o modulo de estante passe a depender do de etiqueta, que nao
 * tem nada a ver com prateleira.
 */
import { ESTANTE_PADRAO, LIMITES_ESTANTE, regraVazia } from './template'
import type {
  ConferenciaCelula,
  CorrecaoClassificacao,
  EstadoConferencia,
  RegraAndar,
  TemplateEstante,
} from './tipos'

const eObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Numero finito dentro de [min, max]; `padrao` quando nao da para aproveitar. */
function num(valor: unknown, padrao: number, min: number, max: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(n)) return padrao
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

function texto(valor: unknown, padrao: string, limite = 200): string {
  if (typeof valor !== 'string') return padrao
  return valor.slice(0, limite)
}

/** Um template gravado; `null` quando nem o id da para aproveitar. */
export function lerTemplate(bruto: unknown): TemplateEstante | null {
  if (!eObjeto(bruto)) return null

  const id = texto(bruto['id'], '', 80)
  if (id === '') return null

  return {
    id,
    nome: texto(bruto['nome'], ESTANTE_PADRAO.nome, 80) || ESTANTE_PADRAO.nome,
    andares: num(
      bruto['andares'],
      ESTANTE_PADRAO.andares,
      LIMITES_ESTANTE.andares.min,
      LIMITES_ESTANTE.andares.max,
    ),
    colunas: num(
      bruto['colunas'],
      ESTANTE_PADRAO.colunas,
      LIMITES_ESTANTE.colunas.min,
      LIMITES_ESTANTE.colunas.max,
    ),
    capacidadePorCelula: num(
      bruto['capacidadePorCelula'],
      ESTANTE_PADRAO.capacidadePorCelula,
      LIMITES_ESTANTE.capacidadePorCelula.min,
      LIMITES_ESTANTE.capacidadePorCelula.max,
    ),
    raizCategoria: texto(bruto['raizCategoria'], ESTANTE_PADRAO.raizCategoria),
    marcasPermitidas: lerOrdemNomes(bruto['marcasPermitidas']),
    andaresBloqueados: lerNumeros(bruto['andaresBloqueados']),
    regrasAndar: lerRegrasAndar(bruto['regrasAndar']),
  }
}

function lerRegrasAndar(bruto: unknown): RegraAndar[] {
  if (!Array.isArray(bruto)) return []

  const regras: RegraAndar[] = []
  const vistos = new Set<number>()

  for (const item of bruto) {
    if (!eObjeto(item)) continue
    const andar = num(item['andar'], 0, 0, LIMITES_ESTANTE.andares.max)
    if (andar < 1 || vistos.has(andar)) continue

    const regra: RegraAndar = {
      andar,
      marcas: lerOrdemNomes(item['marcas']),
      tipos: lerOrdemNomes(item['tipos']),
      cores: lerOrdemNomes(item['cores']),
    }
    // Regra que nao restringe nada nao precisa ocupar espaco no storage.
    if (regraVazia(regra)) continue

    vistos.add(andar)
    regras.push(regra)
  }

  return regras.sort((a, b) => a.andar - b.andar)
}

/** Lista de inteiros positivos, sem repetir e em ordem. */
function lerNumeros(bruto: unknown): number[] {
  if (!Array.isArray(bruto)) return []
  const vistos = new Set<number>()
  for (const item of bruto) {
    const n = typeof item === 'number' ? item : Number(item)
    if (Number.isFinite(n) && n >= 1) vistos.add(Math.trunc(n))
  }
  return [...vistos].sort((a, b) => a - b)
}

/**
 * A lista de estantes. Uma entrada podre descarta so a si mesma -- mesmo
 * tratamento que `salvosDoEstado` da aos modelos de etiqueta.
 *
 * Devolve `null` quando a chave nunca foi gravada, para o chamador distinguir
 * "primeira execucao" (usa o padrao de fabrica) de "o usuario apagou todas".
 */
export function lerTemplates(bruto: unknown): { templates: TemplateEstante[]; avisos: string[] } | null {
  if (!Array.isArray(bruto)) return null

  const templates: TemplateEstante[] = []
  const avisos: string[] = []
  const vistos = new Set<string>()

  for (const item of bruto) {
    const template = lerTemplate(item)
    if (!template) {
      avisos.push('Uma estante gravada estava ilegível e foi descartada.')
      continue
    }
    if (vistos.has(template.id)) continue
    vistos.add(template.id)
    templates.push(template)
  }

  return { templates, avisos }
}

/** Larguras por Código: quantas colunas cada produto ocupa. */
export function lerLarguras(bruto: unknown): Record<string, number> {
  if (!eObjeto(bruto)) return {}

  const larguras: Record<string, number> = {}
  for (const [codigo, valor] of Object.entries(bruto)) {
    if (codigo === '') continue
    const n = num(valor, 1, LIMITES_ESTANTE.largura.min, LIMITES_ESTANTE.largura.max)
    // Largura 1 e o padrao: nao precisa ocupar espaco no storage.
    if (n > 1) larguras[codigo.slice(0, 80)] = n
  }
  return larguras
}

export function lerCorrecoes(bruto: unknown): Record<string, CorrecaoClassificacao> {
  if (!eObjeto(bruto)) return {}

  const correcoes: Record<string, CorrecaoClassificacao> = {}

  for (const [codigo, valor] of Object.entries(bruto)) {
    if (codigo === '' || !eObjeto(valor)) continue

    const correcao: CorrecaoClassificacao = {}
    if (typeof valor['marca'] === 'string') correcao.marca = valor['marca'].slice(0, 80)
    if (typeof valor['tipo'] === 'string') correcao.tipo = valor['tipo'].slice(0, 80)
    if (typeof valor['cor'] === 'string') correcao.cor = valor['cor'].slice(0, 80)

    // Correcao sem nenhum campo nao precisa ocupar espaco no storage.
    if (Object.keys(correcao).length > 0) correcoes[codigo.slice(0, 80)] = correcao
  }

  return correcoes
}

/** Uma ordem manual gravada (marcas ou tipos): lista de nomes, sem vazio nem repetido. */
export function lerOrdemNomes(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return []

  const ordem: string[] = []
  const vistos = new Set<string>()

  for (const item of bruto) {
    if (typeof item !== 'string') continue
    const nome = item.slice(0, 80)
    if (nome === '' || vistos.has(nome)) continue
    vistos.add(nome)
    ordem.push(nome)
  }

  return ordem
}

function lerConferenciaCelula(bruto: unknown): ConferenciaCelula | null {
  if (!eObjeto(bruto)) return null
  const marcados = bruto['marcados']
  if (!Array.isArray(marcados)) return null
  return { marcados: marcados.map((m) => m === true) }
}

export function lerConferencia(bruto: unknown): EstadoConferencia | null {
  if (!eObjeto(bruto)) return null

  const itens: Record<string, ConferenciaCelula> = {}
  const brutoItens = bruto['itens']

  if (eObjeto(brutoItens)) {
    for (const [codigo, valor] of Object.entries(brutoItens)) {
      const celula = lerConferenciaCelula(valor)
      if (codigo !== '' && celula) itens[codigo.slice(0, 80)] = celula
    }
  }

  return { iniciadaEm: texto(bruto['iniciadaEm'], '', 40), itens }
}

/** As conferencias por estante. Entrada podre e ignorada, nao derruba as outras. */
export function lerConferencias(bruto: unknown): Record<string, EstadoConferencia> {
  if (!eObjeto(bruto)) return {}

  const conferencias: Record<string, EstadoConferencia> = {}
  for (const [estanteId, valor] of Object.entries(bruto)) {
    const conferencia = lerConferencia(valor)
    if (estanteId !== '' && conferencia) conferencias[estanteId.slice(0, 80)] = conferencia
  }

  return conferencias
}
