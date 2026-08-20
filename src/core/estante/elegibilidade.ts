/**
 * Quem entra na estante.
 *
 * A estante e de filamento, mas o export do Bling traz o catalogo inteiro. O
 * filtro e por raiz de categoria (configuravel no template), o que faz uma
 * estante futura de resina custar so a troca de uma string.
 */
import { estoqueContavel } from '../produtos'
import { limpar, type LinhaCsv, type Planilha } from '../csv'
import {
  aplicarCorrecao,
  classificarLinha,
  codigoDaLinha,
  COLUNA_CATEGORIA,
  COLUNA_MARCA,
  niveisCategoria,
  SEPARADOR_CATEGORIA,
} from './classificar'
import { ehNomeDeCor } from './cores'
import { nomesDistintos } from './ordemManual'
import { normalizarTexto } from './texto'
import type { CorrecaoClassificacao, ProdutoEstante } from './tipos'

export const COLUNA_SITUACAO = 'Situação'
export const SITUACAO_ATIVO = 'Ativo'

/**
 * `true` se a categoria e a raiz ou desce dela.
 *
 * Compara nivel a nivel, e nao por prefixo de string: `"FilamentosXPTO"` tem o
 * prefixo `"Filamentos"` mas nao e filamento nenhum.
 *
 * Raiz vazia nao casa com nada -- de proposito. Um template mal preenchido
 * derrubando o catalogo inteiro dentro da estante seria pior que uma estante
 * vazia, que ao menos e obvia na tela.
 */
export function categoriaNaRaiz(categoriaProduto: string, raizCategoria: string): boolean {
  const raiz = limpar(raizCategoria)
  if (raiz === '') return false

  const niveisRaiz = raiz.split(SEPARADOR_CATEGORIA).map((n) => normalizarTexto(n)).filter(Boolean)
  if (niveisRaiz.length === 0) return false

  const niveis = niveisCategoria(categoriaProduto).map((n) => normalizarTexto(n))
  if (niveis.length < niveisRaiz.length) return false

  return niveisRaiz.every((nivel, i) => niveis[i] === nivel)
}

/** `true` se a linha esta ativa no Bling. */
export function ativo(linha: LinhaCsv): boolean {
  return normalizarTexto(linha[COLUNA_SITUACAO] ?? '') === normalizarTexto(SITUACAO_ATIVO)
}

/**
 * `true` se a marca entra nesta estante.
 *
 * Lista vazia significa "todas", e nao "nenhuma": e o estado de fabrica, e uma
 * estante que nao aceitasse marca nenhuma nasceria vazia sem explicacao.
 * A comparacao e normalizada, para "MULTFILA" casar com "MultFila".
 */
export function marcaPermitida(marca: string, marcasPermitidas: readonly string[]): boolean {
  if (marcasPermitidas.length === 0) return true
  const alvo = normalizarTexto(marca)
  return marcasPermitidas.some((m) => normalizarTexto(m) === alvo)
}

/**
 * Ativo, dentro da raiz e com ao menos uma unidade no deposito.
 *
 * Estoque zero fica de fora: sem unidade nenhuma nao ha o que por na
 * prateleira, e a decisao do usuario foi que a celula nao fica reservada -- os
 * produtos seguintes sobem uma posicao.
 */
export function produtoElegivel(
  linha: LinhaCsv,
  raizCategoria: string,
  marcasPermitidas: readonly string[] = [],
): boolean {
  if (!ativo(linha)) return false
  if (!categoriaNaRaiz(linha[COLUNA_CATEGORIA] ?? '', raizCategoria)) return false
  if (!marcaPermitida(limpar(linha[COLUNA_MARCA] ?? ''), marcasPermitidas)) return false
  return estoqueContavel(linha) >= 1
}

/**
 * Os produtos que moram nesta estante, ja classificados.
 *
 * Deduplica por `Código`: a primeira ocorrencia vence e as demais viram aviso,
 * mesmo tratamento que `lerCsv` da a colunas repetidas. Duas celulas para o
 * mesmo SKU quebrariam a conferencia, que e chaveada pelo codigo.
 */
