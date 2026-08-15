import { useEffect, useMemo } from 'react'
import { calcularGrade } from '@/core/layout'
import { filaEtiquetas, temEstoque } from '@/core/produtos'
import { ordenar } from '@/core/ordenacao'
import { limitarAEtiqueta } from '@/core/etiqueta/encaixe'
import { montarFolhas } from '@/core/render/folha'
import { mm } from '@/core/layout'
import ExportBar from './ExportBar'
import FieldInspector from './FieldInspector'
import FinishSettings from './FinishSettings'
import Icone from './Icone'
import ImportPanel from './ImportPanel'
import LabelCanvas from './LabelCanvas'
import PageSettings from './PageSettings'
import Passo from './Passo'
import ProductTable from './ProductTable'
import SheetPreview from './SheetPreview'
import { filtrar, useApp } from '../store'

/** Passo das setas: 1 mm normal, 0,1 mm com Shift. */
const PASSO_MM = 1
const PASSO_FINO_MM = 0.1

/**
 * A aba de etiquetas: o fluxo de quatro passos que fecha no PDF.
 *
 * Os atalhos de teclado moram aqui, e nao no App, de proposito: montados no
 * App eles valeriam tambem na aba Estante, e um Delete digitado no campo de
 * correcao de classificacao apagaria o campo selecionado do editor.
 */
export default function AbaEtiquetas() {
  const {
    planilha,
    nomeArquivo,
    pagina,
    grade,
    corte,
    selecionados,
    quantidades,
    multiplicarPorEstoque,
    busca,
    categoria,
    soAtivos,
    ordem,
    modelo,
    pularCelulas,
    campoSelecionado,
    passosAbertos,
    alternarPasso,
    descartar,
    moverCampo,
    marcarHistorico,
    removerSelecionado,
    duplicarSelecionado,
    desfazer,
    refazer,
  } = useApp()

  const resultado = useMemo(() => calcularGrade(pagina, grade), [pagina, grade])

  // Mesma sequência da tabela: filtra, ordena, e só então expande em etiquetas.
  const fila = useMemo(() => {
    if (!planilha) return []
    const visiveis = ordenar(planilha, filtrar(planilha, { busca, categoria, soAtivos }), ordem)
    const multiplicando = temEstoque(planilha) && multiplicarPorEstoque
    return filaEtiquetas(planilha, visiveis, selecionados, quantidades, multiplicando)
  }, [planilha, busca, categoria, soAtivos, ordem, selecionados, quantidades, multiplicarPorEstoque])

  const primeiraLinha = planilha && fila.length > 0 ? (planilha.linhas[fila[0]!] ?? null) : null

  // As folhas alimentam o PDF, a impressão e a lista de problemas. Montar uma
  // vez só evita percorrer a fila três vezes a cada tecla digitada.
  const folhas = useMemo(() => {
    if (!planilha) return { paginas: [], problemas: [], totalEtiquetas: 0 }
    return montarFolhas({ planilha, fila, modelo, grade, resultado, pularCelulas, corte })
  }, [planilha, fila, modelo, grade, resultado, pularCelulas, corte])

  // Atalhos de teclado do editor.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      // Nunca sequestrar teclas de quem está digitando num campo.
      if (alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) return

      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) refazer()
        else desfazer()
        return
      }

      if (!campoSelecionado) return
      const campo = modelo.campos.find((c) => c.id === campoSelecionado)
      if (!campo || campo.travado) return

      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicarSelecionado()
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removerSelecionado()
        return
      }

      const passoMm = e.shiftKey ? PASSO_FINO_MM : PASSO_MM
      const dx = passoMm / Math.max(1, resultado.etiqueta.larguraMm)
      const dy = passoMm / Math.max(1, resultado.etiqueta.alturaMm)

      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-dx, 0],
        ArrowRight: [dx, 0],
        ArrowUp: [0, -dy],
        ArrowDown: [0, dy],
      }
      const passo = delta[e.key]
      if (!passo) return

      e.preventDefault()
      marcarHistorico()
      moverCampo(
        campo.id,
        limitarAEtiqueta({ x: campo.x + passo[0], y: campo.y + passo[1], w: campo.w, h: campo.h }),
      )
    }

    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [
    campoSelecionado,
    modelo,
    resultado,
    moverCampo,
    marcarHistorico,
    removerSelecionado,
    duplicarSelecionado,
    desfazer,
    refazer,
  ])

  const marcados = selecionados.size

  return (
    <div className="fluxo">
      <Passo
        numero={1}
        icone="importar"
        titulo="Importar CSV"
        concluido={!!planilha}
        aberto={!planilha || !!passosAbertos['importar']}
        aoAlternar={() => alternarPasso('importar')}
        resumo={
          planilha ? (
            <>
              <Icone nome="arquivo" tamanho={13} /> {nomeArquivo} · {planilha.linhas.length}{' '}
              produtos
            </>
          ) : undefined
        }
        acoes={
          planilha ? (
            <button type="button" className="secundario" onClick={descartar}>
              Trocar arquivo
            </button>
          ) : undefined
        }
      >
        <ImportPanel />
      </Passo>

      {planilha && (
        <>
          <Passo
            numero={2}
            icone="lista"
            titulo="Escolher produtos"
            concluido={marcados > 0}
            aberto={!!passosAbertos['produtos']}
            aoAlternar={() => alternarPasso('produtos')}
            resumo={`${marcados} de ${planilha.linhas.length} produtos · ${fila.length} etiquetas`}
          >
            <ProductTable planilha={planilha} />
          </Passo>

          <Passo
            numero={3}
            icone="etiqueta"
            titulo="Desenhar a etiqueta"
            concluido={modelo.campos.length > 0}
            aberto={!!passosAbertos['etiqueta']}
            aoAlternar={() => alternarPasso('etiqueta')}
            resumo={`${modelo.campos.length} campos · ${mm(resultado.etiqueta.larguraMm)} × ${mm(resultado.etiqueta.alturaMm)} mm`}
          >
            <div className="oficina">
              <FieldInspector
                planilha={planilha}
                larguraMm={resultado.etiqueta.larguraMm}
                alturaMm={resultado.etiqueta.alturaMm}
              />
              <LabelCanvas
                modelo={modelo}
                linha={primeiraLinha}
                larguraMm={resultado.etiqueta.larguraMm}
                alturaMm={resultado.etiqueta.alturaMm}
              />
            </div>
          </Passo>

          <Passo
            numero={4}
            icone="folha"
            titulo="Página, grade e acabamento"
            concluido={resultado.valida}
            aberto={!!passosAbertos['folha']}
            aoAlternar={() => alternarPasso('folha')}
            resumo={`${mm(resultado.pagina.larguraMm)} × ${mm(resultado.pagina.alturaMm)} mm · ${resultado.colunas} × ${resultado.linhas} · ${folhas.paginas.length} folhas`}
          >
            <div className="montagem">
              <div className="ajustes">
                <PageSettings resultado={resultado} />
                <FinishSettings />
              </div>
              <SheetPreview folhas={folhas} />
            </div>
          </Passo>

          <ExportBar folhas={folhas} />
        </>
      )}
    </div>
  )
}
