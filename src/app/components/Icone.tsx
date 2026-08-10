import type { ReactElement } from 'react'

/**
 * Ícones em SVG inline.
 *
 * Desenhados à mão em vez de virem de uma biblioteca: a CSP da MV3 proíbe
 * recurso externo, e um pacote de ícones inteiro por meia dúzia de glifos não
 * pagaria o peso no bundle.
 */
export type NomeIcone =
  | 'importar'
  | 'lista'
  | 'etiqueta'
  | 'folha'
  | 'imprimir'
  | 'arquivo'
  | 'texto'
  | 'codigo'
  | 'linha'
  | 'caixa'
  | 'seta'
  | 'check'
  | 'tesoura'
  | 'desfazer'
  | 'refazer'
  | 'baixar'
  | 'lixeira'
  | 'cadeado'
  | 'cadeadoAberto'

const CAMINHOS: Record<NomeIcone, ReactElement> = {
  importar: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  lista: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  etiqueta: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h6M7 13h10M7 16h4" />
    </>
  ),
  folha: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M4 9h16M4 15h16M12 3v18" />
    </>
  ),
  imprimir: (
    <>
      <path d="M7 8V4h10v4" />
      <rect x="3" y="8" width="18" height="8" rx="1.5" />
      <path d="M7 14h10v6H7z" />
    </>
  ),
  arquivo: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  texto: (
    <>
      <path d="M5 6V5h14v1" />
      <path d="M12 5v14M9 19h6" />
    </>
  ),
  codigo: (
    <>
      <path d="M4 5v14M7 5v14M10.5 5v14M14 5v14M17 5v14M20 5v14" />
    </>
  ),
  linha: <path d="M4 12h16" />,
  caixa: <rect x="4" y="6" width="16" height="12" rx="1" />,
  seta: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 13 4 4L19 7" />,
  tesoura: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5 20 18M8 16.5 20 6" />
    </>
  ),
  desfazer: (
    <>
      <path d="M3 8h11a5 5 0 0 1 0 10H8" />
      <path d="m7 4-4 4 4 4" />
    </>
  ),
  refazer: (
    <>
      <path d="M21 8H10a5 5 0 0 0 0 10h6" />
      <path d="m17 4 4 4-4 4" />
    </>
  ),
  baixar: (
    <>
      <path d="M12 4v11" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </>
  ),
  lixeira: (
    <>
      <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
    </>
  ),
  cadeado: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  cadeadoAberto: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V8a4 4 0 0 1 7.5-2" />
    </>
  ),
}

export default function Icone({
  nome,
  tamanho = 16,
  className,
}: {
  nome: NomeIcone
  tamanho?: number
  className?: string
}) {
  return (
    <svg
      className={className ? `icone ${className}` : 'icone'}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {CAMINHOS[nome]}
    </svg>
  )
}
