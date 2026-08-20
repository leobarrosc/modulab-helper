import {
  capacidadeDaCelula,
  conferidosDaCelula,
  excedeEstoque,
  hexDaCor,
  larguraMaximaPeloEstoque,
  nomesDistintos,
} from '@/core/estante'
import type {
  Celula,
  EstadoConferencia,
  PlanoAlocacao,
  ProdutoEstante,
  TemplateEstante,
} from '@/core/estante'
import Icone from './Icone'
import { useApp } from '../store'

/**
 * "Frente" e "Trás" so fazem sentido com dois em fila numa coluna so. Num bloco
 * largo as posicoes sao numeradas: 6 rolos num bloco de 3 colunas com 2 de
 * profundidade.
 *
 * Decide pelas vagas FISICAS, e nao pela capacidade conferivel: com 1 rolo numa
 * celula de 2 de profundidade ainda ha uma frente e um fundo, e o rolo unico
 * vai na frente. Mostrar "1" ali perderia essa instrucao.
 */
function rotuloPosicao(indice: number, vagasFisicas: number): string {
  if (vagasFisicas !== 2) return `Posição ${indice + 1}`
  return indice === 0 ? 'Frente' : 'Trás'
}

function siglaPosicao(indice: number, vagasFisicas: number): string {
  if (vagasFisicas !== 2) return String(indice + 1)
  return indice === 0 ? 'F' : 'T'
}

function formatarData(iso: string): string {
  if (!iso) return ''
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR')
}

function CelulaEstante({
  celula,
  estante,
  conferencia,
  produto,
}: {
  celula: Celula
  estante: TemplateEstante
  conferencia: EstadoConferencia
  produto: ProdutoEstante | undefined
}) {
  const marcarCelulaConferencia = useApp((s) => s.marcarCelulaConferencia)
  const setLarguraCelula = useApp((s) => s.setLarguraCelula)

  if (celula.codigo === null || celula.classificacao === null) {
    return (
      <div
        className={celula.bloqueada ? 'celula-estante celula-bloqueada' : 'celula-estante celula-vazia'}
        aria-label={celula.bloqueada ? 'Andar fora de uso' : 'Célula vazia'}
      >
        <span className="celula-endereco">
          {celula.andar}.{celula.coluna}
        </span>
      </div>
    )
  }

  const { codigo, classificacao } = celula
  // Capacidade conferivel: ja limitada pelos rolos que existem. Uma caixinha a
  // mais seria uma posicao que ninguem pode preencher.
  const capacidade = capacidadeDaCelula(celula, estante.capacidadePorCelula)
  // Vagas fisicas da prateleira, que e outra coisa: e o que os textos de aviso
  // precisam citar para explicar por que a celula esta larga demais.
  const vagasFisicas = celula.largura * estante.capacidadePorCelula

  // A estante e fixa: a largura nunca muda sozinha. Isto so decide se o "+"
  // pode dar mais um passo agora, e se a largura ja gravada ainda cabe no
  // estoque de hoje -- que pode ter caido desde que o usuario multiplicou.
  const estoque = produto?.estoqueDeposito ?? 0
  const maxColuna = larguraMaximaPeloEstoque(estoque, estante.capacidadePorCelula)
  const podeMultiplicar = celula.largura < maxColuna && celula.largura < estante.colunas
  // So para o texto: se o limite de hoje e o estoque, e nao a propria
  // estante (celula ja na ultima coluna), vale explicar qual dos dois e.
  const travaPorEstoque = !podeMultiplicar && celula.largura < estante.colunas
  const excede = produto !== undefined && excedeEstoque(celula.largura, estoque, estante.capacidadePorCelula)

  const marcados = conferidosDaCelula(conferencia, codigo, capacidade)
  const completa = marcados.length > 0 && marcados.every(Boolean)
  const hex = hexDaCor(classificacao.cor)

  const fim = celula.coluna + celula.largura - 1
  const endereco =
    celula.largura > 1
      ? `${celula.andar}.${celula.coluna}–${celula.andar}.${fim}`
      : `${celula.andar}.${celula.coluna}`

  return (
    <div
      className={completa ? 'celula-estante completa' : 'celula-estante'}
      style={{ gridColumn: `span ${celula.largura}` }}
    >
      <span className="celula-endereco">
        {endereco}
        <span className="largura-controle">
          {/* O title fica no span, nao no botao: Chromium nao mostra tooltip
              de botao desabilitado, entao a explicacao nunca apareceria no +
              travado -- so o "-" que so desabilita no minimo obvio (largura 1)
              continua com o title no proprio botao. */}
          <button
            type="button"
            className="largura-botao"
            title="Ocupar uma coluna a menos"
            aria-label={`Diminuir a largura de ${classificacao.cor}`}
            disabled={celula.largura <= 1}
            onClick={() => setLarguraCelula(codigo, celula.largura - 1)}
          >
            −
          </button>
          <span className="largura-valor" title="Colunas ocupadas">
            {celula.largura}
          </span>
          <span
            className="largura-botao-wrap"
            title={
              podeMultiplicar
                ? undefined
                : travaPorEstoque
                  ? `O depósito tem ${estoque === 1 ? '1 rolo' : `${estoque} rolos`} e esta célula já oferece ${vagasFisicas === 1 ? '1 lugar' : `${vagasFisicas} lugares`}. Uma coluna a mais só entra com mais de ${vagasFisicas}.`
                  : 'Já ocupa a última coluna da estante'
            }
          >
            <button
              type="button"
              className="largura-botao"
              aria-label={`Aumentar a largura de ${classificacao.cor}`}
              disabled={!podeMultiplicar}
              onClick={() => setLarguraCelula(codigo, celula.largura + 1)}
            >
              +
            </button>
          </span>
          {travaPorEstoque && <span className="largura-trava">só {estoque} no depósito</span>}
        </span>
      </span>

      <span className="celula-cabeca">
        <span
          className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
          style={hex ? { background: hex } : undefined}
          aria-hidden="true"
        />
        <strong className="celula-cor">{classificacao.cor || 'Sem cor'}</strong>
      </span>

      <span className="celula-tipo">{classificacao.tipo || 'Sem tipo'}</span>
      <span className="celula-codigo">{codigo}</span>

      <span className="celula-checks">
        {marcados.map((marcado, i) => (
          <label key={i} className="checa" title={rotuloPosicao(i, vagasFisicas)}>
            <input
              type="checkbox"
              checked={marcado}
              aria-label={`${rotuloPosicao(i, vagasFisicas)} — ${classificacao.tipo} ${classificacao.cor}, célula ${celula.andar}.${celula.coluna}`}
              onChange={(e) =>
                marcarCelulaConferencia(estante.id, codigo, i, e.target.checked, capacidade)
              }
            />
            <span>{siglaPosicao(i, vagasFisicas)}</span>
          </label>
        ))}
      </span>

      {excede && (
        <span
          className="celula-excede"
          title={`A célula ocupa ${celula.largura} coluna(s) — ${vagasFisicas} lugares — e o depósito tem só ${estoque}. A largura foi definida à mão antes, e o estoque caiu desde então; diminua a largura para liberar espaço na estante.`}
        >
          {vagasFisicas} vagas · {estoque} em estoque
        </span>
      )}

      {produto && produto.estoqueDeposito === 0 && (
        <span className="celula-esgotado">sem estoque</span>
      )}
    </div>
  )
}

