/** Regras de limpeza especificas do export do Bling. */

/** Espaco, tab, quebra, NBSP e BOM solto -- so nas pontas. */
const LIXO_NAS_PONTAS = /^[\s ﻿]+|[\s ﻿]+$/g

/**
 * Limpa uma celula.
 *
 * O Bling cola tabs nos valores: `Codigo` vem como `"261\t"` e `GTIN/EAN` como
 * `"\t7898757181218"`. Sem isso o codigo de barras seria gerado com o tab
 * dentro e nenhum leitor reconheceria.
 */
export function limpar(valor: string): string {
  return valor.replace(LIXO_NAS_PONTAS, '')
}

/**
 * Converte numero no formato brasileiro para `number`.
 * `"119,90"` -> 119.9 · `"42,0000"` -> 42 · `"1.234,56"` -> 1234.56
 *
 * Retorna `null` quando nao e numero, para o chamador decidir o fallback.
 */
export function numeroBr(valor: string): number | null {
  const texto = limpar(valor)
  if (!texto) return null

  const normalizado = texto.replace(/\./g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null

  const n = Number(normalizado)
  return Number.isFinite(n) ? n : null
}

/**
 * Garante nomes de coluna unicos e nao vazios.
 * Duplicatas viram `Nome (2)`, `Nome (3)`... senao uma sobrescreveria a outra
 * no Record da linha.
 */
export function nomesUnicos(brutos: string[]): string[] {
  const contagem = new Map<string, number>()

  return brutos.map((bruto, i) => {
    const base = limpar(bruto) || `Coluna ${i + 1}`
    const vistas = contagem.get(base) ?? 0
    contagem.set(base, vistas + 1)
    return vistas === 0 ? base : `${base} (${vistas + 1})`
  })
}

/** `true` se todas as celulas da linha estao vazias apos a limpeza. */
export function linhaVazia(celulas: string[]): boolean {
  return celulas.every((c) => limpar(c) === '')
}
