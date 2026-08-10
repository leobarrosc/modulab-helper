import { FONTES_CODIGO, type FonteCodigo } from '@/core/produtos'
import { useApp } from '../store'

const AJUDA: Record<FonteCodigo, string> = {
  'GTIN/EAN': 'Padrão de mercado. Costuma faltar em boa parte dos produtos do Bling.',
  'Código': 'Código interno do Bling. Quase sempre preenchido.',
}

/**
 * Escolhe de qual coluna sai o valor do código de barras.
 * Aparece antes da importação e continua disponível depois, junto dos filtros.
 */
export default function SeletorFonte({
  disponiveis = FONTES_CODIGO,
}: {
  disponiveis?: readonly FonteCodigo[]
}) {
  const fonteCodigo = useApp((s) => s.fonteCodigo)
  const setFonteCodigo = useApp((s) => s.setFonteCodigo)

  if (disponiveis.length < 2) return null

  return (
    <div className="fonte">
      <span className="fonte-rotulo">Código de barras a partir de:</span>
      <div className="fonte-opcoes" role="radiogroup" aria-label="Coluna do código de barras">
        {disponiveis.map((f) => (
          <label key={f} className={f === fonteCodigo ? 'fonte-opcao ativa' : 'fonte-opcao'}>
            <input
              type="radio"
              name="fonte-codigo"
              value={f}
              checked={f === fonteCodigo}
              onChange={() => setFonteCodigo(f)}
            />
            <span className="fonte-nome">{f}</span>
            <span className="fonte-ajuda">{AJUDA[f]}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
