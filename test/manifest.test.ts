import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

describe('manifest PWA', () => {
  const m = manifest()
  it('es instalable y en español', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.lang).toBe('es-AR')
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
  })
  it('declara íconos 192 y 512, uno maskable, y los archivos existen', () => {
    const icons = m.icons ?? []
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true)
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose !== 'maskable')).toBe(true)
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      expect(existsSync(path.join(process.cwd(), 'public', icon.src))).toBe(true)
    }
  })
  it('hay ícono para iOS', () => {
    expect(existsSync(path.join(process.cwd(), 'public', 'icons', 'apple-touch-icon.png'))).toBe(true)
  })
})
