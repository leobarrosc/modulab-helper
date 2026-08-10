import type { Planilha } from '@/core/csv'
import { NOMES_FORMATADORES } from '@/core/etiqueta/resolver'
import { TEXTO_MINIMO_MM } from '@/core/etiqueta/render'
import type { Campo, TipoCampo } from '@/core/etiqueta/tipos'
import { SIMBOLOGIAS, acharSimbologia } from '@/core/simbologia/registro'
import ModelManager from './ModelManager'
import { useApp } from '../store'

const ICONE: Record<TipoCampo, string> = {
  texto: 'T',
  codigo: '▊',
  linha: '—',
  caixa: '▢',
}

const ROTULO_TIPO: Record<TipoCampo, string> = {
  texto: 'Texto',
  codigo: 'Código',
  linha: 'Linha',
  caixa: 'Caixa',
}

export default function FieldInspector({
  planilha,
  larguraMm,
  alturaMm,
}: {
  planilha: Planilha
  larguraMm: number
  alturaMm: number
}) {
  const {
    modelo,
    campoSelecionado,
    selecionarCampo,
    adicionar,
    editarCampo,
    removerSelecionado,
    duplicarSelecionado,
    reordenar,
    desfazer,
    refazer,
    historico,
  } = useApp()

  const campo = modelo.campos.find((c) => c.id === campoSelecionado) ?? null

  return (
    <div className="inspetor">
      <div className="inspetor-acoes">
        {(['texto', 'codigo', 'linha', 'caixa'] as TipoCampo[]).map((t) => (
          <button key={t} type="button" className="secundario" onClick={() => adicionar(t)}>
            + {ROTULO_TIPO[t]}
          </button>
        ))}
      </div>

      <div className="inspetor-historico">
        <button
          type="button"
          className="secundario"
          disabled={historico.passado.length === 0}
          onClick={desfazer}
          title="Ctrl+Z"
        >
          ↶ Desfazer
        </button>
        <button
          type="button"
          className="secundario"
          disabled={historico.futuro.length === 0}
          onClick={refazer}
          title="Ctrl+Shift+Z"
        >
          ↷ Refazer
        </button>
      </div>

      <div className="grupo">
        <h3>Camadas</h3>
        <ul className="camadas">
          {[...modelo.campos].reverse().map((c) => (
            <li key={c.id} className={c.id === campoSelecionado ? 'camada ativa' : 'camada'}>
              <button type="button" className="camada-nome" onClick={() => selecionarCampo(c.id)}>
                <span className="camada-icone" aria-hidden="true">
                  {ICONE[c.tipo]}
                </span>
                <span className="camada-texto">
                  <strong>{c.nome}</strong>
                  <em>{c.template || ROTULO_TIPO[c.tipo]}</em>
                </span>
              </button>
              <span className="camada-botoes">
                <button type="button" title="Para cima" onClick={() => reordenar(c.id, 1)}>
                  ↑
                </button>
                <button type="button" title="Para baixo" onClick={() => reordenar(c.id, -1)}>
                  ↓
                </button>
                <button
                  type="button"
                  title={c.travado ? 'Destravar' : 'Travar'}
                  onClick={() => editarCampo(c.id, { travado: !c.travado })}
                >
                  {c.travado ? '🔒' : '🔓'}
                </button>
              </span>
            </li>
          ))}
        </ul>
        {modelo.campos.length === 0 && <p className="vazio-pequeno">Nenhum campo ainda.</p>}
      </div>

      <ModelManager />

      {campo ? (
        <Propriedades
          campo={campo}
          planilha={planilha}
          larguraMm={larguraMm}
          alturaMm={alturaMm}
          editar={(m) => editarCampo(campo.id, m)}
          remover={removerSelecionado}
          duplicar={duplicarSelecionado}
        />
      ) : (
        <p className="vazio-pequeno">Selecione um campo para editar.</p>
      )}
    </div>
  )
}

