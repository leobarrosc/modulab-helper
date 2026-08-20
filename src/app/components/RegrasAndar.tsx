import {
  CHAVE_DESCONHECIDA,
  corPorChave,
  normalizarTexto,
  regraVazia,
  type RegraAndar as Regra,
  type TemplateEstante,
} from '@/core/estante'
import Icone from './Icone'
import { useApp } from '../store'

/** Uma lista de caixinhas que devolve a selecao inteira a cada clique. */
function Escolhas({
  titulo,
  opcoes,
  escolhidas,
  aoAlternar,
  rotulo = (v: string) => v,
  amostra,
}: {
  titulo: string
  opcoes: string[]
  escolhidas: string[]
  aoAlternar: (valor: string) => void
  rotulo?: (valor: string) => string
  amostra?: (valor: string) => string | null
}) {
  if (opcoes.length === 0) return null

  return (
    <div className="regra-eixo">
      <span className="campo-rotulo">
        {titulo}
        {escolhidas.length === 0 && <em> · qualquer</em>}
      </span>
      <div className="caixas">
        {opcoes.map((opcao) => {
          const hex = amostra?.(opcao) ?? null
          return (
            <label key={opcao} className="checa">
              <input
                type="checkbox"
                checked={escolhidas.includes(opcao)}
                onChange={() => aoAlternar(opcao)}
              />
              {amostra && (
                <span
                  className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
                  style={hex ? { background: hex } : undefined}
                  aria-hidden="true"
                />
              )}
              <span>{rotulo(opcao)}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

const nomeDaCor = (chave: string): string =>
  chave === CHAVE_DESCONHECIDA ? 'Multicolor' : (corPorChave(chave)?.nome ?? chave)

/** O resumo do cabecalho, que precisa citar a excecao para nao mentir. */
function resumoDaRegra(regra: Regra): string {
  const excecoes = Object.entries(regra.coresPorTipo ?? {}).map(([, cores]) =>
    cores.length === 0 ? 'qualquer cor' : cores.map(nomeDaCor).join('/'),
  )

  return [
    regra.marcas.join(', '),
    regra.tipos.join(', '),
    regra.cores.map(nomeDaCor).join(', '),
    excecoes.length > 0 ? `${excecoes.length} exceção(ões) por tipo` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Os tipos que valem excecao neste andar: os escolhidos na regra, ou todos os
 * do CSV quando a regra aceita qualquer tipo.
 *
 * Um tipo com excecao gravada entra na lista mesmo se sair da regra depois --
 * senao a excecao ficaria invisivel e sem como desligar.
 */
function tiposEmJogo(regra: Regra, todos: string[]): string[] {
  const base = regra.tipos.length > 0 ? regra.tipos : todos
  const vistos = new Set(base.map((t) => normalizarTexto(t)))
  const orfaos = todos.filter(
    (t) => !vistos.has(normalizarTexto(t)) && normalizarTexto(t) in (regra.coresPorTipo ?? {}),
  )
  return [...base, ...orfaos]
}

/**
 * Sem excecao nenhuma o campo sai da regra, em vez de virar `{}` -- e o que
 * mantem uma regra antiga gravada exatamente como era.
 */
function comExcecoes(regra: Regra, coresPorTipo: Record<string, string[]>): Regra {
  const { coresPorTipo: _antigo, ...resto } = regra
  return Object.keys(coresPorTipo).length > 0 ? { ...resto, coresPorTipo } : resto
}

/**
 * O que cada andar aceita.
 *
 * Um andar com regra so recebe quem a atende, e quem a atende so vai para la --
 * e o que faz "o andar 1 so tem PLA preto, branco e matte" valer nos dois
 * sentidos. Andar sem regra recebe o que sobrou, com a quebra por marca.
 *
 * Eixo sem nada marcado significa "qualquer", e nao "nenhum": marcar so as
 * cores limita a cor e aceita qualquer marca e tipo.
 */
export default function RegrasAndar({
  estante,
  marcas,
  tipos,
  cores,
}: {
  estante: TemplateEstante
  marcas: string[]
  tipos: string[]
  /** Chaves de cor presentes no CSV. */
  cores: string[]
}) {
  const { definirRegraAndar, limparRegraAndar } = useApp()

  const andares = Array.from({ length: estante.andares }, (_, i) => i + 1).filter(
    (a) => !estante.andaresBloqueados.includes(a),
  )

  if (andares.length === 0) {
    return <p className="dica">Todos os andares estão fora de uso.</p>
  }

  const regraDe = (andar: number) =>
    estante.regrasAndar.find((r) => r.andar === andar) ?? {
      andar,
      marcas: [],
      tipos: [],
      cores: [],
    }

  const alternar = (andar: number, eixo: 'marcas' | 'tipos' | 'cores', valor: string) => {
    const regra = regraDe(andar)
    const atual = regra[eixo]
    definirRegraAndar(estante.id, {
      ...regra,
      [eixo]: atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor],
    })
  }

  /** Liga/desliga a excecao de um tipo. Ligada nasce vazia = qualquer cor. */
  const alternarExcecao = (andar: number, tipo: string) => {
    const regra = regraDe(andar)
    const chave = normalizarTexto(tipo)
    const atual = { ...(regra.coresPorTipo ?? {}) }

    if (chave in atual) delete atual[chave]
    else atual[chave] = []

    definirRegraAndar(estante.id, comExcecoes(regra, atual))
  }

  /** Marca/desmarca uma cor DENTRO da excecao de um tipo. */
  const alternarCorDoTipo = (andar: number, tipo: string, chaveCor: string) => {
    const regra = regraDe(andar)
    const chave = normalizarTexto(tipo)
    const atual = { ...(regra.coresPorTipo ?? {}) }
    const cores = atual[chave] ?? []

    atual[chave] = cores.includes(chaveCor)
      ? cores.filter((c) => c !== chaveCor)
      : [...cores, chaveCor]

    definirRegraAndar(estante.id, comExcecoes(regra, atual))
  }

  return (
    <div className="regras-andar">
      <p className="dica">
        Por padrão cada andar recebe o que couber, na ordem. Marque abaixo para reservar um andar
        — ele passa a aceitar <strong>só</strong> o que você marcou, e o que você marcou não vai
        para nenhum outro andar.
      </p>

      {andares.map((andar) => {
        const regra = regraDe(andar)
        const livre = regraVazia(regra)

        return (
          <details key={andar} className="regra-andar" open={!livre}>
            <summary>
              <strong>Andar {andar}</strong>
              <span className="dica">
                {livre ? 'o que couber' : resumoDaRegra(regra)}
              </span>
              {!livre && (
                <button
                  type="button"
                  className="secundario"
                  title="Voltar a receber o que couber"
                  onClick={(e) => {
                    e.preventDefault()
                    limparRegraAndar(estante.id, andar)
                  }}
                >
                  <Icone nome="desfazer" tamanho={13} />
                </button>
              )}
            </summary>

            <Escolhas
              titulo="Marcas"
              opcoes={marcas}
              escolhidas={regra.marcas}
              aoAlternar={(v) => alternar(andar, 'marcas', v)}
            />
            <Escolhas
              titulo="Tipos"
              opcoes={tipos}
              escolhidas={regra.tipos}
              aoAlternar={(v) => alternar(andar, 'tipos', v)}
            />
            <Escolhas
              titulo="Cores"
              opcoes={cores}
              escolhidas={regra.cores}
              aoAlternar={(v) => alternar(andar, 'cores', v)}
              rotulo={(c) =>
                c === CHAVE_DESCONHECIDA ? 'Multicolor' : (corPorChave(c)?.nome ?? c)
              }
              amostra={(c) => corPorChave(c)?.hex ?? null}
            />

            {tiposEmJogo(regra, tipos).length > 0 && (
              <div className="regra-eixo">
                <span className="campo-rotulo">Cores por tipo</span>
                <p className="dica">
                  Um tipo com cores próprias ignora as Cores acima. É como se escreve “só PLA
                  preto, mas qualquer PLA Matte”.
                </p>

                {tiposEmJogo(regra, tipos).map((tipo) => {
                  const excecao = regra.coresPorTipo?.[normalizarTexto(tipo)]
                  const ligada = excecao !== undefined

                  return (
                    <div key={tipo} className="regra-excecao">
                      <label className="checa">
                        <input
                          type="checkbox"
                          checked={ligada}
                          onChange={() => alternarExcecao(andar, tipo)}
                        />
                        <span>
                          <strong>{tipo}</strong>
                          {!ligada && <em className="dica"> · usa as Cores acima</em>}
                          {ligada && excecao.length === 0 && (
                            <em className="dica"> · qualquer cor</em>
                          )}
                        </span>
                      </label>

                      {ligada && (
                        <div className="caixas">
                          {cores.map((c) => {
                            const hex = corPorChave(c)?.hex ?? null
                            return (
                              <label key={c} className="checa">
                                <input
                                  type="checkbox"
                                  checked={excecao.includes(c)}
                                  onChange={() => alternarCorDoTipo(andar, tipo, c)}
                                />
                                <span
                                  className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
                                  style={hex ? { background: hex } : undefined}
                                  aria-hidden="true"
                                />
                                <span>
                                  {c === CHAVE_DESCONHECIDA
                                    ? 'Multicolor'
                                    : (corPorChave(c)?.nome ?? c)}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}
