import type { Modelo } from '@/core/etiqueta/tipos'

/**
 * Historico de undo/redo do modelo.
 *
 * Guarda modelos inteiros, nao diffs: um modelo tem poucas dezenas de campos,
 * entao a copia e barata e a logica fica simples o bastante para nao ter bug
 * proprio -- que seria pior que o custo de memoria.
 */
export interface Historico {
  passado: Modelo[]
  futuro: Modelo[]
}

export const HISTORICO_VAZIO: Historico = { passado: [], futuro: [] }

const LIMITE = 60

export function registrar(historico: Historico, anterior: Modelo): Historico {
  return {
    passado: [...historico.passado, anterior].slice(-LIMITE),
    // Um caminho novo descarta o futuro: e o comportamento que todo editor tem.
    futuro: [],
  }
}

export function desfazer(
  historico: Historico,
  atual: Modelo,
): { modelo: Modelo; historico: Historico } | null {
  const anterior = historico.passado.at(-1)
  if (!anterior) return null

  return {
    modelo: anterior,
    historico: {
      passado: historico.passado.slice(0, -1),
      futuro: [atual, ...historico.futuro].slice(0, LIMITE),
    },
  }
}

export function refazer(
  historico: Historico,
  atual: Modelo,
): { modelo: Modelo; historico: Historico } | null {
  const proximo = historico.futuro[0]
  if (!proximo) return null

  return {
    modelo: proximo,
    historico: {
      passado: [...historico.passado, atual].slice(-LIMITE),
      futuro: historico.futuro.slice(1),
    },
  }
}