function Propriedades({
  campo,
  planilha,
  larguraMm,
  alturaMm,
  editar,
  remover,
  duplicar,
}: {
  campo: Campo
  planilha: Planilha
  larguraMm: number
  alturaMm: number
  editar: (m: Partial<Campo>) => void
  remover: () => void
  duplicar: () => void
}) {
  const simbologia = acharSimbologia(campo.simbologia ?? '')
  const listaColunas = `colunas-${campo.id}`

  return (
    <div className="grupo">
      <h3>Propriedades</h3>

      <label className="campo campo-largo">
        <span className="campo-rotulo">Nome</span>
        <input value={campo.nome} onChange={(e) => editar({ nome: e.target.value })} />
      </label>

      {campo.tipo !== 'linha' && campo.tipo !== 'caixa' && (
        <label className="campo campo-largo">
          <span className="campo-rotulo">Conteúdo</span>
          <input
            value={campo.template}
            list={listaColunas}
            spellCheck={false}
            onChange={(e) => editar({ template: e.target.value })}
          />
          <datalist id={listaColunas}>
            {planilha.colunas.map((c) => (
              <option key={c} value={`{${c}}`} />
            ))}
          </datalist>
          <span className="campo-ajuda">
            Chaves para colunas. Formatadores: {NOMES_FORMATADORES.join(', ')}. Use{' '}
            <code>{'{A ?? B}'}</code> para alternativa.
          </span>
        </label>
      )}

      <div className="linha-campos">
        <NumeroMm rotulo="X" valor={campo.x * larguraMm} total={larguraMm} onChange={(f) => editar({ x: f })} />
        <NumeroMm rotulo="Y" valor={campo.y * alturaMm} total={alturaMm} onChange={(f) => editar({ y: f })} />
        <NumeroMm rotulo="Largura" valor={campo.w * larguraMm} total={larguraMm} onChange={(f) => editar({ w: f })} />
        <NumeroMm rotulo="Altura" valor={campo.h * alturaMm} total={alturaMm} onChange={(f) => editar({ h: f })} />
      </div>

      {campo.tipo === 'texto' && (
        <>
          <div className="linha-campos">
            <label className="campo">
              <span className="campo-rotulo">Fonte</span>
              <select
                value={campo.fonte?.familia ?? 'Helvetica'}
                onChange={(e) =>
                  editar({
                    fonte: { ...campo.fonte!, familia: e.target.value as 'Helvetica' },
                  })
                }
              >
                <option value="Helvetica">Helvetica</option>
                <option value="Times">Times</option>
                <option value="Courier">Courier</option>
              </select>
            </label>
            <TamanhoRelativo
              rotulo="Tamanho"
              pct={campo.fonte?.tamanhoPct ?? 0.09}
              alturaMm={alturaMm}
              onChange={(tamanhoPct) => editar({ fonte: { ...campo.fonte!, tamanhoPct } })}
            />
            <label className="campo">
              <span className="campo-rotulo">Alinhamento</span>
              <select
                value={campo.alinhamento ?? 'esquerda'}
                onChange={(e) => editar({ alinhamento: e.target.value as 'esquerda' })}
              >
                <option value="esquerda">Esquerda</option>
                <option value="centro">Centro</option>
                <option value="direita">Direita</option>
              </select>
            </label>
            <label className="campo">
              <span className="campo-rotulo">Se não couber</span>
              <select
                value={campo.ajuste ?? 'encolher'}
                onChange={(e) => editar({ ajuste: e.target.value as 'encolher' })}
              >
                <option value="encolher">Encolher</option>
                <option value="reticencias">Reticências</option>
                <option value="cortar">Cortar</option>
              </select>
            </label>
            <label className="campo">
              <span className="campo-rotulo">Máx. linhas</span>
              <input
                type="number"
                min={1}
                max={8}
                value={campo.maxLinhas ?? 1}
                onChange={(e) => editar({ maxLinhas: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="opcoes-etiqueta">
            <label className="checa">
              <input
                type="checkbox"
                checked={campo.fonte?.negrito ?? false}
                onChange={(e) => editar({ fonte: { ...campo.fonte!, negrito: e.target.checked } })}
              />
              Negrito
            </label>
            <label className="checa">
              <input
                type="checkbox"
                checked={campo.fonte?.italico ?? false}
                onChange={(e) => editar({ fonte: { ...campo.fonte!, italico: e.target.checked } })}
              />
              Itálico
            </label>
          </div>
        </>
      )}

      {campo.tipo === 'codigo' && (
        <>
          <label className="campo campo-largo">
            <span className="campo-rotulo">Tipo de código</span>
            <select
              value={campo.simbologia ?? 'code128'}
              onChange={(e) => editar({ simbologia: e.target.value })}
            >
              {SIMBOLOGIAS.map((s) => (
                <option key={s.id} value={s.id} disabled={s.estado !== 'pronta'}>
                  {s.nome}
                  {s.estado !== 'pronta' ? ' — em breve' : ''}
                </option>
              ))}
            </select>
            {simbologia && <span className="campo-ajuda">{simbologia.dica}</span>}
          </label>

          <div className="linha-campos">
            <TamanhoRelativo
              rotulo="Legenda"
              pct={campo.legendaPct ?? 0.07}
              alturaMm={alturaMm}
              desabilitado={!campo.mostrarLegenda}
              onChange={(legendaPct) => editar({ legendaPct })}
            />
          </div>

          <div className="opcoes-etiqueta">
            <label className="checa">
              <input
                type="checkbox"
                checked={campo.mostrarLegenda ?? true}
                onChange={(e) => editar({ mostrarLegenda: e.target.checked })}
              />
              Mostrar legenda
            </label>
          </div>
        </>
      )}

      {(campo.tipo === 'linha' || campo.tipo === 'caixa') && (
        <div className="linha-campos">
          <label className="campo">
            <span className="campo-rotulo">Espessura (mm)</span>
            <input
              type="number"
              min={0.1}
              max={5}
              step={0.1}
              value={campo.espessuraMm ?? 0.3}
              onChange={(e) => editar({ espessuraMm: Number(e.target.value) })}
            />
          </label>
          {campo.tipo === 'caixa' && (
            <label className="campo">
              <span className="campo-rotulo">Preenchida</span>
              <input
                type="checkbox"
                checked={campo.preenchido ?? false}
                onChange={(e) => editar({ preenchido: e.target.checked })}
              />
            </label>
          )}
        </div>
      )}

      <label className="campo campo-largo">
        <span className="campo-rotulo">Cinza — {Math.round(campo.cinza * 100)}% mais claro</span>
        <input
          type="range"
          min={0}
          max={0.7}
          step={0.05}
          value={campo.cinza}
          onChange={(e) => editar({ cinza: Number(e.target.value) })}
        />
      </label>

      <div className="inspetor-acoes">
        <button type="button" className="secundario" onClick={duplicar}>
          Duplicar
        </button>
        <button type="button" className="secundario perigo" onClick={remover}>
          Remover
        </button>
      </div>
    </div>
  )
}

/** Atalhos comuns, em fração da altura da etiqueta. */
const FRACOES: { rotulo: string; pct: number }[] = [
  { rotulo: '1/20', pct: 0.05 },
  { rotulo: '1/12', pct: 1 / 12 },
  { rotulo: '1/10', pct: 0.1 },
  { rotulo: '1/8', pct: 0.125 },
  { rotulo: '1/6', pct: 1 / 6 },
  { rotulo: '1/4', pct: 0.25 },
]

/**
 * Tamanho de fonte em % da altura da etiqueta.
 *
 * Mostra o mm resultante ao lado: a % sozinha não diz se o texto vai sair
 * legível numa etiqueta pequena, e abaixo de 1,2 mm a impressora térmica borra.
 */
function TamanhoRelativo({
  rotulo,
  pct,
  alturaMm,
  desabilitado,
  onChange,
}: {
  rotulo: string
  pct: number
  alturaMm: number
  desabilitado?: boolean
  onChange: (pct: number) => void
}) {
  const mmResultante = pct * alturaMm
  const miudo = mmResultante < TEXTO_MINIMO_MM

  return (
    <label className="campo campo-largo">
      <span className="campo-rotulo">
        {rotulo} — {(pct * 100).toFixed(1)}% da altura
        <span className={miudo ? 'equivalente miudo' : 'equivalente'}>
          {mmResultante.toFixed(2)} mm
        </span>
      </span>
      <input
        type="range"
        min={0.01}
        max={0.4}
        step={0.005}
        value={pct}
        disabled={desabilitado}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="fracoes">
        {FRACOES.map((f) => (
          <button
            key={f.rotulo}
            type="button"
            className={Math.abs(f.pct - pct) < 0.002 ? 'fracao ativa' : 'fracao'}
            disabled={desabilitado}
            onClick={() => onChange(f.pct)}
          >
            {f.rotulo}
          </button>
        ))}
      </span>
    </label>
  )
}

function NumeroMm({
  rotulo,
  valor,
  total,
  onChange,
}: {
  rotulo: string
  valor: number
  total: number
  onChange: (fracao: number) => void
}) {
  return (
    <label className="campo">
      <span className="campo-rotulo">{rotulo} (mm)</span>
      <input
        type="number"
        step={0.5}
        value={Math.round(valor * 10) / 10}
        onChange={(e) => onChange(total > 0 ? Number(e.target.value) / total : 0)}
      />
    </label>
  )
}
