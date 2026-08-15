import { useEffect, useRef, useState } from 'react'
import { normalizarTexto } from '@/core/estante'
import Icone from './Icone'
import { useApp, type EixoOrdem } from '../store'

/**
 * Uma lista arrastavel de nomes -- serve a ordem das marcas e a dos tipos, que
 * tem exatamente a mesma mecanica.
 *
 * O arraste e feito com Pointer Events na mao, como no editor de etiqueta: os
 * listeners ficam no `window` para o arraste sobreviver ao ponteiro sair do
 * item. Os botoes de subir e descer nao sao enfeite -- sao o caminho de teclado,
 * sem o qual a ordem so existiria para quem usa mouse.
 */
export default function ListaOrdenavel({
  eixo,
  titulo,
  dica,
  presentes,
  vazio,
  amostra,
}: {
  eixo: EixoOrdem
  titulo: string
  dica: string
  /** Nomes que existem no CSV atual. */
  presentes: string[]
  /** Frase quando nao ha nenhum. */
  vazio: string
  /** Enfeite opcional a esquerda do nome, como a bolinha de cor. */
  amostra?: (nome: string) => React.ReactNode
}) {
  const ordemCompleta = useApp((s) => (eixo === 'marcas' ? s.ordemMarcas : s.ordemTipos))
  const mover = useApp((s) => s.mover)
  const moverParaIndice = useApp((s) => s.moverParaIndice)

  const [arrastando, setArrastando] = useState<string | null>(null)
  const [indiceAlvo, setIndiceAlvo] = useState<number | null>(null)
  const listaRef = useRef<HTMLUListElement>(null)

  // So os nomes que existem neste CSV; a ordem guarda tambem os de exports
  // antigos, que nao precisam poluir a tela. A comparacao e normalizada para
  // uma ordem gravada com outra grafia ("MULTFILA") ainda casar com a atual.
  const presentesNormalizados = new Set(presentes.map(normalizarTexto))
  const jaListados = new Set<string>()
  const itens = ordemCompleta.filter((n) => {
    const chave = normalizarTexto(n)
    if (!presentesNormalizados.has(chave) || jaListados.has(chave)) return false
    jaListados.add(chave)
    return true
  })

  // O efeito do arraste le tudo daqui, e nao das dependencias: senao cada
  // pointermove (que muda `indiceAlvo`) desmontaria e remontaria os listeners.
  const atual = useRef({ indiceAlvo, itens, ordemCompleta, moverParaIndice, eixo })
  atual.current = { indiceAlvo, itens, ordemCompleta, moverParaIndice, eixo }

  useEffect(() => {
    if (arrastando === null) return

    function aoMover(e: PointerEvent) {
      const linhas = listaRef.current?.querySelectorAll('li[data-nome]')
      if (!linhas) return

      let melhor = 0
      let menorDistancia = Number.POSITIVE_INFINITY

      linhas.forEach((linha, i) => {
        const r = linha.getBoundingClientRect()
        const distancia = Math.abs(e.clientY - (r.top + r.height / 2))
        if (distancia < menorDistancia) {
          menorDistancia = distancia
          melhor = i
        }
      })

      setIndiceAlvo(melhor)
    }

    function aoSoltar() {
      // O store so e tocado ao soltar. Reordenar a cada pixel faria o item
      // fugir de debaixo do ponteiro enquanto a lista se remonta.
      const { indiceAlvo: alvo, itens: lista, ordemCompleta: ordem, moverParaIndice: aplicar, eixo: qual } =
        atual.current

      const nomeAlvo = alvo === null ? undefined : lista[alvo]
      // O indice e da lista visivel; a ordem guardada pode ter nomes de exports
      // antigos no meio, entao o destino sai da posicao real do alvo.
      if (nomeAlvo !== undefined && nomeAlvo !== arrastando) {
        aplicar(qual, arrastando!, ordem.indexOf(nomeAlvo))
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

  return (
    <div className="ordem-lista">
      <h3>{titulo}</h3>
      <p className="dica">{dica}</p>

      {itens.length === 0 ? (
        <p className="dica">{vazio}</p>
      ) : (
        <ul className="lista-arrastavel" ref={listaRef}>
          {itens.map((nome, i) => (
            <li
              key={nome}
              data-nome={nome}
              className={[
                'arrastavel',
                arrastando === nome && 'arrastando',
                arrastando !== null && indiceAlvo === i && arrastando !== nome && 'solta-alvo',
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
                    /* navegador sem captura: o arraste ainda funciona pelo window */
                  }
                  setArrastando(nome)
                  setIndiceAlvo(i)
                }}
              >
                <Icone nome="arrastar" tamanho={14} />
              </button>

              <span className="ordem-numero">{i + 1}</span>
              {amostra?.(nome)}
              <span className="ordem-nome">{nome}</span>

              <span className="ordem-botoes">
                <button
                  type="button"
                  className="secundario"
                  title="Mover para cima"
                  aria-label={`Mover ${nome} para cima`}
                  disabled={i === 0}
                  onClick={() => mover(eixo, nome, -1)}
                >
                  <Icone nome="seta" className="seta-cima" tamanho={13} />
                </button>
                <button
                  type="button"
                  className="secundario"
                  title="Mover para baixo"
                  aria-label={`Mover ${nome} para baixo`}
                  disabled={i === itens.length - 1}
                  onClick={() => mover(eixo, nome, 1)}
                >
                  <Icone nome="seta" className="seta-baixo" tamanho={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
