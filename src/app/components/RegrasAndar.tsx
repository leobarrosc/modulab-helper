import { CHAVE_DESCONHECIDA, corPorChave, regraVazia, type TemplateEstante } from '@/core/estante'
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
                {livre
                  ? 'o que couber'
                  : [
                      regra.marcas.join(', '),
                      regra.tipos.join(', '),
                      regra.cores.map((c) => corPorChave(c)?.nome ?? c).join(', '),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
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
          </details>
        )
      })}
    </div>
  )
}
