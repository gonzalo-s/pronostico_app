import { describe, expect, it, vi } from 'vitest'
import { ApiError, getCurrent, getForecast, getStations, shouldRetry } from '@/lib/api'
import current from './fixtures/current.json'
import forecast from './fixtures/forecast.json'
import stations from './fixtures/stations.json'
import { mockFetch } from './helpers'

describe('cliente de la API', () => {
  it('devuelve datos validados', async () => {
    const fetchMock = mockFetch({
      stations: { body: stations },
      'stations/1/current': { body: current },
      'stations/1/forecast': { body: forecast },
    })
    expect((await getStations()).data.length).toBeGreaterThan(0)
    expect((await getCurrent(1)).data.id).toBe(1)
    expect((await getForecast(1)).data.days.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/stations/1/current')
  })

  it('404 → not_found', async () => {
    mockFetch({ 'stations/1/current': { status: 404, body: { error: { code: 'not_found', message: 'x' } } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ name: 'ApiError', kind: 'not_found' })
  })

  it('5xx → upstream', async () => {
    mockFetch({ 'stations/1/current': { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ kind: 'upstream' })
  })

  it('fallo de red → network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')))
    await expect(getStations()).rejects.toMatchObject({ kind: 'network' })
  })

  it('respuesta que no cumple el esquema → contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch({ 'stations/1/current': { body: { data: {}, meta: {} } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ kind: 'contract' })
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
