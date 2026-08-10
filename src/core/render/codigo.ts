import type { Simbolo } from '../simbologia/codificar'
import type { DrawOp } from './tipos'

/**
 * Largura minima de um modulo. Abaixo disso nenhum leitor le, por mais bonito
 * que fique na tela. Ver PLANO.md secao 5.
 */
export const MODULO_MINIMO_MM = 0.25

export interface CaixaCodigo {
  xMm: number
  yMm: number
  larguraMm: number
  alturaMm: number
}

export interface DiagnosticoCodigo {
  /** Largura efetiva de cada modulo, em mm. */
  moduloMm: number
  /** Largura realmente ocupada pelo simbolo. */
  larguraUsadaMm: number
  /** `false` se o modulo ficou fino demais para um leitor. */
  legivel: boolean
}

export interface CodigoDesenhado {
  ops: DrawOp[]
  diagnostico: DiagnosticoCodigo
}

/**
 * Converte um simbolo em retangulos posicionados dentro da caixa.
 *
 * Cada barra e cada modulo de QR vira um `rect` vetorial, em vez de uma imagem
 * rasterizada. E o que mantem o codigo nitido em qualquer DPI de impressora
 * termica e o PDF pequeno.
 *
 * O simbolo e centralizado horizontalmente na caixa quando sobra espaco.
 */
export function desenharCodigo(simbolo: Simbolo, caixa: CaixaCodigo, cinza = 0): CodigoDesenhado {
  return simbolo.tipo === 'linear'
    ? desenharLinear(simbolo, caixa, cinza)
    : desenharMatriz(simbolo, caixa, cinza)
}

function desenharLinear(
  simbolo: Extract<Simbolo, { tipo: 'linear' }>,
  caixa: CaixaCodigo,
  cinza: number,
): CodigoDesenhado {
  const moduloMm = simbolo.larguraModulos > 0 ? caixa.larguraMm / simbolo.larguraModulos : 0
  const larguraUsadaMm = simbolo.larguraModulos * moduloMm
  const sobra = Math.max(0, caixa.larguraMm - larguraUsadaMm)
  const x0 = caixa.xMm + sobra / 2

  const ops: DrawOp[] = simbolo.barras
    .filter((b) => b.larguraModulos > 0 && b.alturaFracao > 0)
    .map((b) => ({
      op: 'rect' as const,
      xMm: x0 + b.xModulos * moduloMm,
      // As barras assentam na BASE do simbolo: uma barra curta do PostNet
      // fica embaixo, nao no topo.
      yMm: caixa.yMm + (1 - b.baseFracao - b.alturaFracao) * caixa.alturaMm,
      larguraMm: b.larguraModulos * moduloMm,
      alturaMm: b.alturaFracao * caixa.alturaMm,
      cinza,
      preenchido: true,
    }))

  return {
    ops,
    diagnostico: {
      moduloMm,
      larguraUsadaMm,
      legivel: moduloMm >= MODULO_MINIMO_MM,
    },
  }
}

function desenharMatriz(
  simbolo: Extract<Simbolo, { tipo: 'matriz' }>,
  caixa: CaixaCodigo,
  cinza: number,
): CodigoDesenhado {
  // QR precisa ser quadrado: usa o menor lado e centraliza.
  const lado = Math.min(caixa.larguraMm, caixa.alturaMm)
  const moduloMm = simbolo.colunas > 0 ? lado / simbolo.colunas : 0
  const x0 = caixa.xMm + (caixa.larguraMm - lado) / 2
  const y0 = caixa.yMm + (caixa.alturaMm - lado) / 2

  const ops: DrawOp[] = []

  for (let linha = 0; linha < simbolo.linhas; linha++) {
    // Junta modulos escuros vizinhos num retangulo so. Reduz muito a contagem
    // de operacoes -- um QR 21x21 sai com ~90 retangulos em vez de ~220 --
    // e evita costuras claras entre modulos na impressao.
    let inicio = -1

    for (let coluna = 0; coluna <= simbolo.colunas; coluna++) {
      const escuro = coluna < simbolo.colunas && simbolo.modulos[linha * simbolo.colunas + coluna]

      if (escuro && inicio === -1) {
        inicio = coluna
      } else if (!escuro && inicio !== -1) {
        ops.push({
          op: 'rect',
          xMm: x0 + inicio * moduloMm,
          yMm: y0 + linha * moduloMm,
          larguraMm: (coluna - inicio) * moduloMm,
          alturaMm: moduloMm,
          cinza,
          preenchido: true,
        })
        inicio = -1
      }
    }
  }

  return {
    ops,
    diagnostico: {
      moduloMm,
      larguraUsadaMm: lado,
      legivel: moduloMm >= MODULO_MINIMO_MM,
    },
  }
}
