import type { OpcoesEncaixe } from '@/core/etiqueta/encaixe'
import type { Modelo } from '@/core/etiqueta/tipos'
import type { ConfigCorte, Grade, Pagina } from '@/core/layout'
import type { FonteCodigo } from '@/core/produtos'
import { lerModelo } from '@/core/etiqueta/serializar'
import {
  comItensNovos,
  lerConferencias,
  lerCorrecoes,
  lerLarguras,
  lerOrdemNomes,
  lerTemplates,
  ordemCoresPadrao,
  type CorrecaoClassificacao,
  type EstadoConferencia,
  type TemplateEstante,
} from '@/core/estante'

/**
 * Persistencia das escolhas do usuario.
 *
 * `chrome.storage.local` na extensao; `localStorage` quando a pagina roda no
 * dev server (sem `chrome.storage`), para o fluxo de desenvolvimento nao
 * divergir do real.
 *
 * O CSV NUNCA e gravado: e grande, muda a cada export do Bling e reimporta-lo
 * e um clique. So as escolhas moram aqui. Ver PLANO.md secao 10.
 */

const CHAVE = 'modulab-helper'

export interface EstadoPersistido {
  versao: 1
  pagina?: Pagina
  grade?: Grade
  pularCelulas?: number
  fonteCodigo?: FonteCodigo
  multiplicarPorEstoque?: boolean
  soAtivos?: boolean
  encaixe?: OpcoesEncaixe
  corte?: ConfigCorte
  /** O desenho atual da etiqueta, para sobreviver ao fechar da aba. */
  modelo?: unknown
  /** Modelos salvos pelo usuario, com nome. */
  salvos?: unknown[]

  /** Aba aberta por ultimo: volta como estava, igual ao papel da etiqueta. */
  abaAtiva?: string
  /** Estantes cadastradas. Validadas na leitura. */
  estantes?: unknown
  estanteAtivaId?: string
  /** Correcoes manuais de Marca/Tipo/Cor, por Código do produto. */
  correcoesClassificacao?: unknown
  /** Ordem dos tipos de filamento na prateleira, escolhida pelo usuario. */
  ordemTipos?: unknown
  /** Ordem das marcas: define qual marca fica em qual andar. */
  ordemMarcas?: unknown
  /** Ordem das cores da estante inteira. */
  ordemCores?: unknown
  /** Excecoes de ordem de cor, por marca+tipo. */
  ordemCoresPorGrupo?: unknown
  /** Palavras que o usuario mandou ignorar ao extrair a cor. */
  palavrasIgnoradas?: unknown
  /** Quantas colunas cada produto ocupa, por Código. */
  largurasCelula?: unknown
  /** Conferencia em andamento, por estante. */
  conferencias?: unknown
}

interface BackendArmazenamento {
  ler: () => Promise<unknown>
  gravar: (valor: EstadoPersistido) => Promise<void>
}

function backendChrome(): BackendArmazenamento | null {
  const api = (globalThis as { chrome?: typeof chrome }).chrome
  if (!api?.storage?.local) return null
  return {
    ler: async () => (await api.storage.local.get(CHAVE))[CHAVE],
    gravar: async (valor) => api.storage.local.set({ [CHAVE]: valor }),
  }
}

function backendLocalStorage(): BackendArmazenamento {
  return {
    ler: async () => {
      try {
        const bruto = localStorage.getItem(CHAVE)
        return bruto ? (JSON.parse(bruto) as unknown) : undefined
      } catch {
        return undefined
      }
    },
    gravar: async (valor) => {
      localStorage.setItem(CHAVE, JSON.stringify(valor))
    },
  }
}

const backend: BackendArmazenamento = backendChrome() ?? backendLocalStorage()

export async function carregarEstado(): Promise<EstadoPersistido | null> {
  try {
    const bruto = await backend.ler()
    if (typeof bruto !== 'object' || bruto === null) return null
    return bruto as EstadoPersistido
  } catch {
    // Estado corrompido não pode impedir o app de abrir.
    return null
  }
}

