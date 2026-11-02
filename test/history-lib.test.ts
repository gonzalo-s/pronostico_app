import { describe, expect, it } from 'vitest'
import { METRICS, buildSeries } from '@/lib/history'
import type { HistoryPoint } from '@/lib/schemas'

const pt = (hour: number, temp: number | null): HistoryPoint => ({
  at: `2026-11-02T${String(hour).padStart(2, '0')}:00:00.000Z`,
  temp_c: temp, humidity_pct: 50, pressure_hpa: 1010, wind_dir_deg: 90, wind_kmh: 10,
})
const box = { width: 100, height: 50, padX: 10, padY: 5 }

describe('buildSeries', () => {
  it('escala x por tiempo e y por mín/máx (arriba = valor alto)', () => {
    const s = buildSeries([pt(0, 10), pt(6, 20), pt(12, 30)], 'temp_c', box)!
    expect(s.min).toBe(10)
    expect(s.max).toBe(30)
    expect(s.last).toBe(30)
    expect(s.segments).toHaveLength(1)
    expect(s.segments[0].map((p) => p.x)).toEqual([10, 50, 90])
    expect(s.segments[0].map((p) => p.y)).toEqual([45, 25, 5])
  })
  it('los nulos cortan la línea en segmentos', () => {
    const s = buildSeries([pt(0, 10), pt(1, null), pt(2, 20), pt(3, 30)], 'temp_c', box)!
    expect(s.segments.map((seg) => seg.length)).toEqual([1, 2])
    expect(s.last).toBe(30)
  })
  it('"último" es el último valor no nulo', () => {
    expect(buildSeries([pt(0, 10), pt(1, 20), pt(2, null)], 'temp_c', box)!.last).toBe(20)
  })
  it('serie plana: no divide por cero y queda centrada', () => {
    const s = buildSeries([pt(0, 15), pt(1, 15)], 'temp_c', box)!
    expect(s.min).toBe(15)
    expect(s.max).toBe(15)
    expect(s.segments[0].every((p) => p.y === 25)).toBe(true)
  })
  it('un solo punto: x centrada', () => {
    const s = buildSeries([pt(5, 12)], 'temp_c', box)!
    expect(s.segments[0]).toEqual([{ x: 50, y: 25 }])
  })
  it('todos nulos o sin puntos → null', () => {
    expect(buildSeries([pt(0, null), pt(1, null)], 'temp_c', box)).toBeNull()
    expect(buildSeries([], 'temp_c', box)).toBeNull()
  })
  it('lee la métrica pedida', () => {
    const s = buildSeries([pt(0, 10), pt(1, 10)], 'pressure_hpa', box)!
    expect(s.min).toBe(1010)
  })
})

describe('METRICS', () => {
  it('formatea cada métrica con su unidad', () => {
    const f = Object.fromEntries(METRICS.map((m) => [m.key, m.format]))
    expect(f.temp_c(12.4)).toBe('12°')
    expect(f.humidity_pct(58)).toBe('58 %')
    expect(f.pressure_hpa(1013.24)).toBe('1013,2 hPa')
    expect(f.wind_kmh(14)).toBe('14 km/h')
    expect(f.temp_c(null)).toBe('—')
  })
})
