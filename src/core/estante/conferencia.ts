/**
 * A conferencia: caminhar pela estante marcando o que esta la, e sair com a
 * lista do que falta repor.
 *
 * O estado e chaveado pelo `Código` do produto, nunca pela posicao. E o que faz
 * a conferencia sobreviver a um produto que mudou de andar entre um export e
 * outro do Bling.
 */
import type {
  Celula,
  ConferenciaCelula,
  EstadoConferencia,
  ItemReposicao,
  PlanoAlocacao,
  ProdutoEstante,
} from './tipos'

/** Uma conferencia zerada. O `core` nao chama `Date`: o app injeta o instante. */
export function iniciarConferencia(agoraIso: string): EstadoConferencia {
  return { iniciadaEm: agoraIso, itens: {} }
}

/**
 * Ajusta a celula gravada a capacidade atual do template.
 *
 * Aumentar a capacidade acrescenta posicoes desmarcadas; diminuir corta as
 * sobrando. Sem isso, editar o template deixaria arrays de tamanho antigo no
 * storage e a UI leria posicao inexistente.
 */
function comCapacidade(celula: ConferenciaCelula | undefined, capacidade: number): ConferenciaCelula {
  const alvo = Math.max(0, Math.trunc(capacidade))
  const atual = celula?.marcados ?? []
  if (atual.length === alvo) return { marcados: [...atual] }

  const marcados = new Array<boolean>(alvo).fill(false)
  for (let i = 0; i < Math.min(alvo, atual.length); i++) marcados[i] = atual[i] === true
  return { marcados }
}

/** Marca ou desmarca uma posicao da celula. Imutavel. */
export function marcarCelula(
  conferencia: EstadoConferencia,
  codigo: string,
  indicePosicao: number,
  marcado: boolean,
  capacidade: number,
): EstadoConferencia {
  const celula = comCapacidade(conferencia.itens[codigo], capacidade)
  if (indicePosicao < 0 || indicePosicao >= celula.marcados.length) return conferencia

  celula.marcados[indicePosicao] = marcado

  return { ...conferencia, itens: { ...conferencia.itens, [codigo]: celula } }
}

/** Quantas posicoes da celula ja foram conferidas. */
export function conferidosDaCelula(
  conferencia: EstadoConferencia,
  codigo: string,
  capacidade: number,
): boolean[] {
  return comCapacidade(conferencia.itens[codigo], capacidade).marcados
}

/**
 * Quantos rolos cabem numa celula.
 *
 * Um bloco de 3 colunas com 2 em fila guarda 6 rolos -- e por isso a conferencia
 * de um campeao de venda tem 6 caixinhas, e nao 2.
 */
export function capacidadeDaCelula(celula: Celula, capacidadePorCelula: number): number {
  return Math.max(0, Math.trunc(celula.largura)) * Math.max(0, Math.trunc(capacidadePorCelula))
}

/**
 * Descarta o que nao esta mais no plano.
 *
 * Chamado a cada recalculo. Sem isso o storage cresceria para sempre com
 * produtos que sairam do catalogo -- e um codigo reaproveitado pelo Bling
 * apareceria ja conferido.
 */
export function podarConferencia(
  conferencia: EstadoConferencia,
  codigosNoPlano: ReadonlySet<string>,
): EstadoConferencia {
  const itens: Record<string, ConferenciaCelula> = {}
  let mudou = false

  for (const [codigo, celula] of Object.entries(conferencia.itens)) {
    if (codigosNoPlano.has(codigo)) itens[codigo] = celula
    else mudou = true
  }

  return mudou ? { ...conferencia, itens } : conferencia
}

/**
 * O que falta na prateleira: uma linha por celula incompleta.
 *
 * Celula cheia some da lista -- a lista existe para ser curta e para ser a
 * resposta de "o que eu pego no deposito agora". Sai em ordem de leitura da
 * estante, que e a ordem em que se caminha na frente dela.
 */
export function itensReposicao(
  plano: PlanoAlocacao,
  conferencia: EstadoConferencia,
  capacidade: number,
  produtosPorCodigo: ReadonlyMap<string, ProdutoEstante>,
): ItemReposicao[] {
  const itens: ItemReposicao[] = []

  for (const celula of plano.celulas) {
    if (celula.codigo === null || celula.classificacao === null) continue

    const alvo = capacidadeDaCelula(celula, capacidade)
    const marcados = comCapacidade(conferencia.itens[celula.codigo], alvo).marcados
    const faltam = alvo - marcados.filter(Boolean).length
    if (faltam <= 0) continue

    const produto = produtosPorCodigo.get(celula.codigo)

    itens.push({
      codigo: celula.codigo,
      descricao: produto?.descricao ?? '',
      classificacao: celula.classificacao,
      andar: celula.andar,
      coluna: celula.coluna,
      faltam,
      estoqueDeposito: produto?.estoqueDeposito ?? 0,
    })
  }

  return itens
}

/** Quantas posicoes da estante ja foram conferidas, para a barra de progresso. */
export function progressoConferencia(
  plano: PlanoAlocacao,
  conferencia: EstadoConferencia,
  capacidade: number,
): { conferidas: number; total: number } {
  let conferidas = 0
  let total = 0

  for (const celula of plano.celulas) {
    if (celula.codigo === null) continue
    const alvo = capacidadeDaCelula(celula, capacidade)
    total += alvo
    conferidas += comCapacidade(conferencia.itens[celula.codigo], alvo).marcados.filter(Boolean)
      .length
  }

  return { conferidas, total }
}
