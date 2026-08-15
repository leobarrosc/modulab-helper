import { useEffect, useMemo } from 'react'
import {
  alocarEstante,
  celulasOcupadas,
  chaveGrupo,
  CHAVE_DESCONHECIDA,
  identificarCor,
  itensReposicao,
  nomesDistintos,
  ordenarParaAlocacao,
  produtosDaEstante,
  progressoConferencia,
  iniciarConferencia,
} from '@/core/estante'
import ClassificacaoCorrecao from './ClassificacaoCorrecao'
import EstanteTemplateForm from './EstanteTemplateForm'
import Icone from './Icone'
import ImportPanel from './ImportPanel'
import ListaOrdenavel from './ListaOrdenavel'
import ListaReposicao from './ListaReposicao'
import MapaEstante from './MapaEstante'
import OrdemCores from './OrdemCores'
import Passo from './Passo'
import RegrasAndar from './RegrasAndar'
import SeletorEstante from './SeletorEstante'
import { useApp } from '../store'

/**
 * A aba de estante: monta o mapa da prateleira a partir do CSV e conduz a
 * conferencia.
 *
 * Nada de posicao gravada -- o plano e recalculado a cada render a partir dos
 * elegiveis do momento. E isso que faz "o estoque zerou, o produto sai da
 * estante e os de tras sobem" acontecer sozinho.
 */
