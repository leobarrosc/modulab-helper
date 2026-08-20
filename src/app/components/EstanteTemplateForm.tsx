import { useMemo } from 'react'
import {
  capacidadeTotal,
  LIMITES_ESTANTE,
  marcasDaRaiz,
  raizesCategoria,
  totalCelulas,
} from '@/core/estante'
import Icone from './Icone'
import { useApp } from '../store'

/** Campo numerico com limite, no formato dos demais ajustes do app. */
function Numero({
  rotulo,
  valor,
  min,
  max,
  aoMudar,
}: {
  rotulo: string
  valor: number
  min: number
  max: number
  aoMudar: (n: number) => void
}) {
  return (
    <label className="campo">
      <span>{rotulo}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={1}
        value={valor}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) aoMudar(Math.min(max, Math.max(min, Math.trunc(n))))
        }}
      />
    </label>
  )
}

/** Cadastro das estantes: quantos andares, quantas colunas, o que entra. */
export default function EstanteTemplateForm() {
  const {
    planilha,
    estantes,
    estanteAtivaId,
    novaEstante,
    atualizarEstante,
    excluirEstante,
    selecionarEstante,
    alternarMarcaPermitida,
    alternarAndarBloqueado,
  } = useApp()

  const estante = estantes.find((e) => e.id === estanteAtivaId) ?? estantes[0] ?? null
  const raiz = estante?.raizCategoria ?? ''

  const raizes = useMemo(() => (planilha ? raizesCategoria(planilha) : []), [planilha])
  const marcas = useMemo(() => (planilha ? marcasDaRaiz(planilha, raiz) : []), [planilha, raiz])

  if (!estante) {
    return (
      <div className="estante-form">
        <p className="dica">Nenhuma estante cadastrada.</p>
        <button type="button" onClick={novaEstante}>
          Criar estante
        </button>
      </div>
    )
  }

  const celulas = totalCelulas(estante)
  const rolos = capacidadeTotal(estante)
  const raizAusente = estante.raizCategoria.trim() === ''
  const raizSemProdutos =
    !raizAusente && raizes.length > 0 && !raizes.includes(estante.raizCategoria)

  return (
    <div className="estante-form">
      {estantes.length > 1 && (
        <label className="campo">
          <span>Estante</span>
          <select value={estante.id} onChange={(e) => selecionarEstante(e.target.value)}>
            {estantes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="estante-campos">
        <label className="campo campo-largo">
          <span>Nome</span>
          <input
            type="text"
            value={estante.nome}
            maxLength={80}
            onChange={(e) => atualizarEstante(estante.id, { nome: e.target.value })}
          />
        </label>

        <Numero
          rotulo="Andares"
          valor={estante.andares}
          min={LIMITES_ESTANTE.andares.min}
          max={LIMITES_ESTANTE.andares.max}
          aoMudar={(andares) => atualizarEstante(estante.id, { andares })}
        />
        <Numero
          rotulo="Colunas"
          valor={estante.colunas}
          min={LIMITES_ESTANTE.colunas.min}
          max={LIMITES_ESTANTE.colunas.max}
          aoMudar={(colunas) => atualizarEstante(estante.id, { colunas })}
        />
        <Numero
          rotulo="Por célula"
          valor={estante.capacidadePorCelula}
          min={LIMITES_ESTANTE.capacidadePorCelula.min}
          max={LIMITES_ESTANTE.capacidadePorCelula.max}
          aoMudar={(capacidadePorCelula) =>
            atualizarEstante(estante.id, { capacidadePorCelula })
          }
        />

        <label className="campo campo-largo">
          <span>Categoria que entra</span>
          <input
            type="text"
            list="raizes-categoria"
            value={estante.raizCategoria}
            maxLength={200}
            placeholder="Filamentos"
            onChange={(e) => atualizarEstante(estante.id, { raizCategoria: e.target.value })}
          />
          <datalist id="raizes-categoria">
            {raizes.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>
      </div>

      <p className="dica">
        {celulas} células · {rolos} rolos no total. Entram os produtos <strong>Ativos</strong> em{' '}
        <strong>{estante.raizCategoria || '—'}</strong> com pelo menos 1 em estoque.
      </p>

      {raizAusente && (
        <p className="aviso">
          Sem categoria preenchida nenhum produto entra na estante. Use{' '}
          {raizes.length > 0 ? <strong>{raizes[0]}</strong> : 'a categoria do Bling'}.
        </p>
      )}

      {raizSemProdutos && (
        <p className="aviso">
          Nenhum produto do arquivo está em <strong>{estante.raizCategoria}</strong>. As categorias
          deste CSV são: {raizes.join(', ')}.
        </p>
      )}

      {estante.capacidadePorCelula !== 2 && (
        <p className="dica">
          Com {estante.capacidadePorCelula} por célula, a conferência mostra “Posição 1…
          {estante.capacidadePorCelula}” no lugar de “Frente” e “Trás”.
        </p>
      )}

      <p className="dica">
        Toda célula nasce com 1 coluna. O + no mapa multiplica, mas só enquanto o depósito
        tiver estoque para encher a coluna seguinte por inteiro — sem estoque suficiente, o
        botão fica desabilitado.
      </p>

      <div className="estante-listas">
        <fieldset className="grupo-caixas">
          <legend>Marcas desta estante</legend>
          <p className="dica">
            Nenhuma marcada = todas entram. Marque para dividir as marcas entre duas estantes.
          </p>
          {marcas.length === 0 ? (
            <p className="dica">Nenhuma marca na categoria escolhida.</p>
          ) : (
            <div className="caixas">
              {marcas.map((marca) => (
                <label key={marca} className="checa">
                  <input
                    type="checkbox"
                    checked={estante.marcasPermitidas.includes(marca)}
                    onChange={() => alternarMarcaPermitida(estante.id, marca)}
                  />
                  <span>{marca || 'Sem marca'}</span>
                </label>
              ))}
            </div>
          )}
          {estante.marcasPermitidas.length > 0 && (
            <p className="dica">
              {estante.marcasPermitidas.length} de {marcas.length} marcas nesta estante.
            </p>
          )}
        </fieldset>

        <fieldset className="grupo-caixas">
          <legend>Andares em uso</legend>
          <p className="dica">
            Desmarque o andar que não recebe filamento — a prateleira que você não alcança, ou a
            de baixo que é só caixa fechada.
          </p>
          <div className="caixas">
            {Array.from({ length: estante.andares }, (_, i) => i + 1).map((andar) => (
              <label key={andar} className="checa">
                <input
                  type="checkbox"
                  checked={!estante.andaresBloqueados.includes(andar)}
                  onChange={() => alternarAndarBloqueado(estante.id, andar)}
                />
                <span>Andar {andar}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {estante.andaresBloqueados.length >= estante.andares && (
        <p className="aviso">Todos os andares estão fora de uso: nada será alocado.</p>
      )}

      <div className="estante-acoes">
        <button type="button" className="secundario" onClick={novaEstante}>
          Nova estante
        </button>
        {estantes.length > 1 && (
          <button
            type="button"
            className="secundario perigo"
            onClick={() => excluirEstante(estante.id)}
          >
            <Icone nome="lixeira" tamanho={14} /> Excluir “{estante.nome}”
          </button>
        )}
      </div>
    </div>
  )
}