/**
 * A grade da prateleira, andar por andar.
 *
 * Cada celula mostra a bolinha da cor antes do texto: na frente da estante se
 * procura a cor, nao o nome do produto.
 */
export default function MapaEstante({
  estante,
  plano,
  conferencia,
  porCodigo,
  progresso,
}: {
  estante: TemplateEstante
  plano: PlanoAlocacao
  conferencia: EstadoConferencia
  porCodigo: ReadonlyMap<string, ProdutoEstante>
  progresso: { conferidas: number; total: number }
}) {
  const novaConferencia = useApp((s) => s.novaConferencia)

  // Um andar e de uma marca so (marca nova quebra andar), mas o rotulo lista
  // todas as que aparecerem -- se um dia a regra mudar, a tela nao mente.
  const andares = Array.from({ length: estante.andares }, (_, i) => {
    const celulas = plano.celulas.filter((c) => c.andar === i + 1)
    const marcas = nomesDistintos(
      celulas.map((c) => c.classificacao?.marca).filter((m): m is string => !!m),
    )
    return { celulas, marcas, bloqueado: celulas.every((c) => c.bloqueada) && celulas.length > 0 }
  })

  const iniciada = formatarData(conferencia.iniciadaEm)
  const pct = progresso.total > 0 ? Math.round((progresso.conferidas / progresso.total) * 100) : 0

  return (
    <div className="mapa-estante">
      <div className="mapa-barra">
        <div className="progresso" role="img" aria-label={`${pct}% conferido`}>
          <div className="progresso-trilho">
            <div className="progresso-preenchido" style={{ width: `${pct}%` }} />
          </div>
          <span>
            {progresso.conferidas} de {progresso.total} conferidas
          </span>
        </div>

        <div className="mapa-acoes">
          {iniciada && <span className="dica">Conferência de {iniciada}</span>}
          <button
            type="button"
            className="secundario"
            onClick={() => novaConferencia(estante.id)}
          >
            <Icone nome="refazer" tamanho={14} /> Nova conferência
          </button>
        </div>
      </div>

      <div className="mapa-rolagem">
        {andares.map(({ celulas, marcas, bloqueado }, i) => (
          <div key={i} className={bloqueado ? 'mapa-andar andar-fora' : 'mapa-andar'}>
            <span className="andar-rotulo">
              Andar {i + 1}
              {marcas.length > 0 && <em className="andar-marca">{marcas.join(' · ')}</em>}
              {bloqueado && <em className="andar-fora-nota">fora de uso</em>}
            </span>
            {/*
              5rem, e nao 8.5rem: com 12 colunas o minimo antigo estourava a
              largura da pagina e as celulas da direita sumiam sem aviso -- a
              barra de rolagem fica no rodape de TODOS os andares, entao ela
              nasce fora da tela e ninguem descobre que ha mais coluna. O `1fr`
              continua mandando quando ha espaco de sobra.
            */}
            <div
              className="mapa-linha"
              style={{ gridTemplateColumns: `repeat(${estante.colunas}, minmax(5rem, 1fr))` }}
            >
              {celulas.map((celula) => (
                <CelulaEstante
                  key={`${celula.andar}.${celula.coluna}`}
                  celula={celula}
                  estante={estante}
                  conferencia={conferencia}
                  produto={celula.codigo ? porCodigo.get(celula.codigo) : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {plano.avisos.length > 0 && (
        <div className="mapa-avisos">
          {plano.avisos.map((a) => (
            <p key={a} className="aviso">
              {a}
            </p>
          ))}
        </div>
      )}

      {plano.naoAlocados.length > 0 && (
        <div className="nao-alocados">
          <strong>Não coube na estante ({plano.naoAlocados.length})</strong>
          <p className="dica">
            Aumente os andares ou as colunas, ou tire uma categoria da estante.
          </p>
          <ul>
            {plano.naoAlocados.map((item) => (
              <li key={item.codigo}>
                <span className="celula-codigo">{item.codigo}</span> {item.classificacao.tipo}{' '}
                {item.classificacao.cor}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
