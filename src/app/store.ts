import { create } from 'zustand'
import { lerCsv, type Planilha } from '@/core/csv'
import {
  FONTE_CODIGO_PADRAO,
  fonteEfetiva,
  purgarBloqueadas,
  selecaoInicial,
  type FonteCodigo,
} from '@/core/produtos'
import { proximaOrdem, type Ordem } from '@/core/ordenacao'
import {
  adicionarCampo,
  atualizarCampo,
  criarCampo,
  duplicarCampo,
  modeloPadrao,
  removerCampo,
  reordenarCampo,
} from '@/core/etiqueta/modelo'
import { OPCOES_ENCAIXE_PADRAO, type OpcoesEncaixe, type Retangulo } from '@/core/etiqueta/encaixe'
import { BORDA_PADRAO } from '@/core/etiqueta/tipos'
import type { BordaEtiqueta, Campo, Modelo, TipoCampo } from '@/core/etiqueta/tipos'
import {
  desfazer as desfazerHistorico,
  HISTORICO_VAZIO,
  refazer as refazerHistorico,
  registrar,
  type Historico,
} from './storeEtiqueta'
import { lerModelo } from '@/core/etiqueta/serializar'
import {
  conferenciasDoEstado,
  correcoesDoEstado,
  estantesDoEstado,
  largurasDoEstado,
  modeloDoEstado,
  ordemCoresDoEstado,
  ordemCoresPorGrupoDoEstado,
  ordemMarcasDoEstado,
  ordemTiposDoEstado,
  palavrasIgnoradasDoEstado,
  salvosDoEstado,
  type EstadoPersistido,
  type ModeloSalvo,
} from './armazenamento'
import {
  comItensNovos,
  criarEstante,
  iniciarConferencia,
  marcarCelula,
  moverItem,
  moverItemParaIndice,
  LIMITES_ESTANTE,
  ordemCoresPadrao,
  podarConferencia,
  regraVazia,
  type CorrecaoClassificacao,
  type EstadoConferencia,
  type RegraAndar,
  type TemplateEstante,
} from '@/core/estante'
import {
  acharPreset,
  calcularGrade,
  CORTE_PADRAO,
  GRADE_PADRAO,
  paginaDoPreset,
  PRESET_PADRAO,
  type ConfigCorte,
  type Grade,
  type Margens,
  type ModoGrade,
  type Orientacao,
  type Pagina,
  type PresetId,
} from '@/core/layout'

/** Colunas mostradas na tabela, em ordem, se existirem no arquivo. */
const COLUNAS_PREFERIDAS = [
  'Código',
  'Descrição',
  'Preço',
  'Estoque',
  'Categoria do produto',
] as const

const COLUNA_SITUACAO = 'Situação'
const COLUNA_CATEGORIA = 'Categoria do produto'

/** As duas missoes do app. Compartilham o CSV e mais nada. */
export type Aba = 'etiquetas' | 'estante'

/** Os dois eixos com ordem escolhida a mao. A mecanica e a mesma nos dois. */
export type EixoOrdem = 'marcas' | 'tipos'

const CHAVE_ORDEM: Record<EixoOrdem, 'ordemMarcas' | 'ordemTipos'> = {
  marcas: 'ordemMarcas',
  tipos: 'ordemTipos',
}

export const ABAS: readonly Aba[] = ['etiquetas', 'estante']

export interface EstadoApp {
  planilha: Planilha | null
  nomeArquivo: string | null
  erro: string | null
  carregando: boolean

  selecionados: Set<number>
  quantidades: Map<number, number>

  busca: string
  categoria: string
  soAtivos: boolean
  /** Uma etiqueta por unidade em estoque, em vez de uma por produto. */
  multiplicarPorEstoque: boolean
  /** Coluna do CSV que alimenta o codigo de barras. */
  fonteCodigo: FonteCodigo
  /** Ordem da lista -- e tambem a ordem de impressao. `null` = ordem do arquivo. */
  ordem: Ordem | null

  pagina: Pagina
  grade: Grade
  /** Celulas em branco no inicio, para reaproveitar folha ja usada. */
  pularCelulas: number
  /** Pagina sendo mostrada no preview (base 0). */
  paginaAtual: number
  /** Modelo da etiqueta: os campos arrastaveis. */
  modelo: Modelo
  historico: Historico
  campoSelecionado: string | null
  encaixe: OpcoesEncaixe

  /** Guia de corte para papel adesivo. */
  corte: ConfigCorte
  /** Quais passos do fluxo estao abertos. */
  passosAbertos: Record<string, boolean>

