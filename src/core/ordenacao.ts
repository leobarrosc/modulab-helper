/**
 * Ordenacao da lista de produtos.
 *
 * Nao e so cosmetica de tabela: esta ordem e a ordem em que as etiquetas saem
 * impressas na folha. Por isso mora em `core/`, puro e testado.
 */
import { numeroBr, type Planilha } from './csv'

export type Direcao = 'asc' | 'desc'

export interface Ordem {
  coluna: string
  direcao: Direcao
}

// `numeric: true` faz "10" vir depois de "9"; `sensitivity: 'base'` ignora
// acento e caixa, para "Área" e "area" caírem juntos.
const COLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/**
 * Compara dois valores nao vazios.
 * Numeros no formato brasileiro sao comparados como numeros -- senao
 * "1.234,56" viria antes de "999,00" por ordem alfabetica.
 */
function compararValores(a: string, b: string): number {
  const na = numeroBr(a)
  const nb = numeroBr(b)
  if (na !== null && nb !== null) return na - nb
  return COLATOR.compare(a, b)
}

/**
 * Ordena os indices pela coluna pedida.
 *
 * Celulas vazias vao para o fim nas DUAS direcoes. Invertendo a ordem, os 10
 * produtos sem GTIN/EAN tomariam o topo da lista e esconderiam justamente os
 * que tem codigo -- o oposto do que se quer ao ordenar por essa coluna.
 *
 * O desempate pelo indice original mantem a ordenacao estavel.
 */
export function ordenar(planilha: Planilha, indices: number[], ordem: Ordem | null): number[] {
  if (!ordem) return indices

  const sinal = ordem.direcao === 'asc' ? 1 : -1

  return [...indices].sort((ia, ib) => {
    const a = planilha.linhas[ia]?.[ordem.coluna] ?? ''
    const b = planilha.linhas[ib]?.[ordem.coluna] ?? ''

    const aVazio = a === ''
    const bVazio = b === ''
    if (aVazio !== bVazio) return aVazio ? 1 : -1
    if (!aVazio) {
      const c = compararValores(a, b)
      if (c !== 0) return c * sinal
    }

    return ia - ib
  })
}

/**
 * Proximo estado ao clicar num cabecalho: crescente, decrescente, original.
 * O terceiro clique volta a ordem do arquivo, que e a ordem que o Bling
 * exportou -- as vezes e ela que o usuario quer de volta.
 */
export function proximaOrdem(atual: Ordem | null, coluna: string): Ordem | null {
  if (atual?.coluna !== coluna) return { coluna, direcao: 'asc' }
  if (atual.direcao === 'asc') return { coluna, direcao: 'desc' }
  return null
}
