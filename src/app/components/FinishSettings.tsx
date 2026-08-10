import type { EstiloCorte } from '@/core/layout'
import Icone from './Icone'
import { useApp } from '../store'

const ESTILOS: { id: EstiloCorte; nome: string; ajuda: string }[] = [
  { id: 'nenhum', nome: 'Sem guia', ajuda: 'Só as etiquetas.' },
  {
    id: 'linhas',
    nome: 'Linhas',
    ajuda: 'Riscos atravessando a folha — corte de uma passada com régua.',
  },
  {
    id: 'marcas',
    nome: 'Marcas',
    ajuda: 'Só ticks nas bordas do papel, sem riscar a área impressa.',
  },
]

export default function FinishSettings() {
  const { modelo, corte, setBorda, setCorte } = useApp()
  const borda = modelo.borda ?? { mostrar: false, espessuraMm: 0.2, cinza: 0 }

  return (
    <>
      <div className="grupo">
        <h3>
          <Icone nome="etiqueta" tamanho={14} /> Borda da etiqueta
        </h3>

        <label className="checa">
          <input
            type="checkbox"
            checked={borda.mostrar}
            onChange={(e) => setBorda({ mostrar: e.target.checked })}
          />
          Desenhar contorno em cada etiqueta
        </label>

        {borda.mostrar && (
          <div className="linha-campos" style={{ marginTop: '0.6rem' }}>
            <label className="campo">
              <span className="campo-rotulo">Espessura (mm)</span>
              <input
                type="number"
                min={0.05}
                max={2}
                step={0.05}
                value={borda.espessuraMm}
                onChange={(e) => setBorda({ espessuraMm: Number(e.target.value) })}
              />
            </label>
            <label className="campo">
              <span className="campo-rotulo">
                Cinza — {Math.round(borda.cinza * 100)}% mais claro
              </span>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                value={borda.cinza}
                onChange={(e) => setBorda({ cinza: Number(e.target.value) })}
              />
            </label>
          </div>
        )}
      </div>

      <div className="grupo">
        <h3>
          <Icone nome="tesoura" tamanho={14} /> Guia de corte
        </h3>

        <div className="modos modos-tres">
          {ESTILOS.map((e) => (
            <button
              key={e.id}
              type="button"
              className={corte.estilo === e.id ? 'modo ativo' : 'modo'}
              onClick={() => setCorte({ estilo: e.id })}
            >
              <span className="modo-nome">{e.nome}</span>
              <span className="modo-ajuda">{e.ajuda}</span>
            </button>
          ))}
        </div>

        {corte.estilo !== 'nenhum' && (
          <>
            <div className="linha-campos">
              <label className="campo">
                <span className="campo-rotulo">Espessura (mm)</span>
                <input
                  type="number"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={corte.espessuraMm}
                  onChange={(e) => setCorte({ espessuraMm: Number(e.target.value) })}
                />
              </label>
              {corte.estilo === 'marcas' && (
                <label className="campo">
                  <span className="campo-rotulo">Tamanho do tick (mm)</span>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    step={0.5}
                    value={corte.marcaMm}
                    onChange={(e) => setCorte({ marcaMm: Number(e.target.value) })}
                  />
                </label>
              )}
            </div>
            <label className="campo campo-largo">
              <span className="campo-rotulo">
                Cinza — {Math.round(corte.cinza * 100)}% mais claro
              </span>
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.05}
                value={corte.cinza}
                onChange={(e) => setCorte({ cinza: Number(e.target.value) })}
              />
              <span className="campo-ajuda">
                Um cinza claro ainda se enxerga para cortar e some no resultado.
              </span>
            </label>
          </>
        )}
      </div>
    </>
  )
}
