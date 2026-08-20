import { paginaParaSvg } from '@/core/render/svg'
import type { PaginaPdf } from '@/core/render/pdf'

/**
 * Caminho de impressao direta.
 *
 * Monta um documento com uma pagina SVG por folha e manda imprimir de dentro
 * de um iframe oculto -- abrir janela nova seria barrado por bloqueador de
 * pop-up na maioria das instalacoes.
 *
 * O PDF continua sendo o caminho recomendado: aqui o navegador ainda pode
 * reescalar. Ver PLANO.md secao 12.
 */
export function imprimirFolhas(paginas: PaginaPdf[], titulo = 'Etiquetas'): void {
  if (paginas.length === 0) return

  const primeira = paginas[0]!
  const html = documentoImprimivel(paginas, primeira.larguraMm, primeira.alturaMm, titulo)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(iframe)

  const limpar = () => {
    // Espera o diálogo fechar antes de remover: tirar o iframe cedo demais
    // cancela o trabalho de impressão em alguns navegadores.
    setTimeout(() => iframe.remove(), 1000)
  }

  iframe.onload = () => {
    const janela = iframe.contentWindow
    if (!janela) {
      limpar()
      return
    }
    janela.addEventListener('afterprint', limpar, { once: true })
    janela.focus()
    janela.print()
  }

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
}

function documentoImprimivel(
  paginas: PaginaPdf[],
  larguraMm: number,
  alturaMm: number,
  titulo: string,
): string {
  const folhas = paginas
    .map((p) => `<div class="pagina">${paginaParaSvg(p.ops, p.larguraMm, p.alturaMm)}</div>`)
    .join('')

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  /* Casa o papel com a etiqueta e zera a margem do navegador. */
  @page { size: ${larguraMm}mm ${alturaMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .pagina {
    width: ${larguraMm}mm;
    height: ${alturaMm}mm;
    overflow: hidden;
    /* Sem isto o navegador pode partir uma folha em duas. */
    break-after: page;
    page-break-after: always;
  }
  .pagina:last-child { break-after: auto; page-break-after: auto; }
  .folha { display: block; width: 100%; height: 100%; }
</style></head><body>${folhas}</body></html>`
}

/** O que a folha deve conter: a pagina inteira nao cabe nem interessa. */
export type SecaoImprimivel = 'mapa' | 'reposicao'

/**
 * Marca no `<body>` o que imprimir e chama o dialogo.
 *
 * O CSS de impressao esconde tudo que nao for a secao escolhida. Sem a marca
 * ele nao teria como saber: as duas secoes vivem na mesma pagina, e antes so a
 * lista de reposicao era imprimivel porque estava escrita no seletor.
 *
 * O mapa vai em paisagem -- 12 colunas em retrato dao ~15mm por celula, onde
 * nome de cor nenhum cabe. A regra `@page` nao pode ser condicionada por
 * seletor, entao ela entra e sai junto com a impressao.
 */
export function imprimirSecao(secao: SecaoImprimivel): void {
  const { body } = document
  const anterior = body.dataset['imprimir']

  body.dataset['imprimir'] = secao

  let paisagem: HTMLStyleElement | null = null
  if (secao === 'mapa') {
    paisagem = document.createElement('style')
    paisagem.textContent = '@page { size: landscape; margin: 8mm; }'
    document.head.appendChild(paisagem)
  }

  let limpo = false
  const restaurar = () => {
    if (limpo) return
    limpo = true

    if (anterior === undefined) delete body.dataset['imprimir']
    else body.dataset['imprimir'] = anterior

    paisagem?.remove()
    window.removeEventListener('afterprint', restaurar)
  }

  window.addEventListener('afterprint', restaurar)
  window.print()
  // Chromium volta de `print()` com o dialogo ja fechado e dispara
  // `afterprint`; o timeout so cobre quem nao disparar, para a pagina nao
  // ficar presa no estado de impressao.
  setTimeout(restaurar, 1000)
}
