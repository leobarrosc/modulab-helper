/**
 * Gera os icones PNG da extensao sem dependencias externas.
 * Uso: node scripts/gerar-icones.mjs
 *
 * Desenha um retangulo arredondado escuro com barras claras, que a 16px
 * ainda le como codigo de barras.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINO = join(RAIZ, 'src', 'assets', 'icons')

const TINTA = [20, 20, 20]
const PAPEL = [255, 255, 255]

// Barras como fracoes da largura util: [inicio, largura]
const BARRAS = [
  [0.0, 0.14],
  [0.2, 0.07],
  [0.33, 0.14],
  [0.54, 0.07],
  [0.67, 0.07],
  [0.8, 0.2],
]

const crcTabela = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(corpo))
  return Buffer.concat([tamanho, corpo, crc])
}

function png(largura, altura, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(largura, 0)
  ihdr.writeUInt32BE(altura, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 6 // RGBA
  // 10..12 = compressao/filtro/entrelacamento, todos 0

  // Cada scanline e precedida por um byte de filtro (0 = None).
  const bruto = Buffer.alloc(altura * (1 + largura * 4))
  for (let y = 0; y < altura; y++) {
    const destino = y * (1 + largura * 4)
    bruto[destino] = 0
    rgba.copy(bruto, destino + 1, y * largura * 4, (y + 1) * largura * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(bruto, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function desenhar(tamanho) {
  const px = Buffer.alloc(tamanho * tamanho * 4) // zerado = transparente
  const raio = tamanho * 0.22
  const respiro = Math.max(1, Math.round(tamanho * 0.17))
  const barraTopo = respiro
  const barraBase = tamanho - respiro
  const util = tamanho - respiro * 2

  const por = (x, y, cor) => {
    const i = (y * tamanho + x) * 4
    px[i] = cor[0]
    px[i + 1] = cor[1]
    px[i + 2] = cor[2]
    px[i + 3] = 255
  }

  const dentroArredondado = (x, y) => {
    const cx = Math.min(Math.max(x + 0.5, raio), tamanho - raio)
    const cy = Math.min(Math.max(y + 0.5, raio), tamanho - raio)
    const dx = x + 0.5 - cx
    const dy = y + 0.5 - cy
    return dx * dx + dy * dy <= raio * raio
  }

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      if (dentroArredondado(x, y)) por(x, y, TINTA)
    }
  }

  for (const [inicio, largura] of BARRAS) {
    const x0 = Math.round(respiro + inicio * util)
    const x1 = Math.max(x0 + 1, Math.round(respiro + (inicio + largura) * util))
    for (let y = barraTopo; y < barraBase; y++) {
      for (let x = x0; x < Math.min(x1, tamanho); x++) por(x, y, PAPEL)
    }
  }

  return png(tamanho, tamanho, px)
}

mkdirSync(DESTINO, { recursive: true })
for (const tamanho of [16, 48, 128]) {
  const arquivo = join(DESTINO, `icon-${tamanho}.png`)
  writeFileSync(arquivo, desenhar(tamanho))
  console.log(`gerado  ${arquivo}`)
}
