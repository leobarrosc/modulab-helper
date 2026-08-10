import { decodificar, detectarDelimitador } from './detect'
import { analisarCsv } from './parse'
import { limpar, linhaVazia, nomesUnicos } from './normalize'
import type { LinhaCsv, Planilha } from './tipos'

export * from './tipos'
export { limpar, numeroBr } from './normalize'
export { decodificar, detectarDelimitador } from './detect'
export { analisarCsv } from './parse'

/**
 * Le um CSV do Bling do zero: bytes -> planilha limpa.
 * Ponto de entrada unico do modulo.
 */
export function lerCsv(bytes: Uint8Array): Planilha {
  const { texto, encoding, tinhaBom } = decodificar(bytes)
  const delimitador = detectarDelimitador(texto)
  const bruto = analisarCsv(texto, delimitador)
  const avisos: string[] = []

  if (bruto.length === 0) {
    throw new Error('O arquivo esta vazio.')
  }

  const colunas = nomesUnicos(bruto[0] ?? [])
  const corpo = bruto.slice(1)

  if (colunas.length <= 1) {
    avisos.push(
      `Apenas uma coluna foi detectada (delimitador "${delimitador}"). ` +
        'O arquivo pode nao ser um CSV do Bling.',
    )
  }

  const duplicadas = new Set(
    colunas.filter((c) => / \(\d+\)$/.test(c)).map((c) => c.replace(/ \(\d+\)$/, '')),
  )
  if (duplicadas.size > 0) {
    avisos.push(`Colunas com nome repetido foram renumeradas: ${[...duplicadas].join(', ')}.`)
  }

  const linhas: LinhaCsv[] = []
  let linhasVazias = 0
  let irregulares = 0

  for (const celulas of corpo) {
    if (linhaVazia(celulas)) {
      linhasVazias++
      continue
    }

    if (celulas.length !== colunas.length) irregulares++

    const linha: LinhaCsv = {}
    for (let i = 0; i < colunas.length; i++) {
      // Celulas faltando viram string vazia em vez de `undefined`, para que
      // o resolvedor de templates nunca imprima "undefined" numa etiqueta.
      linha[colunas[i] as string] = limpar(celulas[i] ?? '')
    }
    linhas.push(linha)
  }

  if (irregulares > 0) {
    avisos.push(
      `${irregulares} linha(s) tem numero de colunas diferente do cabecalho; ` +
        'os campos faltantes ficaram vazios.',
    )
  }

  return {
    colunas,
    linhas,
    meta: {
      encoding,
      tinhaBom,
      delimitador,
      linhasBrutas: corpo.length,
      linhasVazias,
    },
    avisos,
  }
}