  /** Modelos com nome, guardados pelo usuario. */
  salvos: ModeloSalvo[]
  /** Avisos da ultima importacao/restauracao de modelo. */
  avisosModelo: string[]

  /** Qual das duas missoes esta na tela: imprimir etiqueta ou conferir estante. */
  abaAtiva: Aba
  /** Estantes cadastradas. */
  estantes: TemplateEstante[]
  estanteAtivaId: string | null
  /** Correcoes manuais de Marca/Tipo/Cor, por Código do produto. */
  correcoesClassificacao: Record<string, CorrecaoClassificacao>
  /** Ordem dos tipos de filamento, arrastavel pelo usuario. */
  ordemTipos: string[]
  /** Ordem das marcas: como marca nova quebra andar, e ela que decide os andares. */
  ordemMarcas: string[]
  /** Ordem das cores da estante inteira, por chave de cor. */
  ordemCores: string[]
  /** Excecoes de ordem de cor por `chaveGrupo(marca, tipo)`. */
  ordemCoresPorGrupo: Record<string, string[]>
  /** Palavras que o usuario mandou ignorar ao extrair a cor da descricao. */
  palavrasIgnoradas: string[]
  /** Quantas colunas cada produto ocupa, por Código. Ausente = 1. */
  largurasCelula: Record<string, number>
  /** Conferencia em andamento, por id de estante. */
  conferencias: Record<string, EstadoConferencia>

  importar: (arquivo: File) => Promise<void>
  descartar: () => void
  alternar: (i: number) => void
  definirQuantidade: (i: number, n: number) => void
  marcarVisiveis: (indices: number[], marcar: boolean) => void
  setBusca: (v: string) => void
  setCategoria: (v: string) => void
  setSoAtivos: (v: boolean) => void
  setMultiplicarPorEstoque: (v: boolean) => void
  setFonteCodigo: (v: FonteCodigo) => void
  alternarOrdem: (coluna: string) => void

  setPreset: (id: PresetId) => void
  setOrientacao: (o: Orientacao) => void
  setPaginaMm: (lado: 'larguraMm' | 'alturaMm', valor: number) => void
  setGrade: (mudanca: Partial<Omit<Grade, 'margens' | 'modo'>>) => void
  setModoGrade: (modo: ModoGrade) => void
  setMargem: (lado: keyof Margens, valor: number) => void
  setPularCelulas: (n: number) => void
  setPaginaAtual: (n: number) => void

  selecionarCampo: (id: string | null) => void
  adicionar: (tipo: TipoCampo) => void
  editarCampo: (id: string, mudanca: Partial<Campo>) => void
  /** Move/redimensiona durante o arraste: NAO registra no historico a cada pixel. */
  moverCampo: (id: string, retangulo: Retangulo) => void
  removerSelecionado: () => void
  duplicarSelecionado: () => void
  reordenar: (id: string, delta: number) => void
  setEncaixe: (mudanca: Partial<OpcoesEncaixe>) => void
  desfazer: () => void
  refazer: () => void
  /** Marca um ponto no historico antes de comecar uma alteracao. */
  marcarHistorico: () => void

  setCorte: (mudanca: Partial<ConfigCorte>) => void
  setBorda: (mudanca: Partial<BordaEtiqueta>) => void
  alternarPasso: (id: string) => void

  /** Aplica o que estava gravado no chrome.storage, na abertura. */
  hidratar: (estado: EstadoPersistido) => void
  salvarModeloAtual: (nome: string) => void
  aplicarSalvo: (nome: string) => void
  excluirSalvo: (nome: string) => void
  importarModeloJson: (texto: string, nomeArquivo: string) => void
  dispensarAvisosModelo: () => void

  setAbaAtiva: (aba: Aba) => void
  novaEstante: () => void
  atualizarEstante: (id: string, mudanca: Partial<Omit<TemplateEstante, 'id'>>) => void
  excluirEstante: (id: string) => void
  selecionarEstante: (id: string) => void
  corrigirClassificacao: (codigo: string, mudanca: Partial<CorrecaoClassificacao>) => void
  limparCorrecao: (codigo: string) => void
  /** Acrescenta ao fim os nomes que apareceram no CSV e ainda nao tinham lugar. */
  sincronizarOrdem: (eixo: EixoOrdem, presentes: string[]) => void
  mover: (eixo: EixoOrdem, nome: string, delta: number) => void
  moverParaIndice: (eixo: EixoOrdem, nome: string, destino: number) => void
  marcarCelulaConferencia: (
    estanteId: string,
    codigo: string,
    indicePosicao: number,
    marcado: boolean,
    capacidade: number,
  ) => void
  novaConferencia: (estanteId: string) => void
  /** Descarta marcacoes de produtos que sairam da estante. */
  podarConferenciaDaEstante: (estanteId: string, codigosNoPlano: ReadonlySet<string>) => void

