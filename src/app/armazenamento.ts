import type { OpcoesEncaixe } from '@/core/etiqueta/encaixe'
import type { Modelo } from '@/core/etiqueta/tipos'
import type { ConfigCorte, Grade, Pagina } from '@/core/layout'
import type { FonteCodigo } from '@/core/produtos'
import { lerModelo } from '@/core/etiqueta/serializar'

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