export default function AbaEstante() {
  const {
    planilha,
    nomeArquivo,
    estantes,
    estanteAtivaId,
    correcoesClassificacao,
    palavrasIgnoradas,
    ordemTipos,
    ordemMarcas,
    ordemCores,
    ordemCoresPorGrupo,
    largurasCelula,
    conferencias,
    passosAbertos,
    alternarPasso,
    sincronizarOrdem,
    podarConferenciaDaEstante,
  } = useApp()

  const estante = estantes.find((e) => e.id === estanteAtivaId) ?? estantes[0] ?? null
  const raiz = estante?.raizCategoria ?? ''
  const capacidade = estante?.capacidadePorCelula ?? 0

  const marcasPermitidas = estante?.marcasPermitidas ?? []

  const { produtos, avisos } = useMemo(
    () =>
      planilha && estante
        ? produtosDaEstante(planilha, {
            raizCategoria: raiz,
            marcasPermitidas,
            correcoes: correcoesClassificacao,
            palavrasIgnoradas,
          })
        : { produtos: [], avisos: [] },
    [planilha, estante, raiz, marcasPermitidas, correcoesClassificacao, palavrasIgnoradas],
  )

  const ordenados = useMemo(
    () =>
      ordenarParaAlocacao(produtos, {
        ordemTipos,
        ordemMarcas,
        ordemCores,
        ordemCoresPorGrupo,
      }),
    [produtos, ordemTipos, ordemMarcas, ordemCores, ordemCoresPorGrupo],
  )

  const plano = useMemo(
    () => (estante ? alocarEstante(estante, ordenados, largurasCelula) : null),
    [estante, ordenados, largurasCelula],
  )

  // As chaves de cor que existem neste CSV, na ordem da estante -- e o que a
  // regra de andar oferece para marcar.
  const coresPresentes = useMemo(() => {
    const vistas = new Set(
      produtos.map((p) => identificarCor(p.classificacao.cor).base?.chave ?? CHAVE_DESCONHECIDA),
    )
    return ordemCores.filter((c) => vistas.has(c))
  }, [produtos, ordemCores])

  const porCodigo = useMemo(() => new Map(produtos.map((p) => [p.codigo, p])), [produtos])

  const conferencia = (estante && conferencias[estante.id]) || iniciarConferencia('')

  const reposicao = useMemo(
    () => (plano ? itensReposicao(plano, conferencia, capacidade, porCodigo) : []),
    [plano, conferencia, capacidade, porCodigo],
  )

  const progresso = plano
    ? progressoConferencia(plano, conferencia, capacidade)
    : { conferidas: 0, total: 0 }

  // Marca ou tipo que apareceu no CSV e ainda nao tem lugar entra no fim da
  // ordem. `nomesDistintos` funde as grafias -- "MultFila" e "MULTFILA" sao uma
  // marca so, e nao duas linhas para arrastar.
  const tiposPresentes = useMemo(
    () => nomesDistintos(produtos.map((p) => p.classificacao.tipo)),
    [produtos],
  )

  const marcasPresentes = useMemo(
    () => nomesDistintos(produtos.map((p) => p.classificacao.marca)),
    [produtos],
  )

  // Pares marca+tipo distintos: e a granularidade em que uma excecao de ordem
  // de cor faz sentido, porque cada par cai num trecho contiguo da prateleira.
  const gruposPresentes = useMemo(() => {
    const vistos = new Set<string>()
    const grupos: { marca: string; tipo: string }[] = []
    for (const p of produtos) {
      const { marca, tipo } = p.classificacao
      const chave = chaveGrupo(marca, tipo)
      if (vistos.has(chave)) continue
      vistos.add(chave)
      grupos.push({ marca, tipo })
    }
    return grupos
  }, [produtos])

  useEffect(() => {
    sincronizarOrdem('tipos', tiposPresentes)
  }, [tiposPresentes, sincronizarOrdem])

  useEffect(() => {
    sincronizarOrdem('marcas', marcasPresentes)
  }, [marcasPresentes, sincronizarOrdem])

  // Marcacoes de quem saiu da estante nao precisam ocupar o storage para sempre.
  const codigosNoPlano = useMemo(
    () => new Set(plano ? celulasOcupadas(plano).map((c) => c.codigo as string) : []),
    [plano],
  )

  useEffect(() => {
    if (estante) podarConferenciaDaEstante(estante.id, codigosNoPlano)
  }, [estante, codigosNoPlano, podarConferenciaDaEstante])

  if (!planilha) {
    return (
      <div className="fluxo">
        <section className="passo aberto">
          <div className="passo-conteudo">
            <p className="dica">
              A estante usa o mesmo CSV da aba <strong>Etiquetas</strong>. Importe o arquivo do
              Bling aqui e ele vale para as duas.
            </p>
            <ImportPanel />
          </div>
        </section>
      </div>
    )
  }

  if (!estante) {
    return (
      <div className="fluxo">
        <Passo
          numero={1}
          icone="estante"
          titulo="Cadastrar a estante"
          aberto
          aoAlternar={() => alternarPasso('estante-template')}
        >
          <EstanteTemplateForm />
        </Passo>
      </div>
    )
  }

  const ocupadas = plano ? celulasOcupadas(plano).length : 0

  const bloqueados = estante.andaresBloqueados.length

  return (
    <div className="fluxo">
      <SeletorEstante />

      <Passo
        numero={1}
        icone="estante"
        titulo="A estante"
        concluido
        aberto={!!passosAbertos['estante-template']}
        aoAlternar={() => alternarPasso('estante-template')}
        resumo={[
          `${estante.andares} × ${estante.colunas}`,
          `${estante.capacidadePorCelula} por célula`,
          estante.raizCategoria || 'sem raiz',
          marcasPermitidas.length > 0 ? `${marcasPermitidas.length} marcas` : null,
          bloqueados > 0 ? `${bloqueados} andar(es) fora de uso` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <EstanteTemplateForm />
        <h3 className="titulo-secao">O que vai em cada andar</h3>
        <RegrasAndar
          estante={estante}
          marcas={marcasPresentes}
          tipos={tiposPresentes}
          cores={coresPresentes}
        />
      </Passo>

      <Passo
        numero={2}
        icone="ajustes"
        titulo="Como organizar"
        concluido={produtos.length > 0}
        aberto={!!passosAbertos['estante-correcao']}
        aoAlternar={() => alternarPasso('estante-correcao')}
        resumo={`${produtos.length} produtos · ${marcasPresentes.filter(Boolean).length} marcas · ${tiposPresentes.length} tipos`}
      >
        <div className="organizacao">
          <div className="ordens">
            <ListaOrdenavel
              eixo="marcas"
              titulo="Ordem das marcas"
              dica="Marca nova sempre começa um andar novo, então esta ordem decide qual marca fica em qual altura da estante."
              presentes={marcasPresentes}
              vazio="Nenhuma marca preenchida neste arquivo."
            />
            <ListaOrdenavel
              eixo="tipos"
              titulo="Ordem dos tipos"
              dica="A sequência dentro de cada marca."
              presentes={tiposPresentes}
              vazio="Nenhum tipo de filamento neste arquivo."
            />
            <OrdemCores grupos={gruposPresentes} />
          </div>
          <ClassificacaoCorrecao produtos={produtos} />
        </div>
      </Passo>

      <Passo
        numero={3}
        icone="lista"
        titulo="Conferir a estante"
        concluido={progresso.total > 0 && progresso.conferidas === progresso.total}
        aberto={!!passosAbertos['estante-mapa']}
        aoAlternar={() => alternarPasso('estante-mapa')}
        resumo={`${ocupadas} células ocupadas · ${progresso.conferidas} de ${progresso.total} conferidas`}
      >
        {plano && (
          <MapaEstante
            estante={estante}
            plano={plano}
            conferencia={conferencia}
            porCodigo={porCodigo}
            progresso={progresso}
          />
        )}
      </Passo>

      <Passo
        numero={4}
        icone="importar"
        titulo="O que repor"
        concluido={reposicao.length === 0 && progresso.total > 0}
        aberto={!!passosAbertos['estante-reposicao']}
        aoAlternar={() => alternarPasso('estante-reposicao')}
        resumo={
          reposicao.length === 0
            ? 'Nada a repor'
            : `${reposicao.length} produto(s) · ${reposicao.reduce((s, i) => s + i.faltam, 0)} rolo(s)`
        }
      >
        <ListaReposicao itens={reposicao} estante={estante} arquivo={nomeArquivo} />
      </Passo>

      {avisos.length > 0 && (
        <div className="problemas">
          <strong>
            <Icone nome="arquivo" tamanho={13} /> Avisos da leitura
          </strong>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
