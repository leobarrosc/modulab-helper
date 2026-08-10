import { desenharCodigo, type DiagnosticoCodigo } from '../render/codigo'
import { PT_EM_MM, type DrawOp, type Fonte } from '../render/tipos'
import { codificar } from '../simbologia/codificar'
import { acharSimbologia } from '../simbologia/registro'
import {
  alturaLinha,
  cortarComReticencias,
  larguraTexto,
  quebrarLinhas,
  tamanhoQueCabe,
} from './metricas'
import { resolver, type ContextoResolucao } from './resolver'
import type { Campo, FonteCampo, FonteMedida, Modelo } from './tipos'

export interface CaixaEtiqueta {
  xMm: number
  yMm: number
  larguraMm: number
  alturaMm: number
}

export interface ProblemaCampo {
  campoId: string
  campoNome: string
  mensagem: string
}

export interface EtiquetaRenderizada {
  ops: DrawOp[]
  problemas: ProblemaCampo[]
  diagnosticos: Record<string, DiagnosticoCodigo>
}

/**
 * Menor altura de letra que uma impressora termica ainda resolve. Abaixo disso
 * o texto borra e vira mancha -- o equivalente tipografico do modulo fino
 * demais no codigo de barras.
 */
export const TEXTO_MINIMO_MM = 1.2

export const FONTE_PADRAO: FonteCampo = {
  familia: 'Helvetica',
  tamanhoPct: 0.09,
  negrito: false,
  italico: false,
}

/** A fracao vira mm usando a ALTURA da etiqueta como base. */
export function resolverFonte(fonte: FonteCampo, alturaEtiquetaMm: number): FonteMedida {
  return {
    familia: fonte.familia,
    tamanhoMm: Math.max(0, fonte.tamanhoPct) * alturaEtiquetaMm,
    negrito: fonte.negrito,
    italico: fonte.italico,
  }
}

/** Fronteira com o backend de desenho: o pt só existe aqui. */
const paraFonteDrawOp = (f: FonteMedida): Fonte => ({
  familia: f.familia,
  tamanhoPt: f.tamanhoMm / PT_EM_MM,
  negrito: f.negrito,
  italico: f.italico,
})

/** Retangulo do campo em mm absolutos. */
function caixaDoCampo(campo: Campo, caixa: CaixaEtiqueta) {
  return {
    xMm: caixa.xMm + campo.x * caixa.larguraMm,
    yMm: caixa.yMm + campo.y * caixa.alturaMm,
    larguraMm: campo.w * caixa.larguraMm,
    alturaMm: campo.h * caixa.alturaMm,
  }
}

