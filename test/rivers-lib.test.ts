import { describe, expect, it } from 'vitest'
import { bandText, buildForecastChart, changeText, findRiverStation, firstExceedance, toLevels } from '@/lib/rivers'

const BOX = { width: 340, height: 230, padLeft: 62, padRight: 12, padTop: 10, padBottom: 24 }
const at = (h: number) => `2026-11-04T${String(h).padStart(2, '0')}:00:00.000Z`
const pt = (h: number, main: number) => ({
  at: at(h), main_m: main, p05_m: main - 0.22, p25_m: main - 0.09, p75_m: main + 0.1, p95_m: main + 0.23,
})
const forecast = (points: ReturnType<typeof pt>[], levels: { alert_m: number | null; evacuation_m: number | null; low_water_m: number | null } | null = null) => ({
  issued_at: at(3), model: 'marea_rdp_regre', levels, points,
})
const station = (name: string) => ({
  id: 1, name, river: 'r', lat: 0, lon: 0, alert_level_m: null, evacuation_level_m: null, low_water_level_m: null, has_forecast: true,
})

describe('findRiverStation', () => {
  it('busca por nombre sin importar mayúsculas ni acentos', () => {
    const list = [station('Rosario'), station('San Fernando')]
    expect(findRiverStation(list, 'san fernando')?.name).toBe('San Fernando')
    expect(findRiverStation([station('Zárate')], 'ZARATE')?.name).toBe('Zárate')
    expect(findRiverStation(list, 'Tigre')).toBeUndefined()
  })
})

describe('textos', () => {
  it('bandText: contexto neutro, nada para unknown', () => {
    expect(bandText('above_p99')).toBe('Más alto que el 99 % de lo registrado en esta fecha')
    expect(bandText('above_p90')).toBe('Más alto que el 90 % de lo registrado en esta fecha')
    expect(bandText('normal')).toBe('Dentro de lo habitual para esta fecha')
    expect(bandText('unknown')).toBeNull()
  })
  it('changeText: signo y null oculto', () => {
    expect(changeText(0.25)).toBe('+0,25 m en 24 h')
    expect(changeText(-0.1)).toBe('−0,10 m en 24 h')
    expect(changeText(0)).toBe('0,00 m en 24 h')
    expect(changeText(null)).toBeNull()
  })
})

describe('firstExceedance', () => {
  const levels = toLevels({ alert_m: 3, evacuation_m: 3.5, low_water_m: null })
  it('usa la banda alta (p95), no main', () => {
    // main 2,8 → p95 3,03: supera alerta aunque main no
    expect(firstExceedance([pt(10, 2.5), pt(12, 2.8)], levels)).toEqual({ kind: 'alert', level: 3, at: at(12) })
  })
  it('evacuación tiene prioridad sobre alerta', () => {
    expect(firstExceedance([pt(10, 3.3)], levels)?.kind).toBe('evacuation')
  })
  it('null si no llega, o si no hay niveles', () => {
    expect(firstExceedance([pt(10, 1)], levels)).toBeNull()
    expect(firstExceedance([pt(10, 9)], toLevels(null))).toBeNull()
  })
})

describe('buildForecastChart', () => {
  const now = Date.parse(at(11))
  it('null sin puntos', () => {
    expect(buildForecastChart(forecast([]), [], toLevels(null), BOX, now)).toBeNull()
  })
  it('los niveles de alerta y evacuación entran en el eje aunque los datos estén lejos', () => {
    const c = buildForecastChart(forecast([pt(10, 1), pt(12, 1.2)]), [], toLevels({ alert_m: 3, evacuation_m: 3.5, low_water_m: null }), BOX, now)!
    expect(c.levels.map((l) => l.key)).toEqual(['evacuation', 'alert'])
    expect(c.levels.every((l) => l.y >= BOX.padTop && l.y <= BOX.height - BOX.padBottom)).toBe(true)
    expect(c.levels[0].y).toBeLessThan(c.levels[1].y) // 3,5 m más arriba que 3,0 m
  })
  it('aguas bajas solo si cae dentro del rango dibujado', () => {
    const far = buildForecastChart(forecast([pt(10, 2), pt(12, 2.2)]), [], toLevels({ alert_m: 3, evacuation_m: null, low_water_m: 0.3 }), BOX, now)!
    expect(far.levels.map((l) => l.key)).toEqual(['alert'])
    const near = buildForecastChart(forecast([pt(10, 0.5), pt(12, 0.6)]), [], toLevels({ alert_m: null, evacuation_m: null, low_water_m: 0.55 }), BOX, now)!
    expect(near.levels.map((l) => l.key)).toEqual(['lowWater'])
  })
  it('línea "ahora" solo dentro del rango; las lecturas amplían el rango hacia atrás', () => {
    const readings = [{ at: at(2), height_m: 1 }]
    const c = buildForecastChart(forecast([pt(10, 1), pt(14, 1.2)]), readings, toLevels(null), BOX, now)!
    expect(c.t0).toBe(Date.parse(at(2)))
    expect(c.nowX).not.toBeNull()
    expect(buildForecastChart(forecast([pt(10, 1), pt(14, 1.2)]), [], toLevels(null), BOX, Date.parse(at(20)))!.nowX).toBeNull()
  })
  it('picks ordenados por x, con lecturas reales y previstas', () => {
    const c = buildForecastChart(forecast([pt(10, 1), pt(14, 1.2)]), [{ at: at(2), height_m: 0.9 }], toLevels(null), BOX, now)!
    expect(c.picks.map((p) => p.kind)).toEqual(['real', 'forecast', 'forecast'])
    expect(c.picks.map((p) => p.x)).toEqual([...c.picks.map((p) => p.x)].sort((a, b) => a - b))
  })
})
