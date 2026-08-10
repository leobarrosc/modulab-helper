import type { Campo, Modelo, TipoCampo } from './tipos'

let contador = 0

export function novoId(prefixo = 'campo'): string {
  contador += 1
  return `${prefixo}-${Date.now().toString(36)}-${contador.toString(36)}`
}

const PADROES: Record<TipoCampo, Partial<Campo>> = {
  texto: {
    nome: 'Texto',
    template: '{Descrição}',
    fonte: { familia: 'Helvetica', tamanhoPct: 0.09, negrito: false, italico: false },
    alinhamento: 'esquerda',
    ajuste: 'encolher',
    maxLinhas: 1,
    h: 0.14,
  },
  codigo: {
    nome: 'Código de barras',
    template: '{Código}',
    simbologia: 'code128',
    mostrarLegenda: true,
    legendaPct: 0.07,
    h: 0.45,
  },
  linha: { nome: 'Linha', template: '', espessuraMm: 0.3, h: 0.02 },
  caixa: { nome: 'Caixa', template: '', espessuraMm: 0.3, preenchido: false, h: 0.2 },
}

export function criarCampo(tipo: TipoCampo, parcial: Partial<Campo> = {}): Campo {
  const base: Campo = {
    id: novoId(tipo),
    tipo,
    nome: 'Campo',
    x: 0.06,
    y: 0.06,
    w: 0.88,
    h: 0.2,
    rotacao: 0,
    cinza: 0,
    travado: false,
    template: '',
    ...PADROES[tipo],
    ...parcial,
  }
  return base
}

/**
 * Modelo inicial: descricao em cima, codigo no meio, legenda ja embutida no
 * campo de codigo. E o mesmo arranjo das fases anteriores, agora feito de
 * campos que podem ser arrastados.
 */
export function modeloPadrao(fonteCodigo = 'Código'): Modelo {
  return {
    id: novoId('modelo'),
    nome: 'Padrão',
    campos: [
      criarCampo('texto', {
        nome: 'Descrição',
        template: '{Descrição}',
        x: 0.05,
        y: 0.05,
        w: 0.9,
        h: 0.16,
        fonte: { familia: 'Helvetica', tamanhoPct: 0.1, negrito: true, italico: false },
      }),
      criarCampo('texto', {
        nome: 'Preço',
        template: '{Preço|moeda}',
        x: 0.05,
        y: 0.23,
        w: 0.9,
        h: 0.14,
        fonte: { familia: 'Helvetica', tamanhoPct: 0.085, negrito: false, italico: false },
      }),
      criarCampo('codigo', {
        nome: 'Código',
        template: `{${fonteCodigo}}`,
        x: 0.05,
        y: 0.4,
        w: 0.9,
        h: 0.55,
      }),
    ],
  }
}

export function acharCampo(modelo: Modelo, id: string): Campo | undefined {
  return modelo.campos.find((c) => c.id === id)
}

export function atualizarCampo(modelo: Modelo, id: string, mudanca: Partial<Campo>): Modelo {
  return {
    ...modelo,
    campos: modelo.campos.map((c) => (c.id === id ? { ...c, ...mudanca } : c)),
  }
}

export function removerCampo(modelo: Modelo, id: string): Modelo {
  return { ...modelo, campos: modelo.campos.filter((c) => c.id !== id) }
}

export function adicionarCampo(modelo: Modelo, campo: Campo): Modelo {
  return { ...modelo, campos: [...modelo.campos, campo] }
}

/** Move o campo na ordem de desenho. O ultimo fica por cima. */
export function reordenarCampo(modelo: Modelo, id: string, delta: number): Modelo {
  const indice = modelo.campos.findIndex((c) => c.id === id)
  if (indice === -1) return modelo

  const destino = Math.min(modelo.campos.length - 1, Math.max(0, indice + delta))
  if (destino === indice) return modelo

  const campos = [...modelo.campos]
  const [campo] = campos.splice(indice, 1)
  if (campo) campos.splice(destino, 0, campo)
  return { ...modelo, campos }
}

export function duplicarCampo(modelo: Modelo, id: string): { modelo: Modelo; novoId: string } {
  const original = acharCampo(modelo, id)
  if (!original) return { modelo, novoId: id }

  const copia = criarCampo(original.tipo, {
    ...original,
    id: novoId(original.tipo),
    nome: `${original.nome} (cópia)`,
    x: Math.min(0.9, original.x + 0.03),
    y: Math.min(0.9, original.y + 0.03),
  })

  return { modelo: adicionarCampo(modelo, copia), novoId: copia.id }
}
