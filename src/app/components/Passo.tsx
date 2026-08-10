import { useId, type ReactNode } from 'react'
import Icone, { type NomeIcone } from './Icone'

/**
 * Uma etapa do fluxo, recolhível.
 *
 * O passo concluído vira uma barra fina com o resumo do que foi decidido --
 * fica fora do caminho, mas continua a um clique de distância.
 */
export default function Passo({
  numero,
  icone,
  titulo,
  resumo,
  concluido = false,
  aberto,
  aoAlternar,
  acoes,
  children,
}: {
  numero: number
  icone: NomeIcone
  titulo: string
  /** Mostrado quando recolhido: o que já foi decidido aqui. */
  resumo?: ReactNode
  concluido?: boolean
  aberto: boolean
  aoAlternar: () => void
  /** Botões à direita do cabeçalho, fora do alvo de clique. */
  acoes?: ReactNode
  children: ReactNode
}) {
  const idConteudo = useId()

  return (
    <section className={['passo', aberto && 'aberto', concluido && 'concluido'].filter(Boolean).join(' ')}>
      <div className="passo-cabecalho">
        <button
          type="button"
          className="passo-toque"
          aria-expanded={aberto}
          aria-controls={idConteudo}
          onClick={aoAlternar}
        >
          <span className="passo-numero" aria-hidden="true">
            {concluido ? <Icone nome="check" tamanho={14} /> : numero}
          </span>
          <Icone nome={icone} className="passo-icone" tamanho={18} />
          <span className="passo-textos">
            <strong>{titulo}</strong>
            {resumo && !aberto && <span className="passo-resumo">{resumo}</span>}
          </span>
          <Icone nome="seta" className="passo-chevron" tamanho={16} />
        </button>
        {acoes && <div className="passo-acoes">{acoes}</div>}
      </div>

      {aberto && (
        <div className="passo-conteudo" id={idConteudo}>
          {children}
        </div>
      )}
    </section>
  )
}