  moverCor: (chave: string, delta: number, grupo?: string) => void
  moverCorParaIndice: (chave: string, destino: number, grupo?: string) => void
  /** Cria a excecao de ordem de cor do grupo, copiando a ordem geral. */
  criarOrdemCoresDoGrupo: (grupo: string) => void
  /** Remove a excecao: o grupo volta a seguir a ordem geral. */
  limparOrdemCoresDoGrupo: (grupo: string) => void
  setPalavrasIgnoradas: (palavras: string[]) => void
  alternarMarcaPermitida: (estanteId: string, marca: string) => void
  alternarAndarBloqueado: (estanteId: string, andar: number) => void
  /** Quantas colunas o produto ocupa. 1 volta ao padrao. */
  setLarguraCelula: (codigo: string, largura: number) => void
  definirRegraAndar: (estanteId: string, regra: RegraAndar) => void
  limparRegraAndar: (estanteId: string, andar: number) => void
}

/**
 * A estante de fabrica, criada uma vez. Se o storage trouxer estantes, esta e
 * substituida na hidratacao.
 */
const ESTANTE_INICIAL = criarEstante()

export const useApp = create<EstadoApp>((set, get) => ({
  planilha: null,
  nomeArquivo: null,
  erro: null,
  carregando: false,

  selecionados: new Set(),
  quantidades: new Map(),

  busca: '',
  categoria: '',
  soAtivos: true,
  multiplicarPorEstoque: true,
  fonteCodigo: FONTE_CODIGO_PADRAO,
  ordem: null,

  pagina: paginaDoPreset(PRESET_PADRAO),
  grade: GRADE_PADRAO,
  pularCelulas: 0,
  paginaAtual: 0,
  modelo: modeloPadrao(),
  historico: HISTORICO_VAZIO,
  campoSelecionado: null,
  encaixe: OPCOES_ENCAIXE_PADRAO,
  corte: CORTE_PADRAO,
  passosAbertos: {
    importar: true,
    produtos: true,
    etiqueta: true,
    folha: true,
    // Na estante o que interessa e o mapa e a lista: os ajustes ficam
    // recolhidos ate alguem precisar deles.
    'estante-template': false,
    'estante-correcao': false,
    'estante-mapa': true,
    'estante-reposicao': true,
  },
  salvos: [],
  avisosModelo: [],

  abaAtiva: 'etiquetas',
  estantes: [ESTANTE_INICIAL],
  estanteAtivaId: ESTANTE_INICIAL.id,
  correcoesClassificacao: {},
  ordemTipos: [],
  ordemMarcas: [],
  ordemCores: ordemCoresPadrao(),
  ordemCoresPorGrupo: {},
  palavrasIgnoradas: [],
  largurasCelula: {},
  conferencias: {},

  async importar(arquivo) {
    set({ carregando: true, erro: null })
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer())
      const planilha = lerCsv(bytes)
      // Se a coluna escolhida nao existir neste arquivo, cai na que existir.
      const fonteCodigo = fonteEfetiva(planilha, get().fonteCodigo)
      set({
        planilha,
        nomeArquivo: arquivo.name,
        carregando: false,
        fonteCodigo,
        // Fica de fora o que esta sem estoque e o que esta sem codigo.
        selecionados: selecaoInicial(planilha, fonteCodigo),
        quantidades: new Map(),
        busca: '',
        categoria: '',
        ordem: null,
        // Importou: o passo se recolhe e sai da frente, mas continua a um
        // clique de distância no cabeçalho.
        passosAbertos: { ...get().passosAbertos, importar: false },
      })
    } catch (e) {
      set({
        carregando: false,
        erro: e instanceof Error ? e.message : 'Nao foi possivel ler o arquivo.',
      })
    }
  },

  descartar() {
    set({
      planilha: null,
      nomeArquivo: null,
      erro: null,
      selecionados: new Set(),
      quantidades: new Map(),
      busca: '',
      categoria: '',
      passosAbertos: { ...get().passosAbertos, importar: true },
    })
  },

  alternar(i) {
    const proximo = new Set(get().selecionados)
    if (proximo.has(i)) proximo.delete(i)
    else proximo.add(i)
    set({ selecionados: proximo })
  },

  definirQuantidade(i, n) {
    const proximo = new Map(get().quantidades)
    const limitado = Math.min(999, Math.max(1, Math.trunc(n) || 1))
    if (limitado === 1) proximo.delete(i)
    else proximo.set(i, limitado)
    set({ quantidades: proximo })
  },

  marcarVisiveis(indices, marcar) {
    const proximo = new Set(get().selecionados)
    for (const i of indices) {
      if (marcar) proximo.add(i)
      else proximo.delete(i)
    }
    set({ selecionados: proximo })
  },

  setBusca: (busca) => set({ busca }),
  setCategoria: (categoria) => set({ categoria }),
  setSoAtivos: (soAtivos) => set({ soAtivos }),
  setMultiplicarPorEstoque(multiplicarPorEstoque) {
    const { planilha, selecionados } = get()
    set({
      multiplicarPorEstoque,
      // Ligar o multiplicador trava as linhas sem estoque; tira-las da selecao
      // evita um item marcado no estado e desenhado como travado na tela.
      selecionados: planilha
        ? purgarBloqueadas(planilha, selecionados, multiplicarPorEstoque)
        : selecionados,
    })
  },

  setFonteCodigo(fonteCodigo) {
    const { planilha } = get()
    // Trocar a fonte muda quais linhas ficam sem codigo, entao a selecao volta
    // ao padrao da nova fonte. Preservar a antiga deixaria linhas desmarcadas
    // que agora tem codigo, sem nenhuma pista do porque.
    set({
      fonteCodigo,
      selecionados: planilha ? selecaoInicial(planilha, fonteCodigo) : new Set<number>(),
    })
  },

  alternarOrdem(coluna) {
    set({ ordem: proximaOrdem(get().ordem, coluna) })
  },

  setPreset(id) {
    const { pagina, grade } = get()
    const preset = acharPreset(id)
    set({
      pagina: paginaDoPreset(id, pagina.orientacao),
      // Trocar de papel troca junto a grade que faz sentido nele: 3x8 numa A4,
      // 1x1 numa etiquetadora. "Personalizado" nao mexe na grade.
      grade: preset ? { ...grade, ...preset.gradeSugerida } : grade,
      paginaAtual: 0,
    })
  },

  setOrientacao(orientacao) {
    set({ pagina: { ...get().pagina, orientacao }, paginaAtual: 0 })
  },

  setPaginaMm(lado, valor) {
    const limitado = Math.min(2000, Math.max(10, valor || 0))
    // Mexer nas medidas na mao deixa de ser um preset conhecido.
    set({ pagina: { ...get().pagina, [lado]: limitado, preset: 'personalizado' }, paginaAtual: 0 })
  },

  setGrade(mudanca) {
    const grade = { ...get().grade, ...mudanca }
    set({
      grade: {
        ...grade,
        colunas: Math.min(50, Math.max(1, Math.trunc(grade.colunas) || 1)),
        linhas: Math.min(50, Math.max(1, Math.trunc(grade.linhas) || 1)),
        etiquetaLarguraMm: Math.max(0, grade.etiquetaLarguraMm || 0),
        etiquetaAlturaMm: Math.max(0, grade.etiquetaAlturaMm || 0),
        espacoXMm: Math.max(0, grade.espacoXMm || 0),
        espacoYMm: Math.max(0, grade.espacoYMm || 0),
      },
      paginaAtual: 0,
    })
  },

  setModoGrade(modo) {
    const { pagina, grade } = get()
    if (modo === grade.modo) return

    const atual = calcularGrade(pagina, grade)

    // Trocar de modo nao muda o que esta na tela: leva o resultado atual para
    // os campos do modo novo. Sem isso, ir para "por tamanho" saltaria para um
    // valor arbitrario e o usuario perderia o layout que acabou de montar.
    //
    // O arredondamento e para BAIXO de proposito. Uma largura de 66,666... mm
    // arredondada para 66,7 faz 3 colunas somarem 0,1 mm a mais que a area
    // util, e a grade perde uma coluna inteira na troca de modo.
    const paraBaixo = (v: number) => Math.floor(v * 10) / 10

    set({
      grade:
        modo === 'porEtiqueta'
          ? {
              ...grade,
              modo,
              etiquetaLarguraMm: paraBaixo(atual.etiqueta.larguraMm),
              etiquetaAlturaMm: paraBaixo(atual.etiqueta.alturaMm),
            }
          : { ...grade, modo, colunas: Math.max(1, atual.colunas), linhas: Math.max(1, atual.linhas) },
      paginaAtual: 0,
    })
  },

  setMargem(lado, valor) {
    const { grade } = get()
    set({
      grade: { ...grade, margens: { ...grade.margens, [lado]: Math.max(0, valor || 0) } },
      paginaAtual: 0,
    })
  },

  setPularCelulas(n) {
    set({ pularCelulas: Math.max(0, Math.trunc(n) || 0), paginaAtual: 0 })
  },

  setPaginaAtual(n) {
    set({ paginaAtual: Math.max(0, Math.trunc(n) || 0) })
  },

  selecionarCampo(campoSelecionado) {
    set({ campoSelecionado })
  },

  marcarHistorico() {
    const { historico, modelo } = get()
    set({ historico: registrar(historico, modelo) })
  },

  adicionar(tipo) {
    const { modelo, historico, fonteCodigo } = get()
    const campo = criarCampo(tipo, tipo === 'codigo' ? { template: `{${fonteCodigo}}` } : {})
    set({
      historico: registrar(historico, modelo),
      modelo: adicionarCampo(modelo, campo),
      campoSelecionado: campo.id,
    })
  },

  editarCampo(id, mudanca) {
    const { modelo, historico } = get()
    set({ historico: registrar(historico, modelo), modelo: atualizarCampo(modelo, id, mudanca) })
  },

  moverCampo(id, retangulo) {
    // Sem registrar historico: quem marca o ponto e o inicio do arraste, senao
    // um Ctrl+Z desfaria um pixel de cada vez.
    set({ modelo: atualizarCampo(get().modelo, id, retangulo) })
  },

  removerSelecionado() {
    const { modelo, historico, campoSelecionado } = get()
    if (!campoSelecionado) return
    set({
      historico: registrar(historico, modelo),
      modelo: removerCampo(modelo, campoSelecionado),
      campoSelecionado: null,
    })
  },

  duplicarSelecionado() {
    const { modelo, historico, campoSelecionado } = get()
    if (!campoSelecionado) return
    const r = duplicarCampo(modelo, campoSelecionado)
    set({ historico: registrar(historico, modelo), modelo: r.modelo, campoSelecionado: r.novoId })
  },

  reordenar(id, delta) {
    const { modelo, historico } = get()
    set({ historico: registrar(historico, modelo), modelo: reordenarCampo(modelo, id, delta) })
  },

  setEncaixe(mudanca) {
    set({ encaixe: { ...get().encaixe, ...mudanca } })
  },

  desfazer() {
    const r = desfazerHistorico(get().historico, get().modelo)
    if (r) set({ modelo: r.modelo, historico: r.historico })
  },

  refazer() {
    const r = refazerHistorico(get().historico, get().modelo)
    if (r) set({ modelo: r.modelo, historico: r.historico })
  },

  setCorte(mudanca) {
    set({ corte: { ...get().corte, ...mudanca } })
  },

  setBorda(mudanca) {
    const { modelo, historico } = get()
    set({
      historico: registrar(historico, modelo),
      modelo: { ...modelo, borda: { ...BORDA_PADRAO, ...modelo.borda, ...mudanca } },
    })
  },

  alternarPasso(id) {
    const atual = get().passosAbertos
    set({ passosAbertos: { ...atual, [id]: !atual[id] } })
  },

  hidratar(estado) {
    const restaurado = modeloDoEstado(estado)

    // `null` = a chave nunca foi gravada, e a estante de fabrica continua
    // valendo. Uma lista vazia gravada e decisao do usuario e e respeitada.
    const estantes = estantesDoEstado(estado)
    const ativa =
      estantes && estado.estanteAtivaId && estantes.some((e) => e.id === estado.estanteAtivaId)
        ? estado.estanteAtivaId
        : (estantes?.[0]?.id ?? null)

    set({
      // O que estava gravado vale como padrao da sessao nova. So entra o que
      // sobreviver a validacao; o resto fica no valor de fabrica.
      ...(estado.pagina ? { pagina: estado.pagina } : {}),
      ...(estado.grade ? { grade: { ...GRADE_PADRAO, ...estado.grade } } : {}),
      ...(typeof estado.pularCelulas === 'number'
        ? { pularCelulas: Math.max(0, Math.trunc(estado.pularCelulas)) }
        : {}),
      ...(estado.fonteCodigo === 'GTIN/EAN' || estado.fonteCodigo === 'Código'
        ? { fonteCodigo: estado.fonteCodigo }
        : {}),
      ...(typeof estado.multiplicarPorEstoque === 'boolean'
        ? { multiplicarPorEstoque: estado.multiplicarPorEstoque }
        : {}),
      ...(typeof estado.soAtivos === 'boolean' ? { soAtivos: estado.soAtivos } : {}),
      ...(estado.encaixe ? { encaixe: { ...OPCOES_ENCAIXE_PADRAO, ...estado.encaixe } } : {}),
      ...(estado.corte ? { corte: { ...CORTE_PADRAO, ...estado.corte } } : {}),
      ...(restaurado ? { modelo: restaurado } : {}),
      salvos: salvosDoEstado(estado),

      ...(estado.abaAtiva === 'etiquetas' || estado.abaAtiva === 'estante'
        ? { abaAtiva: estado.abaAtiva }
        : {}),
      ...(estantes ? { estantes, estanteAtivaId: ativa } : {}),
      correcoesClassificacao: correcoesDoEstado(estado),
      ordemTipos: ordemTiposDoEstado(estado),
      ordemMarcas: ordemMarcasDoEstado(estado),
      ordemCores: ordemCoresDoEstado(estado),
      ordemCoresPorGrupo: ordemCoresPorGrupoDoEstado(estado),
      palavrasIgnoradas: palavrasIgnoradasDoEstado(estado),
      largurasCelula: largurasDoEstado(estado),
      conferencias: conferenciasDoEstado(estado),
    })
  },

  salvarModeloAtual(nome) {
    const limpo = nome.trim().slice(0, 60)
    if (!limpo) return
    const { modelo, salvos } = get()
    const copia: Modelo = { ...modelo, nome: limpo, campos: modelo.campos.map((c) => ({ ...c })) }
    set({
      // Mesmo nome substitui: e o que "salvar de novo" significa para o usuario.
      salvos: [...salvos.filter((s) => s.nome !== limpo), { nome: limpo, modelo: copia }],
    })
  },

  aplicarSalvo(nome) {
    const { salvos, modelo, historico } = get()
    const alvo = salvos.find((s) => s.nome === nome)
    if (!alvo) return
    set({
      historico: registrar(historico, modelo),
      modelo: { ...alvo.modelo, campos: alvo.modelo.campos.map((c) => ({ ...c })) },
      campoSelecionado: null,
    })
  },

  excluirSalvo(nome) {
    set({ salvos: get().salvos.filter((s) => s.nome !== nome) })
  },

  importarModeloJson(texto, nomeArquivo) {
    const { modelo, historico } = get()

    let bruto: unknown
    try {
      bruto = JSON.parse(texto)
    } catch {
      // A mensagem crua do JSON.parse vem em inglês técnico.
      set({ avisosModelo: [`"${nomeArquivo}" não é um JSON válido.`] })
      return
    }

    try {
      const nomePadrao = nomeArquivo.replace(/\.json$/i, '') || 'Importado'
      const r = lerModelo(bruto, nomePadrao)
      set({
        historico: registrar(historico, modelo),
        modelo: r.modelo,
        campoSelecionado: null,
        avisosModelo: r.avisos,
      })
    } catch (e) {
      set({
        avisosModelo: [e instanceof Error ? e.message : 'Não foi possível ler o arquivo.'],
      })
    }
  },

  dispensarAvisosModelo() {
    set({ avisosModelo: [] })
  },

  setAbaAtiva(aba) {
    set({ abaAtiva: aba })
  },

  novaEstante() {
    const nova = criarEstante({ nome: `Estante ${get().estantes.length + 1}` })
    set({ estantes: [...get().estantes, nova], estanteAtivaId: nova.id })
  },

  atualizarEstante(id, mudanca) {
    // Mudar a capacidade nao migra a conferencia: ela e ajustada na leitura,
    // entao aumentar acrescenta posicoes desmarcadas e diminuir corta as que
    // sobram, sem tocar no que ja foi conferido.
    set({
      estantes: get().estantes.map((e) => (e.id === id ? { ...e, ...mudanca, id } : e)),
    })
  },

  excluirEstante(id) {
    const restantes = get().estantes.filter((e) => e.id !== id)
    const { [id]: _removida, ...conferencias } = get().conferencias
    set({
      estantes: restantes,
      conferencias,
      estanteAtivaId:
        get().estanteAtivaId === id ? (restantes[0]?.id ?? null) : get().estanteAtivaId,
    })
  },

  selecionarEstante(id) {
    set({ estanteAtivaId: id })
  },

  corrigirClassificacao(codigo, mudanca) {
    if (!codigo) return
    const atual = get().correcoesClassificacao[codigo] ?? {}
    const correcao: CorrecaoClassificacao = { ...atual, ...mudanca }

    // Campo apagado volta ao derivado; correcao sem nada nao ocupa o storage.
    for (const chave of ['marca', 'tipo', 'cor'] as const) {
      if (correcao[chave] === undefined || correcao[chave]?.trim() === '') delete correcao[chave]
    }

    const proximo = { ...get().correcoesClassificacao }
    if (Object.keys(correcao).length === 0) delete proximo[codigo]
    else proximo[codigo] = correcao

    set({ correcoesClassificacao: proximo })
  },

  limparCorrecao(codigo) {
    const { [codigo]: _removida, ...resto } = get().correcoesClassificacao
    set({ correcoesClassificacao: resto })
  },

  sincronizarOrdem(eixo, presentes) {
    const chave = CHAVE_ORDEM[eixo]
    const proxima = comItensNovos(get()[chave], presentes)
    // `comItensNovos` devolve o mesmo array quando nao ha novidade -- comparar
    // por identidade evita um `set` inutil e o laco de render que viria dele.
    if (proxima !== get()[chave]) set({ [chave]: proxima })
  },

  mover(eixo, nome, delta) {
    const chave = CHAVE_ORDEM[eixo]
    set({ [chave]: moverItem(get()[chave], nome, delta) })
  },

  moverParaIndice(eixo, nome, destino) {
    const chave = CHAVE_ORDEM[eixo]
    set({ [chave]: moverItemParaIndice(get()[chave], nome, destino) })
  },

  marcarCelulaConferencia(estanteId, codigo, indicePosicao, marcado, capacidade) {
    const conferencias = get().conferencias
    const atual = conferencias[estanteId] ?? iniciarConferencia(new Date().toISOString())

    set({
      conferencias: {
        ...conferencias,
        [estanteId]: marcarCelula(atual, codigo, indicePosicao, marcado, capacidade),
      },
    })
  },

  novaConferencia(estanteId) {
    set({
      conferencias: {
        ...get().conferencias,
        [estanteId]: iniciarConferencia(new Date().toISOString()),
      },
    })
  },

  podarConferenciaDaEstante(estanteId, codigosNoPlano) {
    // Sem nenhum codigo no plano, nao ha o que concluir: pode ser CSV ausente
    // ou raiz de categoria mal preenchida, e podar ali apagaria a conferencia
    // inteira do usuario por causa de um campo digitado errado.
    if (codigosNoPlano.size === 0) return

    const conferencias = get().conferencias
    const atual = conferencias[estanteId]
    if (!atual) return

    const podada = podarConferencia(atual, codigosNoPlano)
    if (podada === atual) return

    set({ conferencias: { ...conferencias, [estanteId]: podada } })
  },

  moverCor(chave, delta, grupo) {
    aplicarNaOrdemDeCor(get, set, grupo, (ordem) => moverItem(ordem, chave, delta))
  },

  moverCorParaIndice(chave, destino, grupo) {
    aplicarNaOrdemDeCor(get, set, grupo, (ordem) => moverItemParaIndice(ordem, chave, destino))
  },

  criarOrdemCoresDoGrupo(grupo) {
    if (get().ordemCoresPorGrupo[grupo]) return
    set({ ordemCoresPorGrupo: { ...get().ordemCoresPorGrupo, [grupo]: [...get().ordemCores] } })
  },

  limparOrdemCoresDoGrupo(grupo) {
    const { [grupo]: _removida, ...resto } = get().ordemCoresPorGrupo
    set({ ordemCoresPorGrupo: resto })
  },

  setPalavrasIgnoradas(palavras) {
    const limpas: string[] = []
    const vistas = new Set<string>()
    for (const bruta of palavras) {
      const palavra = bruta.trim().slice(0, 40)
      const chave = palavra.toUpperCase()
      if (palavra === '' || vistas.has(chave)) continue
      vistas.add(chave)
      limpas.push(palavra)
    }
    set({ palavrasIgnoradas: limpas })
  },

  alternarMarcaPermitida(estanteId, marca) {
    const estante = get().estantes.find((e) => e.id === estanteId)
    if (!estante) return

    const dentro = estante.marcasPermitidas.includes(marca)
    const marcasPermitidas = dentro
      ? estante.marcasPermitidas.filter((m) => m !== marca)
      : [...estante.marcasPermitidas, marca]

    get().atualizarEstante(estanteId, { marcasPermitidas })
  },

  alternarAndarBloqueado(estanteId, andar) {
    const estante = get().estantes.find((e) => e.id === estanteId)
    if (!estante) return

    const bloqueado = estante.andaresBloqueados.includes(andar)
    const andaresBloqueados = bloqueado
      ? estante.andaresBloqueados.filter((a) => a !== andar)
      : [...estante.andaresBloqueados, andar].sort((a, b) => a - b)

    get().atualizarEstante(estanteId, { andaresBloqueados })
  },

  setLarguraCelula(codigo, largura) {
    if (!codigo) return
    const n = Math.min(
      LIMITES_ESTANTE.largura.max,
      Math.max(LIMITES_ESTANTE.largura.min, Math.trunc(largura) || 1),
    )

    const proximo = { ...get().largurasCelula }
    // 1 e o padrao: guardar seria ruido no storage.
    if (n === 1) delete proximo[codigo]
    else proximo[codigo] = n

    set({ largurasCelula: proximo })
  },

  definirRegraAndar(estanteId, regra) {
    const estante = get().estantes.find((e) => e.id === estanteId)
    if (!estante) return

    const outras = estante.regrasAndar.filter((r) => r.andar !== regra.andar)
    // Regra que nao restringe nada e o mesmo que nao ter regra.
    const regrasAndar = regraVazia(regra)
      ? outras
      : [...outras, regra].sort((a, b) => a.andar - b.andar)

    get().atualizarEstante(estanteId, { regrasAndar })
  },

  limparRegraAndar(estanteId, andar) {
    const estante = get().estantes.find((e) => e.id === estanteId)
    if (!estante) return
    get().atualizarEstante(estanteId, {
      regrasAndar: estante.regrasAndar.filter((r) => r.andar !== andar),
    })
  },
}))

