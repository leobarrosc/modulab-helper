import { hexDaCor } from '@/core/estante'
import type { ItemReposicao, TemplateEstante } from '@/core/estante'
import Icone from './Icone'

/**
 * O payoff: o que pegar no deposito.
 *
 * Sai na ordem de leitura da estante, que e a ordem em que se caminha na frente
 * dela. O estoque aparece do lado porque a pergunta seguinte a "o que falta?" e
 * sempre "tem no deposito?".
 */
export default function ListaReposicao({
  itens,
  estante,
  arquivo,
}: {
  itens: ItemReposicao[]
  estante: TemplateEstante
  arquivo: string | null
}) {
  if (itens.length === 0) {
    return (
      <p className="dica">
        <Icone nome="check" tamanho={14} /> Nada a repor — todas as células conferidas estão
        cheias.
      </p>
    )
  }

  const totalRolos = itens.reduce((s, i) => s + i.faltam, 0)
  const semEstoque = itens.filter((i) => i.estoqueDeposito === 0)

  return (
    <div className="reposicao">
      <div className="reposicao-cabeca">
        <p>
          <strong>{totalRolos} rolo(s)</strong> para repor em {itens.length} posição(ões).
        </p>
        <button type="button" className="secundario" onClick={() => window.print()}>
          <Icone nome="imprimir" tamanho={14} /> Imprimir a lista
        </button>
      </div>

      {semEstoque.length > 0 && (
        <p className="aviso">
          {semEstoque.length} produto(s) sem estoque no depósito: não dá para repor agora.
        </p>
      )}

      <div className="reposicao-titulo-impressao" aria-hidden="true">
        Reposição — {estante.nome}
        {arquivo ? ` · ${arquivo}` : ''}
      </div>

      <table className="reposicao-tabela">
        <thead>
          <tr>
            <th>Posição</th>
            <th>Código</th>
            <th>Tipo</th>
            <th>Cor</th>
            <th className="num">Faltam</th>
            <th className="num">No depósito</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => {
            const hex = hexDaCor(item.classificacao.cor)
            return (
              <tr
                key={item.codigo}
                className={item.estoqueDeposito === 0 ? 'sem-estoque' : undefined}
              >
                <td className="mono">
                  {item.andar}.{item.coluna}
                </td>
                <td className="mono">{item.codigo}</td>
                <td>{item.classificacao.tipo || 'Sem tipo'}</td>
                <td>
                  <span className="celula-cabeca">
                    <span
                      className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
                      style={hex ? { background: hex } : undefined}
                      aria-hidden="true"
                    />
                    {item.classificacao.cor || 'Sem cor'}
                  </span>
                </td>
                <td className="num">{item.faltam}</td>
                <td className="num">
                  {item.estoqueDeposito === 0 ? <strong>0</strong> : item.estoqueDeposito}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
