/** Criacao de estantes e os valores de fabrica. */
import { novoId } from '../etiqueta/modelo'
import type { TemplateEstante } from './tipos'

/** Limites de sanidade: uma estante de 200 andares e erro de digitacao. */
export const LIMITES_ESTANTE = {
  andares: { min: 1, max: 60 },
  colunas: { min: 1, max: 60 },
  capacidadePorCelula: { min: 1, max: 8 },
  /** Quantas colunas seguidas um mesmo produto pode ocupar. */
  largura: { min: 1, max: 12 },
} as const

/**
 * A primeira estante da loja: 6 andares, 12 colunas, dois rolos por celula (um
 * na frente, um atras) e so filamento.
 */
export const ESTANTE_PADRAO: Omit<TemplateEstante, 'id'> = {
  nome: 'Estante de filamentos',
  andares: 6,
  colunas: 12,
  capacidadePorCelula: 2,
  raizCategoria: 'Filamentos',
  marcasPermitidas: [],
  andaresBloqueados: [],
  regrasAndar: [],
}

export function criarEstante(dados: Partial<Omit<TemplateEstante, 'id'>> = {}): TemplateEstante {
  return {
    id: novoId('estante'),
    ...ESTANTE_PADRAO,
    // Copias proprias: o padrao e um objeto so, e duas estantes nao podem
    // compartilhar o mesmo array de marcas.
    marcasPermitidas: [...ESTANTE_PADRAO.marcasPermitidas],
    andaresBloqueados: [...ESTANTE_PADRAO.andaresBloqueados],
    regrasAndar: [...ESTANTE_PADRAO.regrasAndar],
    ...dados,
  }
}

/** A regra do andar, se houver. */
export function regraDoAndar(
  template: TemplateEstante,
  andar: number,
): TemplateEstante['regrasAndar'][number] | undefined {
  return template.regrasAndar.find((r) => r.andar === andar)
}

/** `true` se a regra nao restringe nada -- vale como andar sem regra. */
export function regraVazia(regra: {
  marcas: string[]
  tipos: string[]
  cores: string[]
  coresPorTipo?: Record<string, string[]>
}): boolean {
  if (regra.marcas.length > 0 || regra.tipos.length > 0 || regra.cores.length > 0) return false
  // Excecao vazia nao restringe nada: com `cores` tambem vazio, so sobrou
  // ruido de storage. Uma excecao PREENCHIDA, sozinha, ja e uma regra
  // ("qualquer tipo, mas PLA so preto") e nao pode ser descartada aqui.
  return Object.values(regra.coresPorTipo ?? {}).every((c) => c.length === 0)
}

/** `true` se o andar (base 1) recebe produto. */
export function andarLiberado(template: TemplateEstante, andar: number): boolean {
  return !template.andaresBloqueados.includes(andar)
}

/** Os andares que recebem produto, em ordem. */
export function andaresUteis(template: TemplateEstante): number[] {
  const total = Math.max(0, Math.trunc(template.andares))
  const uteis: number[] = []
  for (let andar = 1; andar <= total; andar++) {
    if (andarLiberado(template, andar)) uteis.push(andar)
  }
  return uteis
}

/** Quantas celulas a estante tem de fato -- os andares bloqueados nao contam. */
export function totalCelulas(template: TemplateEstante): number {
  return andaresUteis(template).length * Math.max(0, Math.trunc(template.colunas))
}

/** Quantos rolos a estante comporta no total. */
export function capacidadeTotal(template: TemplateEstante): number {
  return totalCelulas(template) * Math.max(0, Math.trunc(template.capacidadePorCelula))
}
