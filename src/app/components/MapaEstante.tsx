import { capacidadeDaCelula, conferidosDaCelula, hexDaCor, nomesDistintos } from '@/core/estante'
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
 * "Frente" e "Trás" so fazem sentido com dois em fila. Num bloco largo, as
 * posicoes sao numeradas: 6 rolos num bloco de 3 colunas com 2 de profundidade.
 */
function rotuloPosicao(indice: number, capacidade: number): string {
  if (capacidade !== 2) return `Posição ${indice + 1}`
  return indice === 0 ? 'Frente' : 'Trás'
}

function siglaPosicao(indice: number, capacidade: number): string {
  if (capacidade !== 2) return String(indice + 1)
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
  const capacidade = capacidadeDaCelula(celula, estante.capacidadePorCelula)
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
          <button
            type="button"
            className="largura-botao"
            title="Ocupar uma coluna a mais"
            aria-label={`Aumentar a largura de ${classificacao.cor}`}
            disabled={celula.largura >= estante.colunas}
            onClick={() => setLarguraCelula(codigo, celula.largura + 1)}
          >
            +
          </button>
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
          <label key={i} className="checa" title={rotuloPosicao(i, capacidade)}>
            <input
              type="checkbox"
              checked={marcado}
              aria-label={`${rotuloPosicao(i, capacidade)} — ${classificacao.tipo} ${classificacao.cor}, célula ${celula.andar}.${celula.coluna}`}
              onChange={(e) =>
                marcarCelulaConferencia(estante.id, codigo, i, e.target.checked, capacidade)
              }
            />
            <span>{siglaPosicao(i, capacidade)}</span>
          </label>
        ))}
      </span>

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
            <div
              className="mapa-linha"
              style={{ gridTemplateColumns: `repeat(${estante.colunas}, minmax(8.5rem, 1fr))` }}
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
