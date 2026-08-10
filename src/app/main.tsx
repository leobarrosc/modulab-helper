import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { agendarGravacao, carregarEstado } from './armazenamento'
import { serializarModelo } from '@/core/etiqueta/serializar'
import { useApp } from './store'
import './styles.css'

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root nao encontrado.')

async function iniciar() {
  // Hidrata ANTES do primeiro render: senao a tela abre nos padroes de
  // fabrica e salta para as escolhas do usuario um instante depois.
  const gravado = await carregarEstado()
  if (gravado) useApp.getState().hidratar(gravado)

  // Toda mudanca relevante agenda uma gravacao (com debounce de 400 ms).
  useApp.subscribe((s) => {
    agendarGravacao({
      versao: 1,
      pagina: s.pagina,
      grade: s.grade,
      pularCelulas: s.pularCelulas,
      fonteCodigo: s.fonteCodigo,
      multiplicarPorEstoque: s.multiplicarPorEstoque,
      soAtivos: s.soAtivos,
      encaixe: s.encaixe,
      corte: s.corte,
      modelo: serializarModelo(s.modelo),
      salvos: s.salvos.map((item) => serializarModelo({ ...item.modelo, nome: item.nome })),
    })
  })

  createRoot(container!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void iniciar()
