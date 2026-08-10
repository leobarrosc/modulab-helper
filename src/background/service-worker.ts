/**
 * Service worker. Unica responsabilidade: abrir a aba do app.
 *
 * O service worker do MV3 e efemero (o Chrome o mata quando ocioso), entao
 * nenhum estado mora aqui. Toda a logica vive na aba. Ver PLANO.md secao 11.
 */

const APP_PAGE = 'src/app/index.html'

async function abrirApp(): Promise<void> {
  const url = chrome.runtime.getURL(APP_PAGE)

  // Reaproveita a aba se ela ja estiver aberta, em vez de acumular
  // duplicatas a cada clique no icone.
  const [existente] = await chrome.tabs.query({ url })

  if (existente?.id != null) {
    await chrome.tabs.update(existente.id, { active: true })
    if (existente.windowId != null) {
      await chrome.windows.update(existente.windowId, { focused: true })
    }
    return
  }

  await chrome.tabs.create({ url })
}

chrome.action.onClicked.addListener(() => {
  void abrirApp()
})
