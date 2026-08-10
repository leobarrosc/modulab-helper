import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LinhaCsv } from '@/core/csv'
import {
  encaixarMovimento,
  encaixarRedimensionamento,
  limitarAEtiqueta,
  type Alca,
  type Guia,
  type Retangulo,
} from '@/core/etiqueta/encaixe'
import { renderizarEtiqueta } from '@/core/etiqueta/render'
import type { Campo, Modelo } from '@/core/etiqueta/tipos'
import { mm } from '@/core/layout'
import DrawOps from './DrawOps'
import { useApp } from '../store'

const ALCAS: { alca: Alca; cx: number; cy: number; cursor: string }[] = [
  { alca: 'no', cx: 0, cy: 0, cursor: 'nwse-resize' },
  { alca: 'n', cx: 0.5, cy: 0, cursor: 'ns-resize' },
  { alca: 'ne', cx: 1, cy: 0, cursor: 'nesw-resize' },
  { alca: 'l', cx: 1, cy: 0.5, cursor: 'ew-resize' },
  { alca: 'se', cx: 1, cy: 1, cursor: 'nwse-resize' },
  { alca: 's', cx: 0.5, cy: 1, cursor: 'ns-resize' },
  { alca: 'so', cx: 0, cy: 1, cursor: 'nesw-resize' },
  { alca: 'o', cx: 0, cy: 0.5, cursor: 'ew-resize' },
]

interface Arraste {
  campoId: string
  alca: Alca | null
  /** Retângulo no início do arraste, em fração. */
  inicial: Retangulo
  /** Ponto do mouse no início, em fração. */
  origemX: number
  origemY: number
}

