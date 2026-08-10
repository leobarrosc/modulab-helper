import { useMemo } from 'react'
import { numeroBr, type Planilha } from '@/core/csv'
import {
  bloqueada,
  contarSemCodigo,
  contarSemEstoque,
  etiquetasDaLinha,
  fontesDisponiveis,
  semCodigo,
  temEstoque,
  totalEtiquetas,
  valorCodigo,
} from '@/core/produtos'
import { ordenar, type Ordem } from '@/core/ordenacao'
import { categoriasDe, colunasVisiveis, filtrar, useApp } from '../store'
import SeletorFonte from './SeletorFonte'

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Colunas numericas que ficam melhor alinhadas a direita e formatadas. */
const NUMERICAS = new Set(['Preço', 'Estoque', 'Preço de custo', 'Preço de Compra'])

function exibir(coluna: string, valor: string): string {
  if (!valor) return '—'
  const n = numeroBr(valor)
  if (n === null) return valor
  if (coluna.startsWith('Preço')) return MOEDA.format(n)
  if (coluna === 'Estoque') return String(n)
  return valor
}

/** Cabecalho clicavel que cicla crescente -> decrescente -> ordem do arquivo. */
function CabecalhoOrdenavel({
  coluna,
  className,
  ordem,
  aoClicar,
  children,
}: {
  coluna: string
  className?: string
  ordem: Ordem | null
  aoClicar: (coluna: string) => void
  children: React.ReactNode
}) {
  const ativa = ordem?.coluna === coluna
  const direcao = ativa ? ordem.direcao : null

  return (
    <th
      className={className}
      aria-sort={direcao === 'asc' ? 'ascending' : direcao === 'desc' ? 'descending' : 'none'}
    >
      <button
        type="button"
        className="ordenar"
        onClick={() => aoClicar(coluna)}
        title={
          direcao === 'asc'
            ? `${coluna}: crescente. Clique para inverter.`
            : direcao === 'desc'
              ? `${coluna}: decrescente. Clique para voltar à ordem do arquivo.`
              : `Ordenar por ${coluna}`
        }
      >
        <span className="ordenar-texto">{children}</span>
        <span className={ativa ? 'seta ativa' : 'seta'} aria-hidden="true">
          {direcao === 'desc' ? '▼' : '▲'}
        </span>
      </button>
    </th>
  )
}