export interface OpcoesProdutos {
  raizCategoria: string
  /** Vazio = todas as marcas. */
  marcasPermitidas?: readonly string[]
  correcoes?: Record<string, CorrecaoClassificacao>
  /** Palavras que o usuario mandou ignorar ao extrair a cor. */
  palavrasIgnoradas?: readonly string[]
}

export function produtosDaEstante(
  planilha: Planilha,
  opcoes: OpcoesProdutos,
): { produtos: ProdutoEstante[]; avisos: string[] } {
  const { raizCategoria, marcasPermitidas = [], correcoes = {}, palavrasIgnoradas = [] } = opcoes

  const opcoesCor = { palavrasIgnoradas, ehCor: ehNomeDeCor }
  const produtos: ProdutoEstante[] = []
  const avisos: string[] = []
  const vistos = new Set<string>()
  const semMarca: string[] = []
  let semCodigo = 0

  for (const linha of planilha.linhas) {
    if (!produtoElegivel(linha, raizCategoria, marcasPermitidas)) {
      // Marca vazia no Bling nao aparece na lista de marcas da estante, entao
      // nao ha caixinha para marcar: o produto sumiria do mapa sem o usuario
      // ter como perceber, nem como incluir. Vale o mesmo cuidado do produto
      // sem Codigo -- o silencio e que e o problema.
      if (marcasPermitidas.length > 0 && produtoElegivel(linha, raizCategoria, [])) {
        if (limpar(linha[COLUNA_MARCA] ?? '') === '') {
          semMarca.push(codigoDaLinha(linha) || '(sem código)')
        }
      }
      continue
    }

    const codigo = codigoDaLinha(linha)
    if (codigo === '') {
      semCodigo++
      continue
    }
    if (vistos.has(codigo)) {
      avisos.push(`Código ${codigo} aparece mais de uma vez; usando a primeira ocorrência.`)
      continue
    }
    vistos.add(codigo)

    produtos.push({
      codigo,
      descricao: limpar(linha['Descrição'] ?? ''),
      classificacao: aplicarCorrecao(classificarLinha(linha, opcoesCor), correcoes[codigo]),
      estoqueDeposito: estoqueContavel(linha),
    })
  }

  if (semCodigo > 0) {
    avisos.push(
      `${semCodigo} produto(s) sem Código ficaram de fora: é o Código que identifica a posição na estante.`,
    )
  }

  if (semMarca.length > 0) {
    avisos.push(
      `${semMarca.length} produto(s) sem Marca no Bling ficaram de fora, porque esta estante ` +
        `filtra por marca e não há marca para casar: ${semMarca.join(', ')}. ` +
        `Preencha a Marca no Bling e reimporte, ou desmarque todas as marcas para aceitar todas.`,
    )
  }

  return { produtos, avisos }
}

/**
 * As marcas que existem dentro da raiz, para o usuario montar a lista da
 * estante. NAO aplica `marcasPermitidas` -- senao, uma vez escolhida uma marca,
 * as outras sumiriam da tela e nao dariam para marcar de volta.
 */
export function marcasDaRaiz(planilha: Planilha, raizCategoria: string): string[] {
  const marcas: string[] = []
  for (const linha of planilha.linhas) {
    if (!ativo(linha)) continue
    if (!categoriaNaRaiz(linha[COLUNA_CATEGORIA] ?? '', raizCategoria)) continue
    marcas.push(limpar(linha[COLUNA_MARCA] ?? ''))
  }
  return nomesDistintos(marcas).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * As raizes de categoria que existem neste arquivo (nivel 1, sem repetir), para
 * o usuario escolher em vez de digitar.
 */
export function raizesCategoria(planilha: Planilha): string[] {
  const raizes = new Set<string>()
  for (const linha of planilha.linhas) {
    const primeiro = niveisCategoria(linha[COLUNA_CATEGORIA] ?? '')[0]
    if (primeiro) raizes.add(primeiro)
  }
  return [...raizes].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
