import { useState } from 'react'
import { gerarPdf, nomeArquivoPdf } from '@/core/render/pdf'
import { LIMITE_AVISO_ETIQUETAS, type Folhas } from '@/core/render/folha'
import { imprimirFolhas } from '../imprimir'

export default function ExportBar({ folhas }: { folhas: Folhas }) {
  const [ocupado, setOcupado] = useState<'pdf' | 'impressao' | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const vazio = folhas.paginas.length === 0
  const muitas = folhas.totalEtiquetas > LIMITE_AVISO_ETIQUETAS

  async function baixarPdf() {
    setOcupado('pdf')
    setErro(null)
    try {
      // Deixa o navegador pintar o estado "gerando" antes de travar a thread.
      await new Promise((r) => setTimeout(r, 0))
      gerarPdf(folhas.paginas, { titulo: 'Etiquetas — Modulab Helper' }).save(nomeArquivoPdf())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.')
    } finally {
      setOcupado(null)
    }
  }

  async function imprimir() {
    setOcupado('impressao')
    setErro(null)
    try {
      await new Promise((r) => setTimeout(r, 0))
      imprimirFolhas(folhas.paginas)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a impressão.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <section className="exportar">
      <div className="exportar-resumo">
        <strong>{folhas.totalEtiquetas}</strong>{' '}
        {folhas.totalEtiquetas === 1 ? 'etiqueta' : 'etiquetas'} em{' '}
        <strong>{folhas.paginas.length}</strong>{' '}
        {folhas.paginas.length === 1 ? 'folha' : 'folhas'}
      </div>

      <div className="exportar-botoes">
        <button type="button" onClick={baixarPdf} disabled={vazio || ocupado !== null}>
          {ocupado === 'pdf' ? 'Gerando…' : 'Baixar PDF'}
        </button>
        <button
          type="button"
          className="secundario"
          onClick={imprimir}
          disabled={vazio || ocupado !== null}
        >
          {ocupado === 'impressao' ? 'Abrindo…' : 'Imprimir'}
        </button>
      </div>

      <p className="exportar-nota">
        O <strong>PDF é o caminho confiável</strong>: sai nas medidas exatas. Ao usar
        <em> Imprimir</em>, marque <em>Margens: nenhuma</em> e <em>Escala: 100%</em> no
        diálogo do navegador, senão a etiqueta sai reduzida.
      </p>

      {muitas && (
        <p className="aviso">
          São {folhas.totalEtiquetas} etiquetas. Gerar o PDF pode demorar alguns segundos e
          deixar a aba travada nesse intervalo.
        </p>
      )}

      {folhas.problemas.length > 0 && (
        <div className="problemas">
          {folhas.problemas.map((p) => (
            <p key={`${p.campoId}|${p.mensagem}`} className="erro-grade">
              {p.campoNome}: {p.mensagem}
            </p>
          ))}
        </div>
      )}

      {erro && <p className="erro">{erro}</p>}
    </section>
  )
}
