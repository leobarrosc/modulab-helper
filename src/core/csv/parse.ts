/**
 * Parser de CSV no estilo RFC 4180.
 *
 * Escrito a mao porque as regras de limpeza do export do Bling (tabs coladas
 * nos valores, BOM, decimal com virgula, hierarquia com `>>`) sao especificas
 * demais -- uma lib generica ficaria envolvida em tanta pos-limpeza que nao
 * pagaria a dependencia. Ver PLANO.md secao 14.
 *
 * Trata: aspas, `""` como aspa escapada, delimitador e quebra de linha dentro
 * de aspas, CRLF e LF misturados.
 */
export function analisarCsv(texto: string, delimitador: string): string[][] {
  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let dentroAspas = false
  let temConteudo = false // distingue fim de arquivo limpo de linha pendente

  const fecharCampo = () => {
    linha.push(campo)
    campo = ''
  }

  const fecharLinha = () => {
    fecharCampo()
    linhas.push(linha)
    linha = []
    temConteudo = false
  }

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]

    if (dentroAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          dentroAspas = false
        }
      } else {
        campo += c
      }
      continue
    }

    if (c === '"') {
      dentroAspas = true
      temConteudo = true
    } else if (c === delimitador) {
      fecharCampo()
      temConteudo = true
    } else if (c === '\n') {
      fecharLinha()
    } else if (c === '\r') {
      if (texto[i + 1] === '\n') i++
      fecharLinha()
    } else {
      campo += c
      temConteudo = true
    }
  }

  // Ultima linha sem quebra no fim do arquivo.
  if (temConteudo || campo !== '' || linha.length > 0) fecharLinha()

  return linhas
}
