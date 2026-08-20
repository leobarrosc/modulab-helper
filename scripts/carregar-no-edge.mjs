/**
 * Gera um dist/ limpo para carregar no navegador.
 * Uso: node scripts/carregar-no-edge.mjs [--abrir]
 *
 * Na PRIMEIRA vez abre o Explorador em dist/ e o edge://extensions, que e
 * quando esses dois ajudam: e preciso apontar "Carregar sem pacote" para a
 * pasta. Depois disso o build sozinho basta -- o Edge le o dist/ do disco, e
 * atualizar e um clique no icone de recarregar do card da extensao. Abrir aba
 * e Explorador a cada build so deixava lixo na tela.
 *
 * O `npm run dev` deixa um dist/ com service-worker-loader.js apontando pra
 * localhost -- a extensao falha com "Service worker registration failed" se
 * carregada assim. Por isso o rm -rf antes do build, sempre.
 */
import { rmSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync, exec } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(RAIZ, 'dist')

/**
 * O registro fica em node_modules/.cache -- ja ignorado pelo git e sobrevive
 * ao `rm -rf dist` de todo build. Some num `npm ci`, e ai reaparecer o passo a
 * passo e o certo: arvore nova, provavel maquina nova.
 *
 * Nao da para CONSULTAR o Edge se a extensao esta la: isso exigiria ler o
 * perfil do navegador, que guarda muito mais que a lista de extensoes. Entao o
 * que este arquivo registra e "ja mostrei as instrucoes para este dist/", e
 * nao "verifiquei que esta carregada". Dai o --abrir, para o caso de ter
 * removido a extensao ou trocado de navegador.
 */
const MARCADOR = join(RAIZ, 'node_modules', '.cache', 'modulab-helper', 'carregado.json')

const forcarAbrir = process.argv.includes('--abrir')

/**
 * Mesma pasta?
 *
 * Comparar as strings cruas nao serve: no Windows o mesmo caminho aparece como
 * `c:\...` ou `C:\...` conforme quem chamou o script, e a diferenca de caixa
 * fazia o marcador nunca casar -- o script reabria Explorador e aba a cada
 * build, que e justamente o que ele deveria evitar.
 */
function mesmaPasta(a, b) {
  const [x, y] = [resolve(a), resolve(b)]
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y
}

/** `true` se ja guiamos o carregamento deste mesmo caminho de dist/. */
function jaCarregado() {
  try {
    return mesmaPasta(JSON.parse(readFileSync(MARCADOR, 'utf8')).dist ?? '', DIST)
  } catch {
    // Ausente, ilegivel ou de outro caminho: trata como primeira vez.
    return false
  }
}

function registrar() {
  try {
    mkdirSync(dirname(MARCADOR), { recursive: true })
    writeFileSync(MARCADOR, JSON.stringify({ dist: DIST, em: new Date().toISOString() }, null, 2))
  } catch {
    // Registrar e conveniencia: falhar aqui so faz as instrucoes reaparecerem.
  }
}

console.log('Limpando dist/ antigo...')
rmSync(DIST, { recursive: true, force: true })

console.log('Rodando npm run build...\n')
execSync('npm run build', { cwd: RAIZ, stdio: 'inherit' })

if (!existsSync(DIST)) {
  console.error('\nO build nao gerou dist/ -- confira o erro acima.')
  process.exit(1)
}

console.log(`\ndist/ pronto em: ${DIST}`)

const primeiraVez = forcarAbrir || !jaCarregado()

if (!primeiraVez) {
  console.log(`
A extensao ja foi carregada a partir desta pasta. Para ver a mudanca:

  edge://extensions -> icone de recarregar no card "Modulab Helper"

Se tiver removido a extensao, rode: npm run carregar -- --abrir
`)
  process.exit(0)
}

if (process.platform === 'win32') {
  // "start" e comando interno do cmd.exe, nao um executavel -- por isso o
  // shell precisa ser cmd.exe e nao o padrao do Node.
  exec(`start "" "${DIST}"`, { shell: 'cmd.exe' })
  exec('start msedge edge://extensions', { shell: 'cmd.exe' })

  console.log(`
Primeira vez: abri o Explorador em dist/ e o Edge em edge://extensions.

  1. Ativar "Modo de desenvolvedor" (canto inferior esquerdo da pagina)
  2. Clicar em "Carregar sem pacote"
  3. Selecionar a pasta que abriu no Explorador

Nos proximos builds nao abro mais nada: basta clicar no icone de recarregar
no card da extensao.
`)
} else {
  console.log(`
Abra edge://extensions, ative o Modo de desenvolvedor, clique em
"Carregar sem pacote" e selecione:

  ${DIST}
`)
}

registrar()
