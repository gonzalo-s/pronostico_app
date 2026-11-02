import { describe, expect, it, vi } from 'vitest'
import { ApiError, getCurrent, getForecast, getHistory, getNearestStation, getStations, shouldRetry } from '@/lib/api'
import current from './fixtures/current.json'
import forecast from './fixtures/forecast.json'
import stations from './fixtures/stations.json'
import { mockFetch } from './helpers'

const ID = current.data.id

describe('cliente de la API', () => {
  it('devuelve datos validados', async () => {
    const fetchMock = mockFetch({
      stations: { body: stations },
      [`stations/${ID}/current`]: { body: current },
      [`stations/${ID}/forecast`]: { body: forecast },
    })
    expect((await getStations()).data.length).toBeGreaterThan(0)
    expect((await getCurrent(ID)).data.id).toBe(ID)
    expect((await getForecast(ID)).data.days.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${ID}/current`)
  })

  it('getNearestStation redondea las coordenadas y valida la respuesta', async () => {
    const body = {
      data: { id: 7, name: 'AEROPARQUE AERO', province: 'CAPITAL FEDERAL', lat: -34.55, lon: -58.41, altitude_m: 6, distance_km: 3.2 },
      meta: { source: 'SMN', updated_at: null },
    }
    const fetchMock = mockFetch({ 'stations/nearest?lat=-34.6&lon=-58.38': { body } })
    const res = await getNearestStation(-34.6037, -58.3816)
    expect(res.data.id).toBe(7)
    expect(res.data.distance_km).toBe(3.2)
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/stations/nearest?lat=-34.6&lon=-58.38')
  })

  it('getHistory pide el período y valida los puntos', async () => {
    const body = {
      data: [{ at: '2026-11-02T15:00:00.000Z', temp_c: 21.5, humidity_pct: 60, pressure_hpa: 1010, wind_dir_deg: 135, wind_kmh: 12 }],
      meta: { source: 'SMN', updated_at: '2026-11-02T15:00:00.000Z' },
    }
    const fetchMock = mockFetch({ [`stations/${ID}/history?range=7d`]: { body } })
    const res = await getHistory(ID, '7d')
    expect(res.data).toHaveLength(1)
    expect(res.data[0].temp_c).toBe(21.5)
    expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${ID}/history?range=7d`)
  })

  it('404 → not_found', async () => {
    mockFetch({ [`stations/${ID}/current`]: { status: 404, body: { error: { code: 'not_found', message: 'x' } } } })
    await expect(getCurrent(ID)).rejects.toMatchObject({ name: 'ApiError', kind: 'not_found' })
  })

  it('5xx → upstream', async () => {
    mockFetch({ [`stations/${ID}/current`]: { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } })
    await expect(getCurrent(ID)).rejects.toMatchObject({ kind: 'upstream' })
  })

  it('fallo de red → network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')))
    await expect(getStations()).rejects.toMatchObject({ kind: 'network' })
  })

  it('respuesta que no cumple el esquema → contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch({ [`stations/${ID}/current`]: { body: { data: {}, meta: {} } } })
    await expect(getCurrent(ID)).rejects.toMatchObject({ kind: 'contract' })
  })

  it('cuerpo no JSON → contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))
    await expect(getStations()).rejects.toMatchObject({ kind: 'contract' })
  })
})

describe('shouldRetry', () => {
  it('no reintenta not_found ni contract', () => {
    expect(shouldRetry(0, new ApiError('not_found', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError('contract', 'x'))).toBe(false)
  })
  it('reintenta hasta 2 veces el resto', () => {
    expect(shouldRetry(0, new ApiError('network', 'x'))).toBe(true)
    expect(shouldRetry(1, new Error('x'))).toBe(true)
    expect(shouldRetry(2, new ApiError('upstream', 'x'))).toBe(false)
  })
})
