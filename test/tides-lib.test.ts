import { describe, expect, it } from 'vitest'
import { levelOf, splitByLevel } from '@/lib/tides'

const p = (x: number, v: number, seg = 0) => ({ x, y: 100 - v * 10, v, seg })

describe('levelOf', () => {
  it.each([[1.99, 0], [2, 1], [2.49, 1], [2.5, 2], [3, 3], [3.49, 3], [3.5, 4], [5, 4], [-1, 0]])('%s m → nivel %s', (v, l) => {
    expect(levelOf(v)).toBe(l)
  })
})

describe('splitByLevel', () => {
  it('un tramo dentro de un mismo nivel no se parte', () => {
    expect(splitByLevel([p(0, 2.1), p(10, 2.4)]).map((s) => s.level)).toEqual([1])
  })
  it('corta justo donde cruza cada umbral', () => {
    const pieces = splitByLevel([p(0, 1.5), p(10, 3.5)])
    expect(pieces.map((s) => s.level)).toEqual([0, 1, 2, 3])
    expect(pieces[0].x2).toBeCloseTo(2.5) // 2 m a un cuarto del recorrido
    expect(pieces[3].x2).toBe(10)
  })
  it('también al bajar', () => {
    expect(splitByLevel([p(0, 3.2), p(10, 2.4)]).map((s) => s.level)).toEqual([3, 2, 1])
  })
  it('no une puntos separados por un hueco de datos', () => {
    expect(splitByLevel([p(0, 1), p(10, 1.2), p(20, 3, 1), p(30, 3.1, 1)])).toHaveLength(2)
  })
})
