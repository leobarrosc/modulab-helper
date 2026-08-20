import AbaEstante from './components/AbaEstante'
import AbaEtiquetas from './components/AbaEtiquetas'
import Icone, { type NomeIcone } from './components/Icone'
import { useApp, type Aba } from './store'

const ABAS: { id: Aba; titulo: string; icone: NomeIcone; sub: string }[] = [
  {
    id: 'etiquetas',
    titulo: 'Etiquetas',
    icone: 'etiqueta',
    sub: 'Etiquetas com código de barras a partir do CSV do Bling',
  },
  {
    id: 'estante',
    titulo: 'Estante',
    icone: 'estante',
    sub: 'Mapa da prateleira e conferência do que falta repor',
  },
]

/**
 * Casca do app.
 *
 * As duas abas sao missoes diferentes -- uma imprime, a outra confere -- e
 * compartilham so o CSV importado. Cada uma cuida do proprio estado e dos
 * proprios atalhos de teclado.
 */
export default function App() {
  const abaAtiva = useApp((s) => s.abaAtiva)
  const setAbaAtiva = useApp((s) => s.setAbaAtiva)

  const atual = ABAS.find((a) => a.id === abaAtiva) ?? ABAS[0]!

  return (
    <main className={abaAtiva === 'estante' ? 'shell shell-largo' : 'shell'}>
      <header className="cabecalho">
        <h1>Modulab Helper</h1>
        <p className="sub">{atual.sub}</p>
      </header>

      <nav className="abas" aria-label="Seções do app">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            type="button"
            className={aba.id === abaAtiva ? 'aba ativa' : 'aba'}
            aria-current={aba.id === abaAtiva ? 'page' : undefined}
            onClick={() => setAbaAtiva(aba.id)}
          >
            <Icone nome={aba.icone} tamanho={16} />
            {aba.titulo}
          </button>
        ))}
      </nav>

      {abaAtiva === 'estante' ? <AbaEstante /> : <AbaEtiquetas />}

      <footer className="rodape">
        Tudo o que você escolhe fica guardado para a próxima vez. Nenhum dado sai da máquina.
      </footer>
    </main>
  )
}
