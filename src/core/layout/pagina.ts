import type { Orientacao, Pagina, Preset, PresetId, Tamanho } from './tipos'

/**
 * Medidas em mm exatos, escritas como literais em vez de `polegadas * 25,4`.
 * A multiplicacao introduz erro de ponto flutuante -- `6 * 25.4` da
 * 152.39999999999998 -- que se propagaria para as coordenadas do PDF.
 */
export const PRESETS: readonly Preset[] = [
  { id: 'a4', nome: 'A4', larguraMm: 210, alturaMm: 297, gradeSugerida: { colunas: 3, linhas: 8 } },
  {
    id: '2x4',
    nome: '2 × 4 pol',
    larguraMm: 50.8,
    alturaMm: 101.6,
    gradeSugerida: { colunas: 1, linhas: 1 },
  },
  {
    id: '4x4',
    nome: '4 × 4 pol',
    larguraMm: 101.6,
    alturaMm: 101.6,
    gradeSugerida: { colunas: 1, linhas: 1 },
  },
  {
    id: '4x6',
    nome: '4 × 6 pol',
    larguraMm: 101.6,
    alturaMm: 152.4,
    gradeSugerida: { colunas: 1, linhas: 1 },
  },
]

export const PRESET_PADRAO: PresetId = '2x4'

export function acharPreset(id: PresetId): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}

export function paginaDoPreset(id: PresetId, orientacao: Orientacao = 'retrato'): Pagina {
  const preset = acharPreset(id)
  if (!preset) {
    // "personalizado" nao tem preset; comeca do A4 para o usuario ajustar.
    return { preset: id, larguraMm: 210, alturaMm: 297, orientacao }
  }
  return {
    preset: id,
    larguraMm: preset.larguraMm,
    alturaMm: preset.alturaMm,
    orientacao,
  }
}

/** Dimensoes efetivas: paisagem troca largura por altura. */
export function dimensoes(pagina: Pagina): Tamanho {
  return pagina.orientacao === 'paisagem'
    ? { larguraMm: pagina.alturaMm, alturaMm: pagina.larguraMm }
    : { larguraMm: pagina.larguraMm, alturaMm: pagina.alturaMm }
}

/** Formata em mm com no maximo uma casa, sem zero a toa: 101.6 -> "101,6". */
export function mm(valor: number): string {
  return (Math.round(valor * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
