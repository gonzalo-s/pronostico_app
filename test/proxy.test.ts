// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/smn/[...path]/route'
import { isAllowedPath, nearestQuery } from '@/lib/proxyAllowlist'

const call = (path: string[]) =>
  GET(new Request(`http://localhost/api/smn/${path.join('/')}?x=1`), { params: Promise.resolve({ path }) })

const callQ = (path: string[], query: string) =>
  GET(new Request(`http://localhost/api/smn/${path.join('/')}?${query}`), { params: Promise.resolve({ path }) })

beforeEach(() => {
  process.env.SMN_API_URL = 'https://api.test'
  process.env.SMN_API_KEY = 'secret-test-key'
})
afterEach(() => {
  delete process.env.SMN_API_URL
  delete process.env.SMN_API_KEY
})

describe('isAllowedPath', () => {
  it.each(['stations', 'stations/nearest', 'stations/5/current', 'stations/123/forecast'])('permite %s', (p) => {
    expect(isAllowedPath(p)).toBe(true)
  })
  it.each([
    'health', 'internal/ingest', 'stations/abc/current', 'stations/0/current', 'stations/-1/current',
    'stations/1/history', 'stations/nearest/extra', 'stations/Nearest', 'stations/1/current/extra', '../stations', '', 'stations/',
    'stations/05/current', 'stations/12345678901/current', 'Stations', 'stations/5/CURRENT',
    'stations//5/current', 'stations\n',
  ])('rechaza %s', (p) => {
    expect(isAllowedPath(p)).toBe(false)
  })
})

describe('GET /api/smn/[...path]', () => {
  it('ruta no permitida → 404 sin llamar a la API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await call(['internal', 'ingest'])
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reenvía con X-API-Key, sin query string, y no filtra la clave', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await call(['stations', '5', 'current'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/stations/5/current')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-test-key')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"data":1}')
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('cache-control')).toContain('s-maxage=300')
    expect(JSON.stringify([...res.headers])).not.toContain('secret-test-key')
  })

  it('no sigue redirects del upstream (redirect: error)', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await call(['stations'])
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.redirect).toBe('error')
  })

  it('error de redirect (TypeError) → 502 genérico sin filtrar la clave', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed: unexpected redirect secret-test-key') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call(['stations'])
    const text = await res.text()
    expect(res.status).toBe(502)
    expect(text).toContain('upstream_error')
    expect(text).not.toContain('secret-test-key')
    expect(text).not.toContain('redirect')
  })

  it('404 upstream se propaga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":"not_found","message":"x"}}', { status: 404 })))
    const res = await call(['stations', '5', 'forecast'])
    expect(res.status).toBe(404)
  })

  it('401/429/5xx upstream → 502 genérico sin detalle', async () => {
    for (const status of [401, 429, 500]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('detalle-interno secret-test-key', { status })))
      const res = await call(['stations'])
      const text = await res.text()
      expect(res.status).toBe(502)
      expect(text).toContain('upstream_error')
      expect(text).not.toContain('detalle-interno')
      expect(text).not.toContain('secret-test-key')
    }
  })

  it('fallo de red → 502 genérico', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED api.test') }))
    const res = await call(['stations'])
    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain('ECONNREFUSED')
  })

  it('sin variables de entorno → 500 genérico', async () => {
    delete process.env.SMN_API_KEY
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call(['stations'])
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('config_error')
  })
})

describe('nearestQuery', () => {
  const q = (s: string) => nearestQuery(new URLSearchParams(s))
  it('acepta coordenadas decimales válidas y descarta el resto', () => {
    expect(q('lat=-34.6&lon=-58.38')).toBe('lat=-34.6&lon=-58.38')
    expect(q('lat=-34.6&lon=-58.38&key=zz&x=1')).toBe('lat=-34.6&lon=-58.38')
    expect(q('lat=90&lon=-180')).toBe('lat=90&lon=-180')
  })
  it.each([
    'lat=abc&lon=1', 'lat=1&lon=', 'lat=1', 'lon=1', '', 'lat=91&lon=1', 'lat=1&lon=181', 'lat=-90.1&lon=1',
    'lat=1e2&lon=1', 'lat=1&lon=1;drop', 'lat=%2034&lon=1', 'lat=1.1234567&lon=1', 'lat=+1&lon=1',
  ])('rechaza %s', (s) => {
    expect(q(s)).toBeNull()
  })
})

describe('GET stations/nearest', () => {
  it('reenvía solo lat/lon validados, con X-API-Key', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":{"id":7}}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['stations', 'nearest'], 'lat=-34.6&lon=-58.38&key=zz&x=1')
    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/stations/nearest?lat=-34.6&lon=-58.38')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-test-key')
  })
  it('coordenadas inválidas → 400 sin llamar al upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['stations', 'nearest'], 'lat=100&lon=1')
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ error: { code: 'bad_request', message: 'Coordenadas inválidas' } })
  })
})