export default function ProductTable({ planilha }: { planilha: Planilha }) {
  const {
    selecionados,
    quantidades,
    busca,
    categoria,
    soAtivos,
    multiplicarPorEstoque,
    fonteCodigo,
    ordem,
    alternarOrdem,
    alternar,
    definirQuantidade,
    marcarVisiveis,
    setBusca,
    setCategoria,
    setSoAtivos,
    setMultiplicarPorEstoque,
  } = useApp()

  const colunas = useMemo(() => colunasVisiveis(planilha, fonteCodigo), [planilha, fonteCodigo])
  const categorias = useMemo(() => categoriasDe(planilha), [planilha])
  const comEstoque = useMemo(() => temEstoque(planilha), [planilha])
  const zerados = useMemo(() => contarSemEstoque(planilha), [planilha])
  const fontes = useMemo(() => fontesDisponiveis(planilha), [planilha])
  const semCodigos = useMemo(
    () => contarSemCodigo(planilha, fonteCodigo),
    [planilha, fonteCodigo],
  )
  // Filtra e so entao ordena: a ordem resultante e a ordem de impressao.
  const visiveis = useMemo(
    () => ordenar(planilha, filtrar(planilha, { busca, categoria, soAtivos }), ordem),
    [planilha, busca, categoria, soAtivos, ordem],
  )

  const multiplicando = comEstoque && multiplicarPorEstoque

  // "Marcar todos" so alcanca as linhas que podem render etiqueta; senao
  // ele re-selecionaria justamente os produtos travados por falta de estoque.
  const selecionaveis = useMemo(
    () => visiveis.filter((i) => !bloqueada(planilha.linhas[i]!, multiplicando)),
    [visiveis, planilha, multiplicando],
  )

  const marcadosVisiveis = selecionaveis.filter((i) => selecionados.has(i)).length
  const todosMarcados = selecionaveis.length > 0 && marcadosVisiveis === selecionaveis.length
  const total = totalEtiquetas(planilha, selecionados, quantidades, multiplicando)

  return (
    <section className="produtos">
      {planilha.avisos.map((aviso) => (
        <p key={aviso} className="aviso">
          {aviso}
        </p>
      ))}

      <SeletorFonte disponiveis={fontes} />

      <div className="filtros">
        <input
          type="search"
          placeholder="Buscar em todas as colunas…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {categorias.length > 0 && (
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {planilha.colunas.includes('Situação') && (
          <label className="checa">
            <input
              type="checkbox"
              checked={soAtivos}
              onChange={(e) => setSoAtivos(e.target.checked)}
            />
            Só ativos
          </label>
        )}

        {comEstoque && (
          <label className="checa" title="Imprime uma etiqueta para cada unidade em estoque">
            <input
              type="checkbox"
              checked={multiplicarPorEstoque}
              onChange={(e) => setMultiplicarPorEstoque(e.target.checked)}
            />
            Multiplicar pelo estoque
          </label>
        )}
      </div>

      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th className="col-checa">
                <input
                  type="checkbox"
                  aria-label="Marcar todos os visíveis"
                  checked={todosMarcados}
                  ref={(el) => {
                    if (el) el.indeterminate = marcadosVisiveis > 0 && !todosMarcados
                  }}
                  onChange={(e) => marcarVisiveis(selecionaveis, e.target.checked)}
                />
              </th>
              <CabecalhoOrdenavel
                coluna={fonteCodigo}
                className="col-codigo"
                ordem={ordem}
                aoClicar={alternarOrdem}
              >
                {fonteCodigo}
                <span className="etiqueta-coluna">código de barras</span>
              </CabecalhoOrdenavel>
              {colunas.map((c) => (
                <CabecalhoOrdenavel
                  key={c}
                  coluna={c}
                  className={NUMERICAS.has(c) ? 'num' : undefined}
                  ordem={ordem}
                  aoClicar={alternarOrdem}
                >
                  {c}
                </CabecalhoOrdenavel>
              ))}
              <th className="col-qtd num">Qtd.</th>
              <th className="col-etiquetas num">Etiquetas</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => {
              const linha = planilha.linhas[i]
              if (!linha) return null

              const travada = bloqueada(linha, multiplicando)
              const marcado = selecionados.has(i) && !travada
              const quantidade = quantidades.get(i) ?? 1
              const rende = etiquetasDaLinha(linha, quantidade, multiplicando)
              const codigo = valorCodigo(linha, fonteCodigo)
              const faltaCodigo = semCodigo(linha, fonteCodigo)

              return (
                <tr
                  key={i}
                  className={[marcado && 'marcada', travada && 'travada', faltaCodigo && 'sem-codigo']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="col-checa">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${linha['Descrição'] ?? i}`}
                      checked={marcado}
                      disabled={travada}
                      title={travada ? 'Sem estoque: não renderia nenhuma etiqueta' : undefined}
                      onChange={() => alternar(i)}
                    />
                  </td>
                  <td className="col-codigo">
                    {faltaCodigo ? (
                      <span className="codigo-falta" title={`Sem ${fonteCodigo} neste produto`}>
                        sem {fonteCodigo}
                      </span>
                    ) : (
                      <span className="codigo">{codigo}</span>
                    )}
                  </td>
                  {colunas.map((c) => (
                    <td key={c} className={NUMERICAS.has(c) ? 'num' : undefined} title={linha[c]}>
                      {exibir(c, linha[c] ?? '')}
                    </td>
                  ))}
                  <td className="col-qtd">
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={quantidade}
                      disabled={!marcado}
                      aria-label="Quantidade de etiquetas por unidade"
                      onChange={(e) => definirQuantidade(i, Number(e.target.value))}
                    />
                  </td>
                  <td className="col-etiquetas num">
                    <span className={travada ? 'rende-zero' : 'rende'}>{rende}</span>
                    {travada && <span className="motivo">sem estoque</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {visiveis.length === 0 && <p className="vazio">Nenhum produto corresponde aos filtros.</p>}
      </div>

      <div className="resumo">
        <span>
          <strong>{selecionados.size}</strong> de {planilha.linhas.length} produtos selecionados
          {zerados > 0 && (
            <span className="nota">
              {' '}
              · {zerados} sem estoque {multiplicando ? 'travado' : 'desmarcado'}
              {zerados === 1 ? '' : 's'}
            </span>
          )}
          {semCodigos > 0 && (
            <span className="nota-alerta">
              {' '}
              · {semCodigos} sem {fonteCodigo}
            </span>
          )}
        </span>
        <span className="resumo-total">
          <strong>{total}</strong> {total === 1 ? 'etiqueta' : 'etiquetas'} a imprimir
          {multiplicando && <span className="nota"> (qtd. × estoque)</span>}
        </span>
      </div>
    </section>
  )
}
