import { useEffect, useRef, useState } from 'react'
import { CHAVE_DESCONHECIDA, chaveGrupo, corPorChave } from '@/core/estante'
import Icone from './Icone'
import { useApp } from '../store'

/** Rotulo e bolinha de uma chave de cor. */
function amostra(chave: string): { nome: string; hex: string | null } {
  if (chave === CHAVE_DESCONHECIDA) {
    return { nome: 'Multicolor e efeitos', hex: null }
  }
  const cor = corPorChave(chave)
  return { nome: cor?.nome ?? chave, hex: cor?.hex ?? null }
}

/**
 * A ordem das cores: geral da estante, ou uma excecao para um par marca+tipo.
 *
 * A lista e das cores BASE, e nao dos nomes completos: sao ~20 linhas em vez de
 * 60, e as variacoes continuam coladas na cor que as nomeia -- VERDE MENTA
 * acompanha VERDE onde quer que ele va.
 */
export default function OrdemCores({
  grupos,
}: {
  /** Pares marca+tipo presentes, para oferecer a excecao. */
  grupos: { marca: string; tipo: string }[]
}) {
  const {
    ordemCores,
    ordemCoresPorGrupo,
    moverCor,
    moverCorParaIndice,
    criarOrdemCoresDoGrupo,
    limparOrdemCoresDoGrupo,
  } = useApp()

  const [grupoAtivo, setGrupoAtivo] = useState('')
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [indiceAlvo, setIndiceAlvo] = useState<number | null>(null)
  const listaRef = useRef<HTMLUListElement>(null)

  const temExcecao = grupoAtivo !== '' && !!ordemCoresPorGrupo[grupoAtivo]
  const ordem = temExcecao ? ordemCoresPorGrupo[grupoAtivo]! : ordemCores

  const atual = useRef({ indiceAlvo, ordem, grupoAtivo, temExcecao, moverCorParaIndice })
  atual.current = { indiceAlvo, ordem, grupoAtivo, temExcecao, moverCorParaIndice }

  useEffect(() => {
    if (arrastando === null) return

    function aoMover(e: PointerEvent) {
      const linhas = listaRef.current?.querySelectorAll('li[data-cor]')
      if (!linhas) return

      let melhor = 0
      let menor = Number.POSITIVE_INFINITY
      linhas.forEach((linha, i) => {
        const r = linha.getBoundingClientRect()
        const d = Math.abs(e.clientY - (r.top + r.height / 2))
        if (d < menor) {
          menor = d
          melhor = i
        }
      })
      setIndiceAlvo(melhor)
    }

    function aoSoltar() {
      const { indiceAlvo: alvo, ordem: lista, grupoAtivo: grupo, temExcecao: excecao, moverCorParaIndice: aplicar } = atual.current
      const chaveAlvo = alvo === null ? undefined : lista[alvo]
      if (chaveAlvo !== undefined && chaveAlvo !== arrastando) {
        aplicar(arrastando!, alvo!, excecao ? grupo : undefined)
      }
      setArrastando(null)
      setIndiceAlvo(null)
    }

    window.addEventListener('pointermove', aoMover)
    window.addEventListener('pointerup', aoSoltar)
    window.addEventListener('pointercancel', aoSoltar)
    return () => {
      window.removeEventListener('pointermove', aoMover)
      window.removeEventListener('pointerup', aoSoltar)
      window.removeEventListener('pointercancel', aoSoltar)
    }
  }, [arrastando])

  const grupoDaExcecao = temExcecao ? grupoAtivo : undefined

  return (
    <div className="ordem-lista">
      <h3>Ordem das cores</h3>
      <p className="dica">
        Vale para a estante toda. Arraste para mudar — as variações acompanham a cor base, então
        Verde Menta segue o Verde.
      </p>

      <label className="campo">
        <span className="campo-rotulo">Exceção para</span>
        <select value={grupoAtivo} onChange={(e) => setGrupoAtivo(e.target.value)}>
          <option value="">A estante toda</option>
          {grupos.map(({ marca, tipo }) => {
            const chave = chaveGrupo(marca, tipo)
            return (
              <option key={chave} value={chave}>
                {marca || 'Sem marca'} › {tipo || 'Sem tipo'}
                {ordemCoresPorGrupo[chave] ? ' ✓' : ''}
              </option>
            )
          })}
        </select>
      </label>

      {grupoAtivo !== '' && !temExcecao && (
        <p className="dica">
          Este grupo segue a ordem geral.{' '}
          <button
            type="button"
            className="secundario"
            onClick={() => criarOrdemCoresDoGrupo(grupoAtivo)}
          >
            Criar ordem só para ele
          </button>
        </p>
      )}

      {temExcecao && (
        <p className="dica">
          Editando só este grupo.{' '}
          <button
            type="button"
            className="secundario"
            onClick={() => limparOrdemCoresDoGrupo(grupoAtivo)}
          >
            Voltar à ordem geral
          </button>
        </p>
      )}

      <ul className="lista-arrastavel lista-cores" ref={listaRef}>
        {ordem.map((chave, i) => {
          const { nome, hex } = amostra(chave)
          return (
            <li
              key={chave}
              data-cor={chave}
              className={[
                'arrastavel',
                arrastando === chave && 'arrastando',
                arrastando !== null && indiceAlvo === i && arrastando !== chave && 'solta-alvo',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className="pega"
                aria-label={`Arrastar ${nome}`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  try {
                    e.currentTarget.setPointerCapture(e.pointerId)
                  } catch {
                    /* sem captura: o window resolve */
                  }
                  setArrastando(chave)
                  setIndiceAlvo(i)
                }}
              >
                <Icone nome="arrastar" tamanho={14} />
              </button>

              <span className="ordem-numero">{i + 1}</span>
              <span
                className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
                style={hex ? { background: hex } : undefined}
                aria-hidden="true"
              />
              <span className="ordem-nome">{nome}</span>

              <span className="ordem-botoes">
                <button
                  type="button"
                  className="secundario"
                  title="Mover para cima"
                  aria-label={`Mover ${nome} para cima`}
                  disabled={i === 0}
                  onClick={() => moverCor(chave, -1, grupoDaExcecao)}
                >
                  <Icone nome="seta" className="seta-cima" tamanho={13} />
                </button>
                <button
                  type="button"
                  className="secundario"
                  title="Mover para baixo"
                  aria-label={`Mover ${nome} para baixo`}
                  disabled={i === ordem.length - 1}
                  onClick={() => moverCor(chave, 1, grupoDaExcecao)}
                >
                  <Icone nome="seta" className="seta-baixo" tamanho={13} />
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
