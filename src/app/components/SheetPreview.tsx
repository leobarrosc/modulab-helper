import { mm } from '@/core/layout'
import type { Folhas } from '@/core/render/folha'
import DrawOps from './DrawOps'
import Icone from './Icone'
import { useApp } from '../store'

/**
 * Previa da folha.
 *
 * Desenha exatamente as `DrawOp[]` que vao para o PDF -- inclusive os riscos
 * de corte. Nao ha nenhum calculo de posicao aqui: se a previa e o papel
 * divergirem, o defeito esta no backend, nunca no layout.
 */
export default function SheetPreview({ folhas }: { folhas: Folhas }) {
  const { paginaAtual, setPaginaAtual } = useApp()

  const total = folhas.paginas.length
  const indice = Math.min(paginaAtual, Math.max(0, total - 1))
  const pagina = folhas.paginas[indice]

  return (
    <div className="folha">
      <div className="folha-topo">
        <h3>
          <Icone nome="folha" tamanho={14} /> Prévia da folha
        </h3>
        {total > 1 && (
          <div className="paginacao">
            <button
              type="button"
              className="secundario"
              disabled={indice === 0}
              onClick={() => setPaginaAtual(indice - 1)}
              aria-label="Folha anterior"
            >
              ‹
            </button>
            <span className="paginacao-texto">
              {indice + 1} / {total}
            </span>
            <button
              type="button"
              className="secundario"
              disabled={indice >= total - 1}
              onClick={() => setPaginaAtual(indice + 1)}
              aria-label="Próxima folha"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="folha-palco">
        {pagina ? (
          <svg
            className="folha-svg"
            viewBox={`0 0 ${pagina.larguraMm} ${pagina.alturaMm}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Folha ${indice + 1} de ${total}`}
          >
            <rect
              x={0}
              y={0}
              width={pagina.larguraMm}
              height={pagina.alturaMm}
              className="svg-papel"
            />
            <DrawOps ops={pagina.ops} />
          </svg>
        ) : (
          <p className="folha-vazia">
            Nenhuma etiqueta para mostrar. Escolha produtos ou ajuste a grade.
          </p>
        )}
      </div>

      <p className="folha-legenda">
        {pagina && (
          <>
            {mm(pagina.larguraMm)} × {mm(pagina.alturaMm)} mm ·{' '}
          </>
        )}
        {folhas.totalEtiquetas} {folhas.totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'} em {total}{' '}
        {total === 1 ? 'folha' : 'folhas'}
      </p>
    </div>
  )
}