let pendente: ReturnType<typeof setTimeout> | null = null
let ultimo: EstadoPersistido | null = null

/**
 * Grava com atraso de 400 ms, juntando rajadas: um arraste de campo dispara
 * dezenas de mudancas por segundo e cada `set` do chrome.storage tem custo.
 */
export function agendarGravacao(estado: EstadoPersistido): void {
  ultimo = estado
  if (pendente) clearTimeout(pendente)
  pendente = setTimeout(() => {
    pendente = null
    if (ultimo) void backend.gravar(ultimo)
  }, 400)
}

/** Valida um modelo persistido; `null` se irrecuperável. */
export function modeloDoEstado(estado: EstadoPersistido): Modelo | null {
  if (estado.modelo === undefined) return null
  try {
    return lerModelo(estado.modelo).modelo
  } catch {
    return null
  }
}

export interface ModeloSalvo {
  nome: string
  modelo: Modelo
}

/** Valida a lista de modelos salvos, descartando entradas podres. */
export function salvosDoEstado(estado: EstadoPersistido): ModeloSalvo[] {
  if (!Array.isArray(estado.salvos)) return []
  const lista: ModeloSalvo[] = []
  for (const item of estado.salvos) {
    try {
      const { modelo } = lerModelo(item)
      if (modelo.campos.length > 0) lista.push({ nome: modelo.nome, modelo })
    } catch {
      /* entrada podre: ignora */
    }
  }
  return lista
}

/**
 * As estantes gravadas.
 *
 * `null` quando a chave nunca existiu, para o store distinguir a primeira
 * execucao (que ganha a estante de fabrica) de "o usuario apagou todas".
 */
export function estantesDoEstado(estado: EstadoPersistido): TemplateEstante[] | null {
  return lerTemplates(estado.estantes)?.templates ?? null
}

export function correcoesDoEstado(
  estado: EstadoPersistido,
): Record<string, CorrecaoClassificacao> {
  return lerCorrecoes(estado.correcoesClassificacao)
}

export function ordemTiposDoEstado(estado: EstadoPersistido): string[] {
  return lerOrdemNomes(estado.ordemTipos)
}

export function ordemMarcasDoEstado(estado: EstadoPersistido): string[] {
  return lerOrdemNomes(estado.ordemMarcas)
}

/**
 * A ordem de cores gravada, completada com as cores que o app passou a
 * conhecer. Uma versao nova com uma cor nova no dicionario nao pode deixar essa
 * cor de fora da lista arrastavel.
 */
export function ordemCoresDoEstado(estado: EstadoPersistido): string[] {
  const gravada = lerOrdemNomes(estado.ordemCores)
  return gravada.length === 0 ? ordemCoresPadrao() : comItensNovos(gravada, ordemCoresPadrao())
}

export function ordemCoresPorGrupoDoEstado(estado: EstadoPersistido): Record<string, string[]> {
  if (typeof estado.ordemCoresPorGrupo !== 'object' || estado.ordemCoresPorGrupo === null) return {}

  const grupos: Record<string, string[]> = {}
  for (const [grupo, valor] of Object.entries(estado.ordemCoresPorGrupo)) {
    const ordem = lerOrdemNomes(valor)
    if (grupo !== '' && ordem.length > 0) grupos[grupo] = comItensNovos(ordem, ordemCoresPadrao())
  }
  return grupos
}

export function palavrasIgnoradasDoEstado(estado: EstadoPersistido): string[] {
  return lerOrdemNomes(estado.palavrasIgnoradas)
}

export function largurasDoEstado(estado: EstadoPersistido): Record<string, number> {
  return lerLarguras(estado.largurasCelula)
}

export function conferenciasDoEstado(
  estado: EstadoPersistido,
): Record<string, EstadoConferencia> {
  return lerConferencias(estado.conferencias)
}
