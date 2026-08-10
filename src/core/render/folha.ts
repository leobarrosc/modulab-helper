import type { LinhaCsv, Planilha } from '../csv'
import { renderizarEtiqueta, type ProblemaCampo } from '../etiqueta/render'
import type { Modelo } from '../etiqueta/tipos'
import {
  celulasDaPagina,
  contarPaginas,
  CORTE_PADRAO,
  opsDeCorte,
  posicaoCelula,
  type ConfigCorte,
  type Grade,
  type ResultadoGrade,
} from '../layout'
import type { PaginaPdf } from './pdf'
import type { DrawOp } from './tipos'

/**
 * Acima disso o navegador engasga: um export grande do Bling com o
 * multiplicador ligado pode render milhares de etiquetas. Ver PLANO.md §2.
 */
export const LIMITE_AVISO_ETIQUETAS = 500

export interface EntradaFolhas {
  planilha: Planilha
  /** Índices de linha, um por etiqueta, na ordem de impressão. */
  fila: number[]
  modelo: Modelo
  grade: Grade
  resultado: ResultadoGrade
  pularCelulas: number
  corte?: ConfigCorte
}

export interface Folhas {
  paginas: PaginaPdf[]
  problemas: ProblemaCampo[]
  totalEtiquetas: number
}

/**
 * Expande a fila em páginas de `DrawOp[]`.
 *
 * Cada etiqueta e desenhada em coordenadas locais e deslocada para a celula --
 * a mesma `DrawOp[]` que a previa usa, so que ja em coordenadas de pagina.
 */
export function montarFolhas(entrada: EntradaFolhas): Folhas {
  const { planilha, fila, modelo, grade, resultado, pularCelulas } = entrada
  const corte = entrada.corte ?? CORTE_PADRAO

  if (!resultado.valida || resultado.porPagina <= 0 || fila.length === 0) {
    return { paginas: [], problemas: [], totalEtiquetas: 0 }
  }

  const total = contarPaginas(fila.length, resultado.porPagina, pularCelulas)
  const paginas: PaginaPdf[] = []
  const problemas = new Map<string, ProblemaCampo>()

  // Idêntico em toda folha: calcula uma vez e reaproveita.
  const riscosDeCorte = opsDeCorte(grade, resultado, corte)

  for (let p = 0; p < total; p++) {
    const celulas = celulasDaPagina(fila.length, resultado.porPagina, p, pularCelulas)
    // Os riscos entram primeiro, para ficarem sob as etiquetas.
    const ops: DrawOp[] = [...riscosDeCorte]

    celulas.forEach((posicaoNaFila, i) => {
      if (posicaoNaFila === null) return

      const indiceLinha = fila[posicaoNaFila]
      const linha: LinhaCsv | undefined =
        indiceLinha === undefined ? undefined : planilha.linhas[indiceLinha]
      if (!linha) return

      const { xMm, yMm } = posicaoCelula(grade, resultado, i)
      const desenho = renderizarEtiqueta(
        modelo,
        { linha, indice: posicaoNaFila + 1, total: fila.length },
        {
          xMm: 0,
          yMm: 0,
          larguraMm: resultado.etiqueta.larguraMm,
          alturaMm: resultado.etiqueta.alturaMm,
        },
      )

      ops.push(...desenho.ops.map((op) => deslocar(op, xMm, yMm)))

      // Deduplica por campo + mensagem: 84 etiquetas com o mesmo defeito
      // devem produzir UM aviso, nao 84.
      for (const problema of desenho.problemas) {
        problemas.set(`${problema.campoId}|${problema.mensagem}`, problema)
      }
    })

    paginas.push({
      larguraMm: resultado.pagina.larguraMm,
      alturaMm: resultado.pagina.alturaMm,
      ops,
    })
  }

  return { paginas, problemas: [...problemas.values()], totalEtiquetas: fila.length }
}

/** Move uma op para a posição da célula, sem alterar nada mais. */
function deslocar(op: DrawOp, dx: number, dy: number): DrawOp {
  if (op.op === 'rect') return { ...op, xMm: op.xMm + dx, yMm: op.yMm + dy }
  if (op.op === 'texto') return { ...op, xMm: op.xMm + dx, yMm: op.yMm + dy }
  return {
    ...op,
    x1Mm: op.x1Mm + dx,
    y1Mm: op.y1Mm + dy,
    x2Mm: op.x2Mm + dx,
    y2Mm: op.y2Mm + dy,
  }
}