export default function LabelCanvas({
  modelo,
  linha,
  larguraMm,
  alturaMm,
}: {
  modelo: Modelo
  linha: LinhaCsv | null
  larguraMm: number
  alturaMm: number
}) {
  const { campoSelecionado, selecionarCampo, moverCampo, marcarHistorico, encaixe, setEncaixe } =
    useApp()

  const svgRef = useRef<SVGSVGElement>(null)
  const [arraste, setArraste] = useState<Arraste | null>(null)
  const [guias, setGuias] = useState<Guia[]>([])

  const contexto = useMemo(() => ({ linha: linha ?? ({} as LinhaCsv), indice: 1, total: 1 }), [linha])
  const { ops } = useMemo(
    () => renderizarEtiqueta(modelo, contexto, { xMm: 0, yMm: 0, larguraMm, alturaMm }),
    [modelo, contexto, larguraMm, alturaMm],
  )

  /** Converte um evento de ponteiro para fração da etiqueta. */
  const paraFracao = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const caixa = svg.getBoundingClientRect()
      return {
        x: ((e.clientX - caixa.left) / caixa.width) * (larguraMm / larguraMm),
        y: ((e.clientY - caixa.top) / caixa.height) * (alturaMm / alturaMm),
      }
    },
    [larguraMm, alturaMm],
  )

  function comecar(e: React.PointerEvent, campo: Campo, alca: Alca | null) {
    if (campo.travado) return
    e.stopPropagation()
    e.preventDefault()

    // A captura só mantém os eventos vindo se o ponteiro sair do elemento --
    // os listeners de move/up já estão no `window`. Ela lança NotFoundError
    // quando o pointerId não está mais ativo, e sem este try o arraste inteiro
    // morria antes de começar.
    try {
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
    } catch {
      /* segue sem captura */
    }

    const p = paraFracao(e)
    selecionarCampo(campo.id)
    // Um ponto de historico por ARRASTE, marcado aqui no inicio. `moverCampo`
    // nao registra nada, senao um Ctrl+Z desfaria um pixel de cada vez.
    marcarHistorico()
    setArraste({
      campoId: campo.id,
      alca,
      inicial: { x: campo.x, y: campo.y, w: campo.w, h: campo.h },
      origemX: p.x,
      origemY: p.y,
    })
  }

  useEffect(() => {
    if (!arraste) return

    function mover(e: PointerEvent) {
      if (!arraste) return
      const p = paraFracao(e)
      const dx = p.x - arraste.origemX
      const dy = p.y - arraste.origemY
      const outros = modelo.campos.filter((c) => c.id !== arraste.campoId)

      let resultado
      if (arraste.alca) {
        const bruto = aplicarAlca(arraste.inicial, arraste.alca, dx, dy)
        resultado = encaixarRedimensionamento(bruto, arraste.alca, outros, encaixe)
      } else {
        const bruto = { ...arraste.inicial, x: arraste.inicial.x + dx, y: arraste.inicial.y + dy }
        resultado = encaixarMovimento(bruto, outros, encaixe)
      }

      setGuias(resultado.guias)
      moverCampo(arraste.campoId, limitarAEtiqueta(resultado.retangulo))
    }

    function soltar() {
      setArraste(null)
      setGuias([])
    }

    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', soltar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', soltar)
    }
  }, [arraste, encaixe, modelo.campos, moverCampo, paraFracao])

  const selecionado = modelo.campos.find((c) => c.id === campoSelecionado) ?? null

  return (
    <div className="editor">
      <div className="editor-barra">
        <span className="editor-medida">
          {mm(larguraMm)} × {mm(alturaMm)} mm
        </span>
        <label className="checa">
          <input
            type="checkbox"
            checked={encaixe.naEtiqueta || encaixe.nosCampos}
            onChange={(e) =>
              setEncaixe({ naEtiqueta: e.target.checked, nosCampos: e.target.checked })
            }
          />
          Guias
        </label>
        <label className="checa">
          <input
            type="checkbox"
            checked={encaixe.passo > 0}
            onChange={(e) => setEncaixe({ passo: e.target.checked ? 1 / Math.max(1, larguraMm) : 0 })}
          />
          Grade 1 mm
        </label>
      </div>

      <div className="editor-palco">
        <Reguas larguraMm={larguraMm} alturaMm={alturaMm} />

        <svg
          ref={svgRef}
          className="editor-svg"
          viewBox={`0 0 ${larguraMm} ${alturaMm}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={() => selecionarCampo(null)}
        >
          <rect x={0} y={0} width={larguraMm} height={alturaMm} className="editor-papel" />

          {encaixe.passo > 0 && <Grade larguraMm={larguraMm} alturaMm={alturaMm} />}

          <g className="editor-conteudo">
            <DrawOps ops={ops} />
          </g>

          {modelo.campos.map((campo) => (
            <MolduraCampo
              key={campo.id}
              campo={campo}
              larguraMm={larguraMm}
              alturaMm={alturaMm}
              selecionado={campo.id === campoSelecionado}
              aoPegar={comecar}
            />
          ))}

          {guias.map((g, i) => (
            <line
              key={i}
              className={g.origem === 'centro' ? 'guia centro' : 'guia'}
              x1={g.eixo === 'vertical' ? g.posicao * larguraMm : 0}
              y1={g.eixo === 'vertical' ? 0 : g.posicao * alturaMm}
              x2={g.eixo === 'vertical' ? g.posicao * larguraMm : larguraMm}
              y2={g.eixo === 'vertical' ? alturaMm : g.posicao * alturaMm}
            />
          ))}
        </svg>
      </div>

      <p className="editor-dica">
        {selecionado
          ? `${selecionado.nome} — ${mm(selecionado.x * larguraMm)}, ${mm(selecionado.y * alturaMm)} mm · ${mm(selecionado.w * larguraMm)} × ${mm(selecionado.h * alturaMm)} mm`
          : 'Clique num campo para selecionar. Setas movem 1 mm, Shift+setas 0,1 mm.'}
      </p>
    </div>
  )
}

/** Desloca as bordas conforme a alça puxada. */
function aplicarAlca(inicial: Retangulo, alca: Alca, dx: number, dy: number): Retangulo {
  let { x, y, w, h } = inicial

  if (alca.includes('o')) {
    x = inicial.x + dx
    w = inicial.w - dx
  }
  if (alca.includes('l') || alca.includes('e')) {
    w = inicial.w + dx
  }
  if (alca.includes('n')) {
    y = inicial.y + dy
    h = inicial.h - dy
  }
  if (alca.includes('s')) {
    h = inicial.h + dy
  }

  return { x, y, w, h }
}

function MolduraCampo({
  campo,
  larguraMm,
  alturaMm,
  selecionado,
  aoPegar,
}: {
  campo: Campo
  larguraMm: number
  alturaMm: number
  selecionado: boolean
  aoPegar: (e: React.PointerEvent, campo: Campo, alca: Alca | null) => void
}) {
  const x = campo.x * larguraMm
  const y = campo.y * alturaMm
  const w = campo.w * larguraMm
  const h = campo.h * alturaMm
  const raio = Math.min(larguraMm, alturaMm) * 0.022

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        className={[
          'moldura',
          selecionado && 'selecionada',
          campo.travado && 'travada',
        ]
          .filter(Boolean)
          .join(' ')}
        onPointerDown={(e) => aoPegar(e, campo, null)}
      />

      {selecionado &&
        !campo.travado &&
        ALCAS.map(({ alca, cx, cy, cursor }) => (
          <rect
            key={alca}
            className="alca"
            x={x + cx * w - raio}
            y={y + cy * h - raio}
            width={raio * 2}
            height={raio * 2}
            style={{ cursor }}
            onPointerDown={(e) => aoPegar(e, campo, alca)}
          />
        ))}
    </g>
  )
}

function Grade({ larguraMm, alturaMm }: { larguraMm: number; alturaMm: number }) {
  const verticais = Math.floor(larguraMm)
  const horizontais = Math.floor(alturaMm)

  return (
    <g className="grade-fundo">
      {Array.from({ length: verticais }, (_, i) => (
        <line key={`v${i}`} x1={i + 1} y1={0} x2={i + 1} y2={alturaMm} />
      ))}
      {Array.from({ length: horizontais }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i + 1} x2={larguraMm} y2={i + 1} />
      ))}
    </g>
  )
}

/** Marcas de régua a cada 5 mm, com número a cada 10. */
function Reguas({ larguraMm, alturaMm }: { larguraMm: number; alturaMm: number }) {
  const horizontais = Array.from({ length: Math.floor(larguraMm / 5) + 1 }, (_, i) => i * 5)
  const verticais = Array.from({ length: Math.floor(alturaMm / 5) + 1 }, (_, i) => i * 5)

  return (
    <>
      <div className="regua regua-topo">
        {horizontais.map((v) => (
          <span key={v} style={{ left: `${(v / larguraMm) * 100}%` }} className={v % 10 === 0 ? 'marca forte' : 'marca'}>
            {v % 10 === 0 && <em>{v}</em>}
          </span>
        ))}
      </div>
      <div className="regua regua-lado">
        {verticais.map((v) => (
          <span key={v} style={{ top: `${(v / alturaMm) * 100}%` }} className={v % 10 === 0 ? 'marca forte' : 'marca'}>
            {v % 10 === 0 && <em>{v}</em>}
          </span>
        ))}
      </div>
    </>
  )
}
