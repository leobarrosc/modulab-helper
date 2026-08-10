import { mm, PRESETS, type Margens, type ResultadoGrade } from '@/core/layout'
import { useApp } from '../store'

function CampoMm({
  rotulo,
  valor,
  onChange,
  passo = 0.5,
  min = 0,
}: {
  rotulo: string
  valor: number
  onChange: (v: number) => void
  passo?: number
  min?: number
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">{rotulo}</span>
      <input
        type="number"
        value={valor}
        min={min}
        step={passo}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}

const LADOS_MARGEM: { chave: keyof Margens; rotulo: string }[] = [
  { chave: 'topo', rotulo: 'Topo' },
  { chave: 'direita', rotulo: 'Direita' },
  { chave: 'base', rotulo: 'Base' },
  { chave: 'esquerda', rotulo: 'Esquerda' },
]

export default function PageSettings({ resultado }: { resultado: ResultadoGrade }) {
  const {
    pagina,
    grade,
    pularCelulas,
    setPreset,
    setOrientacao,
    setPaginaMm,
    setGrade,
    setModoGrade,
    setMargem,
    setPularCelulas,
  } = useApp()

  const temSobra =
    resultado.valida && (resultado.sobra.larguraMm > 0.05 || resultado.sobra.alturaMm > 0.05)

  return (
    <>
      <div className="grupo">
        <h3>Página</h3>

        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === pagina.preset ? 'preset ativo' : 'preset'}
              onClick={() => setPreset(p.id)}
            >
              <span className="preset-nome">{p.nome}</span>
              <span className="preset-medida">
                {mm(p.larguraMm)} × {mm(p.alturaMm)} mm
              </span>
            </button>
          ))}
          <button
            type="button"
            className={pagina.preset === 'personalizado' ? 'preset ativo' : 'preset'}
            onClick={() => setPreset('personalizado')}
          >
            <span className="preset-nome">Personalizado</span>
            <span className="preset-medida">medidas livres</span>
          </button>
        </div>

        <div className="linha-campos">
          <CampoMm
            rotulo="Largura (mm)"
            valor={pagina.larguraMm}
            min={10}
            onChange={(v) => setPaginaMm('larguraMm', v)}
          />
          <CampoMm
            rotulo="Altura (mm)"
            valor={pagina.alturaMm}
            min={10}
            onChange={(v) => setPaginaMm('alturaMm', v)}
          />
          <label className="campo">
            <span className="campo-rotulo">Orientação</span>
            <select
              value={pagina.orientacao}
              onChange={(e) => setOrientacao(e.target.value as 'retrato' | 'paisagem')}
            >
              <option value="retrato">Retrato</option>
              <option value="paisagem">Paisagem</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grupo">
        <h3>O que você define</h3>

        <div className="modos">
          <button
            type="button"
            className={grade.modo === 'porGrade' ? 'modo ativo' : 'modo'}
            onClick={() => setModoGrade('porGrade')}
          >
            <span className="modo-nome">Colunas × linhas</span>
            <span className="modo-ajuda">A etiqueta preenche a página inteira.</span>
          </button>
          <button
            type="button"
            className={grade.modo === 'porEtiqueta' ? 'modo ativo' : 'modo'}
            onClick={() => setModoGrade('porEtiqueta')}
          >
            <span className="modo-nome">Tamanho da etiqueta</span>
            <span className="modo-ajuda">Cabe quantas couber; pode sobrar espaço.</span>
          </button>
        </div>

        <div className="linha-campos">
          {grade.modo === 'porGrade' ? (
            <>
              <label className="campo">
                <span className="campo-rotulo">Colunas</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={grade.colunas}
                  onChange={(e) => setGrade({ colunas: Number(e.target.value) })}
                />
              </label>
              <label className="campo">
                <span className="campo-rotulo">Linhas</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={grade.linhas}
                  onChange={(e) => setGrade({ linhas: Number(e.target.value) })}
                />
              </label>
            </>
          ) : (
            <>
              <CampoMm
                rotulo="Etiqueta ↔ (mm)"
                valor={grade.etiquetaLarguraMm}
                min={1}
                onChange={(v) => setGrade({ etiquetaLarguraMm: v })}
              />
              <CampoMm
                rotulo="Etiqueta ↕ (mm)"
                valor={grade.etiquetaAlturaMm}
                min={1}
                onChange={(v) => setGrade({ etiquetaAlturaMm: v })}
              />
            </>
          )}
          <CampoMm
            rotulo="Espaço ↔ (mm)"
            valor={grade.espacoXMm}
            onChange={(v) => setGrade({ espacoXMm: v })}
          />
          <CampoMm
            rotulo="Espaço ↕ (mm)"
            valor={grade.espacoYMm}
            onChange={(v) => setGrade({ espacoYMm: v })}
          />
        </div>
      </div>

      <div className="grupo">
        <h3>Margens (mm)</h3>
        <div className="linha-campos">
          {LADOS_MARGEM.map(({ chave, rotulo }) => (
            <CampoMm
              key={chave}
              rotulo={rotulo}
              valor={grade.margens[chave]}
              onChange={(v) => setMargem(chave, v)}
            />
          ))}
        </div>
      </div>

      <div className="grupo">
        <h3>Aproveitamento</h3>
        <label className="campo campo-largo">
          <span className="campo-rotulo">Pular células no início</span>
          <input
            type="number"
            min={0}
            max={Math.max(0, resultado.porPagina - 1)}
            value={pularCelulas}
            onChange={(e) => setPularCelulas(Number(e.target.value))}
          />
          <span className="campo-ajuda">
            Para reaproveitar uma folha adesiva já parcialmente usada.
          </span>
        </label>
      </div>

      <div className={resultado.valida ? 'derivado' : 'derivado invalido'}>
        {grade.modo === 'porGrade' ? (
          <>
            <span className="derivado-rotulo">Tamanho da etiqueta</span>
            <strong className="derivado-valor">
              {mm(resultado.etiqueta.larguraMm)} × {mm(resultado.etiqueta.alturaMm)} mm
            </strong>
          </>
        ) : (
          <>
            <span className="derivado-rotulo">Grade</span>
            <strong className="derivado-valor">
              {resultado.colunas} × {resultado.linhas}
            </strong>
          </>
        )}
        <span className="derivado-nota">
          calculado — {resultado.porPagina} por página
        </span>
        {temSobra && (
          <span className="derivado-sobra">
            sobra {mm(resultado.sobra.larguraMm)} mm à direita e{' '}
            {mm(resultado.sobra.alturaMm)} mm embaixo
          </span>
        )}
      </div>

      {resultado.erros.map((e) => (
        <p key={e} className="erro-grade">
          {e}
        </p>
      ))}
    </>
  )
}