/**
 * Aplica uma mudanca na ordem de cor certa: a do grupo, se houver excecao, ou a
 * geral. Evita repetir o mesmo `if` em cada action de mover cor.
 */
function aplicarNaOrdemDeCor(
  get: () => EstadoApp,
  set: (parcial: Partial<EstadoApp>) => void,
  grupo: string | undefined,
  transformar: (ordem: string[]) => string[],
): void {
  if (grupo && get().ordemCoresPorGrupo[grupo]) {
    const atual = get().ordemCoresPorGrupo[grupo]!
    set({ ordemCoresPorGrupo: { ...get().ordemCoresPorGrupo, [grupo]: transformar(atual) } })
    return
  }
  set({ ordemCores: transformar(get().ordemCores) })
}

/**
 * Colunas a exibir: as preferidas que existem, senao as 5 primeiras.
 * A fonte do codigo sai da lista porque ganha uma coluna propria na tabela.
 */
export function colunasVisiveis(planilha: Planilha, fonte: FonteCodigo): string[] {
  const preferidas = COLUNAS_PREFERIDAS.filter(
    (c) => c !== fonte && planilha.colunas.includes(c),
  )
  return preferidas.length > 0 ? [...preferidas] : planilha.colunas.slice(0, 5)
}

/** Categorias distintas, ordenadas. Vazio se a coluna nao existir. */
export function categoriasDe(planilha: Planilha): string[] {
  if (!planilha.colunas.includes(COLUNA_CATEGORIA)) return []
  const vistas = new Set<string>()
  for (const linha of planilha.linhas) {
    const v = linha[COLUNA_CATEGORIA]
    if (v) vistas.add(v)
  }
  return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export interface Filtro {
  busca: string
  categoria: string
  soAtivos: boolean
}

/** Indices das linhas que passam pelos filtros atuais. */
export function filtrar(planilha: Planilha, filtro: Filtro): number[] {
  const termo = filtro.busca.trim().toLocaleLowerCase('pt-BR')
  const temSituacao = planilha.colunas.includes(COLUNA_SITUACAO)
  const indices: number[] = []

  planilha.linhas.forEach((linha, i) => {
    if (filtro.soAtivos && temSituacao && linha[COLUNA_SITUACAO] !== 'Ativo') return
    if (filtro.categoria && linha[COLUNA_CATEGORIA] !== filtro.categoria) return

    if (termo) {
      // Busca em todas as colunas: o usuario pode procurar por fornecedor,
      // localizacao ou NCM, nao so pelas colunas visiveis.
      const achou = Object.values(linha).some((v) =>
        v.toLocaleLowerCase('pt-BR').includes(termo),
      )
      if (!achou) return
    }

    indices.push(i)
  })

  return indices
}
