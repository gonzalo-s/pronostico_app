import { describe, expect, it } from 'vitest'
import {
  currentResponse,
  errorSchema,
  forecastResponse,
  historyResponse,
  nearestStationResponse,
  stationsResponse,
} from '@/lib/schemas'
import current from './fixtures/current.json'
import currentNulls from './fixtures/current-nulls.json'
import forecast from './fixtures/forecast.json'
import forecastNulls from './fixtures/forecast-nulls.json'
import stations from './fixtures/stations.json'

describe('contrato: fixtures válidos', () => {
  it('stations', () => {
    expect(stationsResponse.parse(stations).data.length).toBeGreaterThan(0)
  })
  it('current (con y sin nulos)', () => {
    expect(currentResponse.parse(current).data.id).toBeTypeOf('number')
    expect(currentResponse.parse(currentNulls).data.feels_like_c).toBeNull()
  })
  it('forecast (con y sin nulos)', () => {
    expect(forecastResponse.parse(forecast).data.days.length).toBeGreaterThan(0)
    expect(forecastResponse.parse(forecast).meta.note).toBeTypeOf('string')
    expect(forecastResponse.parse(forecastNulls).data.days[0].temp_min_c).toBeNull()
  })
})

describe('contrato: rechazos', () => {
  it('falta un campo (nullable no acepta undefined)', () => {
    const bad = structuredClone(current) as { data: Record<string, unknown> }
    delete bad.data.temp_c
    expect(currentResponse.safeParse(bad).success).toBe(false)
  })
  it('tipo incorrecto', () => {
    const bad = structuredClone(current) as { data: Record<string, unknown> }
    bad.data.temp_c = '22'
    expect(currentResponse.safeParse(bad).success).toBe(false)
  })
  it('sin meta', () => {
    expect(stationsResponse.safeParse({ data: [] }).success).toBe(false)
  })
  it('ignora campos extra (tolera que la API agregue campos)', () => {
    const extra = structuredClone(stations) as { data: Record<string, unknown>[] }
    extra.data[0].nuevo = 1
    expect(stationsResponse.safeParse(extra).success).toBe(true)
  })
})

describe('contrato: esquemas de funciones futuras', () => {
  const meta = { source: 'SMN', updated_at: null }
  it('nearest', () => {
    const ok = { data: { ...stations.data[0], distance_km: 3.2 }, meta }
    expect(nearestStationResponse.safeParse(ok).success).toBe(true)
  })
  it('history', () => {
    const point = { at: '2026-11-02T10:00:00.000Z', temp_c: 20, humidity_pct: null, pressure_hpa: 1010, wind_dir_deg: null, wind_kmh: 4 }
    expect(historyResponse.safeParse({ data: [point], meta }).success).toBe(true)
  })
  it('error', () => {
    expect(errorSchema.safeParse({ error: { code: 'not_found', message: 'x' } }).success).toBe(true)
  })
})
