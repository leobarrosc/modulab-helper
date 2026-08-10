/**
 * Catalogo de simbologias.
 *
 * O `bcid` e o identificador do BWIPP dentro do bwip-js. Todas as 19 pedidas
 * estao implementadas; o campo `estado` existe para poder marcar alguma como
 * "em breve" sem mexer na UI.
 */
export type EstadoSimbologia = 'pronta' | 'emBreve'

export type TipoSimbolo = 'linear' | 'matriz'

export interface Simbologia {
  id: string
  nome: string
  /** Identificador no bwip-js/BWIPP. */
  bcid: string
  tipo: TipoSimbolo
  estado: EstadoSimbologia
  /** Só dígitos? Usado para avisar antes de gerar. */
  soDigitos: boolean
  /** Tamanhos exatos aceitos, em número de caracteres. Vazio = livre. */
  tamanhos: number[]
  dica: string
}

export const SIMBOLOGIAS: readonly Simbologia[] = [
  {
    id: 'code128',
    nome: 'Code 128',
    bcid: 'code128',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Aceita letras e números, tamanho livre. É o padrão para código interno.',
  },
  {
    id: 'qrcode',
    nome: 'QR Code',
    bcid: 'qrcode',
    tipo: 'matriz',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Bidimensional, quadrado. Guarda muito mais que um código de barras.',
  },
  {
    id: 'ean13',
    nome: 'EAN-13',
    bcid: 'ean13',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [12, 13],
    dica: 'Padrão de varejo. Exige 12 dígitos (o 13º é calculado) ou 13 completos.',
  },
  {
    id: 'ean8',
    nome: 'EAN-8',
    bcid: 'ean8',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [7, 8],
    dica: 'Versão curta do EAN, para embalagens pequenas.',
  },
  {
    id: 'upca',
    nome: 'UPC-A',
    bcid: 'upca',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [11, 12],
    dica: 'Padrão norte-americano de varejo.',
  },
  {
    id: 'upce',
    nome: 'UPC-E',
    bcid: 'upce',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [7, 8],
    dica: 'UPC compactado para embalagens pequenas.',
  },
  {
    id: 'code39',
    nome: 'Code 39',
    bcid: 'code39',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Letras maiúsculas, números e alguns símbolos. Comum na indústria.',
  },
  {
    id: 'code39ext',
    nome: 'Code 39 Extended',
    bcid: 'code39ext',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Code 39 com o ASCII completo, inclusive minúsculas.',
  },
  {
    id: 'code93',
    nome: 'Code 93',
    bcid: 'code93',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Mais compacto que o Code 39, com dois dígitos verificadores.',
  },
  {
    id: 'code11',
    nome: 'Code 11',
    bcid: 'code11',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [],
    dica: 'Usado em telecomunicações. Dígitos e hífen.',
  },
  {
    id: 'gs1-128',
    nome: 'GS1-128 (EAN-128)',
    bcid: 'gs1-128',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Code 128 com identificadores de aplicação: (01)7891234567890.',
  },
  {
    id: 'interleaved2of5',
    nome: 'Interleaved 2 of 5',
    bcid: 'interleaved2of5',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [],
    dica: 'Só dígitos, em quantidade par. Comum em caixas de transporte.',
  },
  {
    id: 'industrial2of5',
    nome: 'Standard 2 of 5',
    bcid: 'industrial2of5',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [],
    dica: 'Versão industrial, mais larga que a interleaved.',
  },
  {
    id: 'msi',
    nome: 'MSI Plessey',
    bcid: 'msi',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [],
    dica: 'Controle de estoque em prateleiras. Só dígitos.',
  },
  {
    id: 'rationalizedCodabar',
    nome: 'Codabar',
    bcid: 'rationalizedCodabar',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Precisa começar e terminar com A, B, C ou D. Ex.: A12345A.',
  },
  {
    id: 'isbn',
    nome: 'ISBN-10 / ISBN-13',
    bcid: 'isbn',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: false,
    tamanhos: [],
    dica: 'Para livros. Aceita com ou sem hífens: 978-1-56581-231-4.',
  },
  {
    id: 'postnet',
    nome: 'PostNet',
    bcid: 'postnet',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [5, 9, 11],
    dica: 'CEP norte-americano. Barras altas e baixas, sem espaços largos.',
  },
  {
    id: 'ean2',
    nome: 'UPC Extension 2',
    bcid: 'ean2',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [2],
    dica: 'Complemento de 2 dígitos, usado ao lado de um EAN.',
  },
  {
    id: 'ean5',
    nome: 'UPC Extension 5',
    bcid: 'ean5',
    tipo: 'linear',
    estado: 'pronta',
    soDigitos: true,
    tamanhos: [5],
    dica: 'Complemento de 5 dígitos, geralmente para preço sugerido.',
  },
]

export const SIMBOLOGIA_PADRAO = 'code128'

export function acharSimbologia(id: string): Simbologia | undefined {
  return SIMBOLOGIAS.find((s) => s.id === id)
}