export function renderizarEtiqueta(
  modelo: Modelo,
  contexto: ContextoResolucao,
  caixa: CaixaEtiqueta,
): EtiquetaRenderizada {
  const ops: DrawOp[] = []
  const problemas: ProblemaCampo[] = []
  const diagnosticos: Record<string, DiagnosticoCodigo> = {}

  // A borda entra ANTES dos campos, para nunca cobrir um código de barras.
  if (modelo.borda?.mostrar) {
    const espessura = Math.max(0.05, modelo.borda.espessuraMm)
    ops.push({
      op: 'rect',
      // Recua meia espessura: o traço é centrado na linha, e sem o recuo
      // metade dele cairia fora da etiqueta, invadindo a vizinha.
      xMm: caixa.xMm + espessura / 2,
      yMm: caixa.yMm + espessura / 2,
      larguraMm: Math.max(0, caixa.larguraMm - espessura),
      alturaMm: Math.max(0, caixa.alturaMm - espessura),
      cinza: modelo.borda.cinza,
      preenchido: false,
      espessuraMm: espessura,
    })
  }

  for (const campo of modelo.campos) {
    const area = caixaDoCampo(campo, caixa)
    if (area.larguraMm <= 0 || area.alturaMm <= 0) continue

    if (campo.tipo === 'caixa') {
      ops.push({
        op: 'rect',
        xMm: area.xMm,
        yMm: area.yMm,
        larguraMm: area.larguraMm,
        alturaMm: area.alturaMm,
        cinza: campo.cinza,
        preenchido: campo.preenchido ?? false,
        espessuraMm: campo.espessuraMm ?? 0.3,
      })
      continue
    }

    if (campo.tipo === 'linha') {
      const y = area.yMm + area.alturaMm / 2
      ops.push({
        op: 'linha',
        x1Mm: area.xMm,
        y1Mm: y,
        x2Mm: area.xMm + area.larguraMm,
        y2Mm: y,
        espessuraMm: campo.espessuraMm ?? 0.3,
        cinza: campo.cinza,
      })
      continue
    }

    const valor = resolver(campo.template, contexto)

    if (campo.tipo === 'texto') {
      if (!valor) continue
      const desenho = desenharTexto(campo, valor, area, caixa.alturaMm)
      ops.push(...desenho.ops)
      if (desenho.miudo) {
        problemas.push({
          campoId: campo.id,
          campoNome: campo.nome,
          mensagem: `letra de ${desenho.tamanhoMm.toFixed(2)} mm — pequena demais para imprimir. Aumente a % ou a etiqueta.`,
        })
      }
      continue
    }

    // ---- codigo ----
    if (!valor) {
      problemas.push({
        campoId: campo.id,
        campoNome: campo.nome,
        mensagem: `Sem valor para "${campo.template}".`,
      })
      continue
    }

    const resultado = codificar(campo.simbologia ?? 'code128', valor)
    if (!resultado.ok) {
      problemas.push({ campoId: campo.id, campoNome: campo.nome, mensagem: resultado.erro })
      continue
    }

    const fonteLegenda = resolverFonte(
      { ...FONTE_PADRAO, tamanhoPct: campo.legendaPct ?? 0.07 },
      caixa.alturaMm,
    )
    const alturaLegenda = campo.mostrarLegenda ? alturaLinha(fonteLegenda) : 0
    const alturaCodigo = area.alturaMm - alturaLegenda

    if (alturaCodigo <= 0) {
      problemas.push({
        campoId: campo.id,
        campoNome: campo.nome,
        mensagem: 'Sem altura para o código. Aumente o campo ou reduza a legenda.',
      })
      continue
    }

    const desenho = desenharCodigo(
      resultado.simbolo,
      { xMm: area.xMm, yMm: area.yMm, larguraMm: area.larguraMm, alturaMm: alturaCodigo },
      campo.cinza,
    )
    ops.push(...desenho.ops)
    diagnosticos[campo.id] = desenho.diagnostico

    if (!desenho.diagnostico.legivel) {
      const nome = acharSimbologia(campo.simbologia ?? '')?.nome ?? 'Código'
      problemas.push({
        campoId: campo.id,
        campoNome: campo.nome,
        mensagem: `${nome}: barra de ${desenho.diagnostico.moduloMm.toFixed(2)} mm — fina demais para um leitor.`,
      })
    }

    if (campo.mostrarLegenda) {
      ops.push({
        op: 'texto',
        xMm: area.xMm + area.larguraMm / 2,
        yMm: area.yMm + area.alturaMm - fonteLegenda.tamanhoMm * 0.25,
        texto: valor,
        fonte: paraFonteDrawOp(fonteLegenda),
        alinhamento: 'centro',
        cinza: campo.cinza,
      })
    }
  }

  return { ops, problemas, diagnosticos }
}

function desenharTexto(
  campo: Campo,
  valor: string,
  area: { xMm: number; yMm: number; larguraMm: number; alturaMm: number },
  alturaEtiquetaMm: number,
): { ops: DrawOp[]; miudo: boolean; tamanhoMm: number } {
  let fonte = resolverFonte(campo.fonte ?? FONTE_PADRAO, alturaEtiquetaMm)

  const maxLinhas = Math.max(1, campo.maxLinhas ?? 1)
  const ajuste = campo.ajuste ?? 'encolher'
  let linhas: string[]

  if (maxLinhas > 1) {
    linhas = quebrarLinhas(valor, fonte, area.larguraMm, maxLinhas)
  } else if (ajuste === 'encolher') {
    fonte = { ...fonte, tamanhoMm: tamanhoQueCabe(valor, fonte, area.larguraMm) }
    linhas = [valor]
  } else if (ajuste === 'reticencias') {
    linhas = [cortarComReticencias(valor, fonte, area.larguraMm)]
  } else {
    linhas = [valor]
  }

  // Nao deixa o bloco de texto passar da altura do campo.
  if (linhas.length * alturaLinha(fonte) > area.alturaMm && linhas.length > 1) {
    const cabem = Math.max(1, Math.floor(area.alturaMm / alturaLinha(fonte)))
    linhas = linhas.slice(0, cabem)
  }

  const alinhamento = campo.alinhamento ?? 'esquerda'
  const x =
    alinhamento === 'centro'
      ? area.xMm + area.larguraMm / 2
      : alinhamento === 'direita'
        ? area.xMm + area.larguraMm
        : area.xMm

  const ops: DrawOp[] = linhas.map((linha, i) => ({
    op: 'texto' as const,
    xMm: x,
    // `yMm` do texto e a linha de base, por isso soma a altura da fonte.
    yMm: area.yMm + fonte.tamanhoMm + i * alturaLinha(fonte),
    texto: linha,
    fonte: paraFonteDrawOp(fonte),
    alinhamento,
    cinza: campo.cinza,
  }))

  return { ops, miudo: fonte.tamanhoMm < TEXTO_MINIMO_MM, tamanhoMm: fonte.tamanhoMm }
}

export { larguraTexto }
