import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

/**
 * IMPORTANTE: nao declarar `action.default_popup`.
 * Se houver um popup declarado, `chrome.action.onClicked` nunca dispara
 * e o clique no icone nao abre a aba. Ver PLANO.md secao 11.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'Modulab Helper',
  version: pkg.version,
  description: pkg.description,
  default_locale: undefined,

  action: {
    default_title: 'Abrir Modulab Helper',
    default_icon: {
      16: 'src/assets/icons/icon-16.png',
      48: 'src/assets/icons/icon-48.png',
      128: 'src/assets/icons/icon-128.png',
    },
  },

  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },

  // Sem permissoes de host: o CSV vem de um <input type=file> local.
  // Nenhum dado de produto sai da maquina.
  permissions: ['storage', 'unlimitedStorage'],

  icons: {
    16: 'src/assets/icons/icon-16.png',
    48: 'src/assets/icons/icon-48.png',
    128: 'src/assets/icons/icon-128.png',
  },
})
