import { useMemo, useState } from 'react'
import { hexDaCor, type ProdutoEstante } from '@/core/estante'
import Icone from './Icone'
import { useApp } from '../store'

/**
 * Onde se conserta o que a derivacao errou.
 *
 * A categoria do Bling responde a uma pergunta comercial: "PLA Especiais" junta
 * marmorizado e madeira porque vendem parecido, nao porque moram lado a lado na
 * prateleira. Aqui o usuario reescreve tipo e cor, e a correcao fica salva pelo
 * Código -- sobrevive ao proximo export.
 */
export default function ClassificacaoCorrecao({ produtos }: { produtos: ProdutoEstante[] }) {
  const {
    correcoesClassificacao,
    corrigirClassificacao,
    limparCorrecao,
    palavrasIgnoradas,
    setPalavrasIgnoradas,
  } = useApp()
  const [busca, setBusca] = useState('')
  const [soCorrigidos, setSoCorrigidos] = useState(false)
  // Rascunho enquanto se digita: aplicar a cada tecla reclassificaria o
  // catalogo inteiro no meio de uma palavra.
  const [rascunho, setRascunho] = useState<string | null>(null)

  const visiveis = useMemo(() => {
    const alvo = busca.trim().toLowerCase()
    return produtos.filter((p) => {
      if (soCorrigidos && !correcoesClassificacao[p.codigo]) return false
      if (!alvo) return true
      const { marca, tipo, cor } = p.classificacao
      return `${p.codigo} ${p.descricao} ${marca} ${tipo} ${cor}`.toLowerCase().includes(alvo)
    })
  }, [produtos, busca, soCorrigidos, correcoesClassificacao])

  const totalCorrigidos = produtos.filter((p) => correcoesClassificacao[p.codigo]).length

  if (produtos.length === 0) {
    return (
      <div className="correcao">
        <h3>Marca, tipo e cor</h3>
        <p className="dica">Nenhum produto entra nesta estante com a categoria escolhida.</p>
      </div>
    )
  }

  return (
    <div className="correcao">
      <h3>Marca, tipo e cor</h3>
      <p className="dica">
        Deduzidos da categoria e da descrição do Bling. Edite o que saiu errado — a correção fica
        salva pelo código do produto.
      </p>

      <details className="ignoradas">
        <summary>Palavras ignoradas na cor ({palavrasIgnoradas.length} suas)</summary>
        <p className="dica">
          Cada marca cerca a cor com o nome da linha e da embalagem. O app já descarta{' '}
          <code>Basic</code>, <code>Ht</code>, <code>Lite</code>, <code>Hyper</code>,{' '}
          <code>Peso:1KG</code>, <code>ROLO</code> e afins. Acrescente as suas, separadas por
          vírgula — uma palavra que também é nome de cor nunca é descartada.
        </p>
        <input
          type="text"
          value={rascunho ?? palavrasIgnoradas.join(', ')}
          placeholder="ex.: velvet, matte, edition"
          onChange={(e) => setRascunho(e.target.value)}
          onBlur={() => {
            if (rascunho !== null) setPalavrasIgnoradas(rascunho.split(','))
            setRascunho(null)
          }}
        />
      </details>

      <div className="correcao-filtros">
        <input
          type="search"
          placeholder="Buscar produto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <label className="checa">
          <input
            type="checkbox"
            checked={soCorrigidos}
            onChange={(e) => setSoCorrigidos(e.target.checked)}
          />
          <span>Só os corrigidos ({totalCorrigidos})</span>
        </label>
      </div>

      <div className="correcao-rolagem">
        <table className="correcao-tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Descrição</th>
              <th>Marca</th>
              <th>Tipo</th>
              <th>Cor</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visiveis.map((p) => {
              const corrigido = !!correcoesClassificacao[p.codigo]
              const hex = hexDaCor(p.classificacao.cor)
              return (
                <tr key={p.codigo} className={corrigido ? 'corrigido' : undefined}>
                  <td className="mono">{p.codigo}</td>
                  <td className="correcao-descricao" title={p.descricao}>
                    {p.descricao}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.classificacao.marca}
                      maxLength={80}
                      onChange={(e) =>
                        corrigirClassificacao(p.codigo, { marca: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={p.classificacao.tipo}
                      maxLength={80}
                      onChange={(e) => corrigirClassificacao(p.codigo, { tipo: e.target.value })}
                    />
                  </td>
                  <td>
                    <span className="correcao-cor">
                      <span
                        className={hex ? 'bolinha-cor' : 'bolinha-cor sem-cor'}
                        style={hex ? { background: hex } : undefined}
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        value={p.classificacao.cor}
                        maxLength={80}
                        onChange={(e) => corrigirClassificacao(p.codigo, { cor: e.target.value })}
                      />
                    </span>
                  </td>
                  <td>
                    {corrigido && (
                      <button
                        type="button"
                        className="secundario"
                        title="Voltar ao valor deduzido do Bling"
                        aria-label={`Desfazer correção de ${p.codigo}`}
                        onClick={() => limparCorrecao(p.codigo)}
                      >
                        <Icone nome="desfazer" tamanho={13} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {visiveis.length === 0 && <p className="dica">Nenhum produto com esse filtro.</p>}
    </div>
  )
}
