/**
 * Ordem escolhida a mao para uma lista de nomes.
 *
 * Serve a marca e ao tipo de filamento: nenhuma das duas tem ordem derivavel do
 * dado -- PLA antes ou depois de PETG, MultFila antes ou depois de 3D Prime, e
 * decisao de quem monta a prateleira. A ordem e guardada por NOME, e nao por
 * indice, para sobreviver a um export do Bling que traga nomes novos ou deixe
 * de trazer algum.
 */
import { normalizarTexto } from './texto'

const COLATOR = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/**
 * A comparacao e sempre pela forma normalizada.
 *
 * "MultFila" e "MULTFILA" sao a mesma marca no cadastro real do Bling. Se a
 * ordem as tratasse como duas, elas apareceriam como duas linhas arrastaveis e
 * o usuario poderia afasta-las -- separando na prateleira produtos da mesma
 * marca.
 */
export function posicaoNaOrdem(ordem: string[], item: string): number {
  const alvo = normalizarTexto(item)
  const i = ordem.findIndex((n) => normalizarTexto(n) === alvo)
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

/**
 * Reduz a uma entrada por nome, ignorando caixa e acento. A primeira grafia
 * encontrada e a que fica -- e a que o usuario ve na lista e no mapa.
 */
export function nomesDistintos(nomes: string[]): string[] {
  const vistos = new Set<string>()
  const distintos: string[] = []

  for (const nome of nomes) {
    const chave = normalizarTexto(nome)
    if (chave === '' || vistos.has(chave)) continue
    vistos.add(chave)
    distintos.push(nome)
  }

  return distintos
}

/**
 * Acrescenta ao fim os nomes que apareceram e ainda nao tinham lugar.
 *
 * Vao para o fim, e nao para o comeco, porque a ordem existente e uma decisao
 * do usuario: um tipo novo do Bling nao pode reorganizar a prateleira sozinho.
 * Entre si, ficam em ordem alfabetica.
 *
 * O nome vazio nunca entra: ele representa "sem marca"/"sem tipo", que nao e
 * uma escolha a arrastar e sempre fecha a fila.
 */
export function comItensNovos(ordem: string[], presentes: string[]): string[] {
  const conhecidos = new Set(ordem.map(normalizarTexto))
  const novos = nomesDistintos(presentes)
    .filter((item) => !conhecidos.has(normalizarTexto(item)))
    .sort(COLATOR.compare)

  return novos.length === 0 ? ordem : [...ordem, ...novos]
}

/** Move o item `delta` posicoes, travando nas pontas. O caminho de teclado. */
export function moverItem(ordem: string[], item: string, delta: number): string[] {
  const de = indiceDe(ordem, item)
  if (de === -1) return ordem
  return moverItemParaIndice(ordem, item, de + delta)
}

/** Indice do nome na ordem, comparado pela forma normalizada. */
function indiceDe(ordem: string[], item: string): number {
  const alvo = normalizarTexto(item)
  return ordem.findIndex((n) => normalizarTexto(n) === alvo)
}

/**
 * Move o item para um indice absoluto.
 *
 * E o que o soltar do arraste precisa: `delta` de +-1 nao serve para largar um
 * item seis posicoes abaixo.
 */
export function moverItemParaIndice(ordem: string[], item: string, destino: number): string[] {
  const de = indiceDe(ordem, item)
  if (de === -1) return ordem

  const para = Math.min(ordem.length - 1, Math.max(0, Math.trunc(destino)))
  if (para === de) return ordem

  // Reinsere a grafia que ja estava gravada, nao a que veio no argumento: a
  // lista continua mostrando o nome como o usuario o conhece.
  const proximo = [...ordem]
  const [nome] = proximo.splice(de, 1)
  proximo.splice(para, 0, nome!)
  return proximo
}

/**
 * Comparador pela ordem escolhida.
 *
 * Nome vazio sempre por ultimo -- mesma regra que `core/ordenacao.ts` aplica as
 * celulas vazias da tabela. Um punhado de produtos sem marca cadastrada nao pode
 * tomar o primeiro andar, que e o mais visivel da estante.
 *
 * Dois desconhecidos desempatam alfabeticamente, para a ordem nunca ficar ao
 * acaso.
 */
export function compararPorOrdem(ordem: string[]): (a: string, b: string) => number {
  return (a, b) => {
    const aVazio = a === ''
    const bVazio = b === ''
    if (aVazio !== bVazio) return aVazio ? 1 : -1

    const pa = posicaoNaOrdem(ordem, a)
    const pb = posicaoNaOrdem(ordem, b)
    if (pa !== pb) return pa - pb

    return COLATOR.compare(a, b)
  }
}
