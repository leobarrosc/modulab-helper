import { useRef, useState } from 'react'
import { useApp } from '../store'
import SeletorFonte from './SeletorFonte'

export default function ImportPanel() {
  const importar = useApp((s) => s.importar)
  const carregando = useApp((s) => s.carregando)
  const erro = useApp((s) => s.erro)
  const [arrastando, setArrastando] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function receber(arquivos: FileList | null) {
    const arquivo = arquivos?.[0]
    if (arquivo) void importar(arquivo)
  }

  return (
    <div className="importar">
      <div
        className={arrastando ? 'solta ativa' : 'solta'}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastando(false)
          receber(e.dataTransfer.files)
        }}
      >
        <p className="solta-titulo">
          {carregando ? 'Lendo arquivo…' : 'Arraste o CSV do Bling aqui'}
        </p>
        <p className="solta-sub">ou</p>
        <button type="button" onClick={() => input.current?.click()} disabled={carregando}>
          Escolher arquivo
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            receber(e.target.files)
            // Permite reimportar o mesmo arquivo depois de corrigi-lo.
            e.target.value = ''
          }}
        />
      </div>

      {erro && <p className="erro">{erro}</p>}

      <SeletorFonte />

      <p className="dica">
        No Bling: <strong>Cadastros → Produtos → Exportar</strong>. O arquivo é lido
        localmente e nada é enviado para a internet.
      </p>
    </div>
  )
}
