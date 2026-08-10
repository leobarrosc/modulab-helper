/** Deteccao de encoding e delimitador. */

const BOM_UTF8 = [0xef, 0xbb, 0xbf]
const CANDIDATOS_DELIMITADOR = [';', ',', '\t', '|'] as const

export interface Decodificado {
  texto: string
  encoding: 'utf-8' | 'windows-1252'
  tinhaBom: boolean
}

/**
 * Decodifica os bytes do arquivo.
 *
 * O Bling exporta UTF-8 com BOM, mas exports antigos (e planilhas que passaram
 * pelo Excel) saem em windows-1252. Tentamos UTF-8 estrito primeiro: se houver
 * qualquer sequencia invalida, o TextDecoder com `fatal` lanca, e ai sabemos
 * que e Latin-1. Sem isso, acentos virariam caracteres de substituicao
 * silenciosamente -- "Descricao" viraria "Descri�ao" nas etiquetas.
 */
export function decodificar(bytes: Uint8Array): Decodificado {
  const tinhaBom = BOM_UTF8.every((b, i) => bytes[i] === b)
  const corpo = tinhaBom ? bytes.subarray(BOM_UTF8.length) : bytes

  if (tinhaBom) {
    return { texto: new TextDecoder('utf-8').decode(corpo), encoding: 'utf-8', tinhaBom }
  }

  try {
    const texto = new TextDecoder('utf-8', { fatal: true }).decode(corpo)
    return { texto, encoding: 'utf-8', tinhaBom }
  } catch {
    return {
      texto: new TextDecoder('windows-1252').decode(corpo),
      encoding: 'windows-1252',
      tinhaBom,
    }
  }
}

/** Conta ocorrencias de `alvo` fora de trechos entre aspas. */
function contarFora(linha: string, alvo: string): number {
  let total = 0
  let dentroAspas = false

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      dentroAspas = !dentroAspas
    } else if (c === alvo && !dentroAspas) {
      total++
    }
  }
  return total
}

/**
 * Detecta o delimitador pela primeira linha (o cabecalho).
 * Empate resolve a favor de `;`, que e o padrao do Bling.
 */
export function detectarDelimitador(texto: string): string {
  const quebra = texto.search(/\r?\n/)
  const cabecalho = quebra === -1 ? texto : texto.slice(0, quebra)

  let melhor = ';'
  let maior = 0

  for (const candidato of CANDIDATOS_DELIMITADOR) {
    const total = contarFora(cabecalho, candidato)
    if (total > maior) {
      maior = total
      melhor = candidato
    }
  }

  return melhor
}
