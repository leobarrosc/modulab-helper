/** Normalizacao de texto compartilhada pelo modulo de estante. */

/**
 * Maiuscula e sem acento.
 *
 * E a identidade de marca, tipo e cor em todo o modulo: o Bling nao tem padrao
 * de caixa nem de acentuacao, e no cadastro real convivem "MultFila" e
 * "MULTFILA" como a MESMA marca. Comparar as strings cruas daria um andar novo
 * para cada grafia.
 *
 * `\p{Diacritic}` em vez de uma faixa de marcas combinantes escrita a mao: a
 * faixa literal e invisivel no editor e nao sobrevive a uma normalizacao do
 * arquivo para NFC.
 */
export function normalizarTexto(valor: string): string {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim()
}
