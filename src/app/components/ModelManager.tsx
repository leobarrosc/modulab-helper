import { useRef, useState } from 'react'
import { modeloParaJson } from '@/core/etiqueta/serializar'
import { useApp } from '../store'

/** Baixa um texto como arquivo, sem tocar em servidor nenhum. */
function baixar(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export default function ModelManager() {
  const {
    modelo,
    salvos,
    avisosModelo,
    salvarModeloAtual,
    aplicarSalvo,
    excluirSalvo,
    importarModeloJson,
    dispensarAvisosModelo,
  } = useApp()

  const [nome, setNome] = useState('')
  const arquivo = useRef<HTMLInputElement>(null)

  function salvar() {
    const limpo = nome.trim()
    if (!limpo) return
    salvarModeloAtual(limpo)
    setNome('')
  }

  return (
    <div className="grupo">
      <h3>Modelos</h3>

      <div className="salvar-linha">
        <input
          placeholder="Nome do modelo…"
          value={nome}
          maxLength={60}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') salvar()
          }}
        />
        <button type="button" className="secundario" disabled={!nome.trim()} onClick={salvar}>
          Salvar
        </button>
      </div>

      {salvos.length > 0 && (
        <ul className="camadas">
          {salvos.map((s) => (
            <li key={s.nome} className="camada">
              <button
                type="button"
                className="camada-nome"
                title={`Aplicar "${s.nome}"`}
                onClick={() => aplicarSalvo(s.nome)}
              >
                <span className="camada-texto">
                  <strong>{s.nome}</strong>
                  <em>
                    {s.modelo.campos.length} {s.modelo.campos.length === 1 ? 'campo' : 'campos'}
                  </em>
                </span>
              </button>
              <span className="camada-botoes">
                <button
                  type="button"
                  title="Baixar como .json"
                  onClick={() => baixar(`${s.nome}.json`, modeloParaJson(s.modelo))}
                >
                  ⬇
                </button>
                <button type="button" title="Excluir" onClick={() => excluirSalvo(s.nome)}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="inspetor-acoes">
        <button
          type="button"
          className="secundario"
          onClick={() => baixar(`${modelo.nome || 'modelo'}.json`, modeloParaJson(modelo))}
        >
          Exportar .json
        </button>
        <button type="button" className="secundario" onClick={() => arquivo.current?.click()}>
          Importar .json
        </button>
        <input
          ref={arquivo}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) importarModeloJson(await f.text(), f.name)
            e.target.value = ''
          }}
        />
      </div>

      {avisosModelo.length > 0 && (
        <div className="problemas">
          {avisosModelo.map((a) => (
            <p key={a} className="erro-grade">
              {a}
            </p>
          ))}
          <button type="button" className="secundario" onClick={dispensarAvisosModelo}>
            Entendi
          </button>
        </div>
      )}
    </div>
  )
}
