/**
 * Tipos do modulo de estante: o mapa da prateleira e a conferencia de reposicao.
 *
 * So shapes -- a logica mora nos vizinhos. Puro e sem DOM, como todo `core/`.
 */

/**
 * Uma estante fisica. `capacidadePorCelula` e quantos rolos do MESMO produto
 * cabem na celula, em fila: o da frente e o mostruario, o de tras e a reposicao
 * imediata.
 */
export interface TemplateEstante {
  id: string
  nome: string
  andares: number
  colunas: number
  capacidadePorCelula: number
  /** Produto entra se a categoria for igual a raiz ou comecar com `raiz>>`. */
  raizCategoria: string
  /**
   * Marcas desta estante. Lista VAZIA significa "todas" -- e nao "nenhuma".
   * Uma loja com duas estantes divide as marcas entre elas por aqui.
   */
  marcasPermitidas: string[]
  /**
   * Andares que nao recebem produto (base 1): a prateleira mais alta que nao
   * alcanca, a de baixo que e so caixa fechada.
   */
  andaresBloqueados: number[]
  /** Andares com conteudo reservado. Andar sem regra recebe o que sobrou. */
  regrasAndar: RegraAndar[]
}

/** Os tres eixos que organizam a prateleira. */
export interface Classificacao {
  marca: string
  tipo: string
  cor: string
}

/**
 * Correcao manual da classificacao, indexada pelo `Código` do produto.
 *
 * NUNCA por indice de linha: o CSV nao e persistido e os indices mudam a cada
 * export do Bling. Campo ausente continua valendo o valor derivado.
 */
export interface CorrecaoClassificacao {
  marca?: string
  tipo?: string
  cor?: string
}

/** Um produto ja filtrado e classificado, pronto para ganhar uma celula. */
export interface ProdutoEstante {
  codigo: string
  descricao: string
  classificacao: Classificacao
  /** Quanto ha no deposito, para saber se da para repor. */
  estoqueDeposito: number
}

/** Uma posicao da grade. `codigo` nulo e celula vazia. */
export interface Celula {
  /** Base 1, como o usuario conta os andares. */
  andar: number
  /** Base 1. Primeira coluna do bloco. */
  coluna: number
  /**
   * Quantas colunas seguidas este produto ocupa.
   *
   * Um campeao de venda merece frente maior: o PLA Preto em 1.1, 1.2 e 1.3 e um
   * bloco de largura 3, nao tres celulas iguais lado a lado.
   */
  largura: number
  codigo: string | null
  classificacao: Classificacao | null
  /** Andar que o usuario tirou de uso: aparece na tela, mas nunca recebe produto. */
  bloqueada: boolean
}

/**
 * O que um andar aceita.
 *
 * Lista vazia em um eixo significa "qualquer": uma regra so com `cores` limita a
 * cor e aceita qualquer marca e tipo. Um andar SEM regra aceita o que sobrou.
 */
export interface RegraAndar {
  /** Base 1. */
  andar: number
  marcas: string[]
  tipos: string[]
  /** Chaves de cor base (`PRETO`, `BRANCO`...), como em `CORES_CONHECIDAS`. */
  cores: string[]
}

export interface ItemNaoAlocado {
  codigo: string
  classificacao: Classificacao
}

export interface PlanoAlocacao {
  /** `andares * colunas` celulas, em ordem de leitura. */
  celulas: Celula[]
  /** O que nao coube na estante, na ordem em que teria entrado. */
  naoAlocados: ItemNaoAlocado[]
  avisos: string[]
}

/**
 * O que foi conferido numa celula. Um booleano por posicao fisica: indice 0 e
 * a frente, 1 e o de tras quando a capacidade e 2.
 *
 * Array em vez de `{ frente, tras }` porque a capacidade vem do template e pode
 * nao ser 2 -- assim uma estante de 3 em fila nao precisa de caso especial.
 */
export interface ConferenciaCelula {
  marcados: boolean[]
}

export interface EstadoConferencia {
  /** ISO. O `core` nao chama `Date`: quem injeta e o app. */
  iniciadaEm: string
  /** Chave: o `Código` do produto. */
  itens: Record<string, ConferenciaCelula>
}

/** Uma linha da lista de reposicao: o que falta na prateleira. */
export interface ItemReposicao {
  codigo: string
  descricao: string
  classificacao: Classificacao
  andar: number
  coluna: number
  /** Quantas unidades faltam para a celula ficar cheia. */
  faltam: number
  estoqueDeposito: number
}
