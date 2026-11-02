import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'public/icons/icon.svg'
const BACKGROUND = '#0b3d91'
mkdirSync('public/icons', { recursive: true })

async function render(file, size, padRatio) {
  const pad = Math.round(size * padRatio)
  const inner = size - pad * 2
  let img = sharp(SOURCE, { density: 300 }).resize(inner, inner)
  if (pad > 0) img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND })
  await img.png().toFile(`public/icons/${file}`)
}

await render('icon-192.png', 192, 0)
await render('icon-512.png', 512, 0)
await render('apple-touch-icon.png', 180, 0)
await render('icon-maskable-512.png', 512, 0.2) // zona segura para máscaras circulares
console.log('Íconos generados en public/icons')
