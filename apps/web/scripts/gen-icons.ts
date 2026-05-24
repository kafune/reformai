import { deflateSync } from "node:zlib"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// Gera ícones PNG do PWA (sem dependências de imagem). Marca simples:
// fundo verde-escuro com um quadrado verde centralizado — identidade "Concreto Verde".
// Uso: bun run scripts/gen-icons.ts

const BG: [number, number, number] = [0x1e, 0x3a, 0x2f] // green-900
const FG: [number, number, number] = [0x16, 0xa3, 0x74] // green-600

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, "latin1")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function makePng(size: number): Buffer {
  const inset = Math.round(size * 0.26)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filter type none
    for (let x = 0; x < size; x++) {
      const inside = x >= inset && x < size - inset && y >= inset && y < size - inset
      const [r, g, b] = inside ? FG : BG
      const p = rowStart + 1 + x * 4
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
      raw[p + 3] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const dir = join(process.cwd(), "public", "icons")
mkdirSync(dir, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(join(dir, `icon-${size}.png`), makePng(size))
  console.log(`✓ public/icons/icon-${size}.png`)
}
