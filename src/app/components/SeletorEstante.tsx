import Icone from './Icone'
import { useApp } from '../store'

/**
 * Troca de estante rapida, no topo da aba.
 *
 * Fica fora do passo de cadastro de proposito: trocar de estante e uma acao do
 * dia a dia -- conferir a vitrine, depois a do fundo -- e nao pode exigir abrir
 * um formulario antes.
 */
export default function SeletorEstante() {
  const { estantes, estanteAtivaId, selecionarEstante, novaEstante } = useApp()

  if (estantes.length === 0) return null

  const ativa = estantes.find((e) => e.id === estanteAtivaId) ?? estantes[0]!

  return (
    <div className="seletor-estante">
      <Icone nome="estante" tamanho={16} />

      {estantes.length <= 4 ? (
        <div className="estante-pilulas" role="tablist" aria-label="Estantes">
          {estantes.map((e) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={e.id === ativa.id}
              className={e.id === ativa.id ? 'pilula ativa' : 'pilula'}
              onClick={() => selecionarEstante(e.id)}
            >
              {e.nome}
            </button>
          ))}
        </div>
      ) : (
        <select
          aria-label="Estante"
          value={ativa.id}
          onChange={(e) => selecionarEstante(e.target.value)}
        >
          {estantes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      )}

      <button type="button" className="secundario" title="Criar outra estante" onClick={novaEstante}>
        + Estante
      </button>
    </div>
  )
}
