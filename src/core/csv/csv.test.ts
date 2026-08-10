import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analisarCsv, detectarDelimitador, lerCsv, limpar, numeroBr } from './index'

const CSV_REAL = join(process.cwd(), 'produtos_2026-07-20-10-29-43.csv')

function lerArquivoReal() {
  return lerCsv(new Uint8Array(readFileSync(CSV_REAL)))
}

describe('limpar', () => {
  it('remove o tab que o Bling cola no fim do Codigo', () => {
    expect(limpar('261\t')).toBe('261')
  })

  it('remove o tab que o Bling cola no inicio do GTIN/EAN', () => {
    expect(limpar('\t7898757181218')).toBe('7898757181218')
  })

  it('reduz uma celula so de tab a vazio', () => {
    expect(limpar('\t')).toBe('')
  })

  it('remove NBSP e BOM solto', () => {
    expect(limpar(' 261﻿')).toBe('261')
  })

  it('preserva espacos internos', () => {
    expect(limpar('  FILAMENTO PLA PRETO  ')).toBe('FILAMENTO PLA PRETO')
  })
})

describe('numeroBr', () => {
  it('converte decimal com virgula', () => {
    expect(numeroBr('119,90')).toBe(119.9)
  })

  it('converte estoque com quatro casas', () => {
    expect(numeroBr('42,0000')).toBe(42)
  })

  it('converte com separador de milhar', () => {
    expect(numeroBr('1.234,56')).toBe(1234.56)
  })

  it('devolve null para texto', () => {
    expect(numeroBr('FILAMENTO')).toBeNull()
    expect(numeroBr('')).toBeNull()
  })
})

describe('analisarCsv', () => {
  it('respeita delimitador dentro de aspas', () => {
    expect(analisarCsv('"a;b";"c"', ';')).toEqual([['a;b', 'c']])
  })

  it('respeita quebra de linha dentro de aspas', () => {
    expect(analisarCsv('"linha\nquebrada";"x"', ';')).toEqual([['linha\nquebrada', 'x']])
  })

  it('trata "" como aspa escapada', () => {
    expect(analisarCsv('"diz ""oi""";"b"', ';')).toEqual([['diz "oi"', 'b']])
  })

  it('nao inventa linha extra quando o arquivo termina com CRLF', () => {
    expect(analisarCsv('"a";"b"\r\n"c";"d"\r\n', ';')).toHaveLength(2)
  })

  it('preserva a ultima linha sem quebra final', () => {
    expect(analisarCsv('"a";"b"\r\n"c";"d"', ';')).toHaveLength(2)
  })

  it('preserva campos vazios no fim da linha', () => {
    expect(analisarCsv('"a";;', ';')).toEqual([['a', '', '']])
  })
})

describe('detectarDelimitador', () => {
  it('acha o ponto e virgula do Bling', () => {
    expect(detectarDelimitador('"ID";"Codigo";"Descricao"')).toBe(';')
  })

  it('ignora delimitadores dentro de aspas', () => {
    expect(detectarDelimitador('"a,b,c,d,e";"f"')).toBe(';')
  })

  it('acha virgula em CSV padrao americano', () => {
    expect(detectarDelimitador('id,code,name')).toBe(',')
  })
})

describe('lerCsv com o arquivo real do Bling', () => {
  it('detecta UTF-8 com BOM e delimitador ;', () => {
    const p = lerArquivoReal()
    expect(p.meta.encoding).toBe('utf-8')
    expect(p.meta.tinhaBom).toBe(true)
    expect(p.meta.delimitador).toBe(';')
  })

  it('le 59 colunas e 12 produtos', () => {
    const p = lerArquivoReal()
    expect(p.colunas).toHaveLength(59)
    expect(p.linhas).toHaveLength(12)
  })

  it('preserva os acentos do cabecalho', () => {
    const p = lerArquivoReal()
    expect(p.colunas.slice(0, 3)).toEqual(['ID', 'Código', 'Descrição'])
  })

  it('tira o tab do Codigo de todas as linhas', () => {
    const p = lerArquivoReal()
    for (const linha of p.linhas) {
      expect(linha['Código']).toMatch(/^\d+$/)
    }
    expect(p.linhas[0]?.['Código']).toBe('261')
  })

  it('deixa o GTIN/EAN vazio em 10 dos 12 produtos', () => {
    const p = lerArquivoReal()
    const preenchidos = p.linhas.filter((l) => l['GTIN/EAN'] !== '')
    expect(preenchidos).toHaveLength(2)
  })

  it('mantem o ID preenchido em 100% das linhas -- por isso e o padrao', () => {
    const p = lerArquivoReal()
    for (const linha of p.linhas) {
      expect(linha['ID']).toMatch(/^\d+$/)
    }
  })

  it('nao gera avisos para um arquivo bem formado', () => {
    expect(lerArquivoReal().avisos).toEqual([])
  })

  it('le preco e categoria hierarquica do primeiro produto', () => {
    const primeiro = lerArquivoReal().linhas[0]
    expect(primeiro?.['Descrição']).toBe('FILAMENTO PLA PRETO')
    expect(numeroBr(primeiro?.['Preço'] ?? '')).toBe(119.9)
    expect(primeiro?.['Categoria do produto']).toBe('Filamentos>>PLA>>Básico')
  })
})

describe('lerCsv em situacoes ruins', () => {
  const bytes = (s: string) => new TextEncoder().encode(s)

  it('avisa quando so uma coluna e detectada', () => {
    const p = lerCsv(bytes('so_uma_coluna\nvalor'))
    expect(p.avisos.join(' ')).toMatch(/uma coluna/i)
  })

  it('renumera colunas com nome repetido', () => {
    const p = lerCsv(bytes('A;A;B\n1;2;3'))
    expect(p.colunas).toEqual(['A', 'A (2)', 'B'])
    expect(p.linhas[0]).toEqual({ A: '1', 'A (2)': '2', B: '3' })
  })

  it('descarta linhas vazias sem contar como produto', () => {
    const p = lerCsv(bytes('A;B\n1;2\n\n;\n3;4'))
    expect(p.linhas).toHaveLength(2)
    expect(p.meta.linhasVazias).toBe(2)
  })

  it('preenche celulas faltantes e avisa', () => {
    const p = lerCsv(bytes('A;B;C\n1;2'))
    expect(p.linhas[0]).toEqual({ A: '1', B: '2', C: '' })
    expect(p.avisos.join(' ')).toMatch(/numero de colunas/i)
  })

  it('cai para windows-1252 quando o UTF-8 e invalido', () => {
    // "Desc" + 0xE7 (c-cedilha em Latin-1, sequencia invalida em UTF-8) + ";B\n1;2"
    const latin1 = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0xe7, 0x3b, 0x42, 0x0a, 0x31, 0x3b, 0x32])
    const p = lerCsv(latin1)
    expect(p.meta.encoding).toBe('windows-1252')
    expect(p.colunas[0]).toBe('Descç')
  })

  it('rejeita arquivo vazio', () => {
    expect(() => lerCsv(bytes(''))).toThrow(/vazio/i)
  })
})
