// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/smn/[...path]/route'
import { historyQuery, isAllowedPath, nearestQuery } from '@/lib/proxyAllowlist'

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
  it.each(['stations', 'stations/nearest', 'stations/5/current', 'stations/123/forecast', 'stations/5/history', 'tides/stations/2/current', 'tides/stations/2/heights', 'tides/stations/2/extremes', 'tides/stations/2/forecast'])('permite %s', (p) => {
    expect(isAllowedPath(p)).toBe(true)
  })
  it.each([
    'health', 'internal/ingest', 'stations/abc/current', 'stations/0/current', 'stations/-1/current',
    'stations/0/history', 'stations/5/history/extra', 'stations/abc/history', 'stations/nearest/extra', 'stations/Nearest', 'stations/1/current/extra', '../stations', '', 'stations/',
    'stations/05/current', 'stations/12345678901/current', 'Stations', 'stations/5/CURRENT',
    'stations//5/current', 'stations\n',
    'tides', 'tides/stations', 'tides/stations/nearest', 'tides/stations/0/heights', 'tides/stations/abc/current',
    'tides/stations/2/heights/extra', 'tides/stations/2/other', 'tides/stations/0/extremes', 'tides/stations/2/forecast/extra',
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

describe('historyQuery', () => {
  const NOW = Date.parse('2026-11-02T18:47:12.345Z')
  const q = (s: string) => historyQuery(new URLSearchParams(s), NOW)
  it('calcula from/to con la hora redondeada hacia abajo', () => {
    const to = encodeURIComponent('2026-11-02T18:00:00.000Z')
    expect(q('range=24h')).toBe(`from=${encodeURIComponent('2026-11-01T18:00:00.000Z')}&to=${to}`)
    expect(q('range=7d')).toBe(`from=${encodeURIComponent('2026-10-26T18:00:00.000Z')}&to=${to}`)
    expect(q('range=31d')).toBe(`from=${encodeURIComponent('2026-10-02T18:00:00.000Z')}&to=${to}`)
  })
  it('descarta otros parámetros (no hay fechas libres)', () => {
    expect(q('range=24h&from=2020-01-01&to=2020-02-01')).toBe(q('range=24h'))
  })
  it.each(['', 'range=', 'range=1h', 'range=24H', 'range=constructor', 'range=__proto__', 'from=2026-01-01'])(
    'rechaza %s',
    (s) => {
      expect(q(s)).toBeNull()
    },
  )
})

describe('GET stations/:id/history', () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  it('reenvía from/to calculados por el servidor, con X-API-Key', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T18:47:12.345Z'))
    const fetchMock = vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['stations', '5', 'history'], 'range=7d&from=2000-01-01')
    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(
      `https://api.test/v1/stations/5/history?from=${encodeURIComponent('2026-10-26T18:00:00.000Z')}&to=${encodeURIComponent('2026-11-02T18:00:00.000Z')}`,
    )
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-test-key')
  })
  it('tides/stations/:id/heights usa el mismo from/to calculado por el servidor', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T18:47:12.345Z'))
    const fetchMock = vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['tides', 'stations', '2', 'heights'], 'range=24h&from=2000-01-01')
    expect(res.status).toBe(200)
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toBe(
      `https://api.test/v1/tides/stations/2/heights?from=${encodeURIComponent('2026-11-01T18:00:00.000Z')}&to=${encodeURIComponent('2026-11-02T18:00:00.000Z')}`,
    )
  })
  it('tides/stations/:id/extremes usa from/to del servidor y forecast no lleva query', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-02T18:47:12.345Z'))
    const fetchMock = vi.fn(async () => new Response('{"data":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await callQ(['tides', 'stations', '2', 'extremes'], 'range=7d&from=2000-01-01')
    await callQ(['tides', 'stations', '2', 'forecast'], 'from=2000-01-01')
    const urls = fetchMock.mock.calls.map((c) => (c as unknown as [string])[0])
    expect(urls[0]).toBe(
      `https://api.test/v1/tides/stations/2/extremes?from=${encodeURIComponent('2026-10-26T18:00:00.000Z')}&to=${encodeURIComponent('2026-11-02T18:00:00.000Z')}`,
    )
    expect(urls[1]).toBe('https://api.test/v1/tides/stations/2/forecast')
  })
  it('período inválido o ausente → 400 sin llamar al upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    for (const query of ['range=99d', '']) {
      const res = await callQ(['stations', '5', 'history'], query)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: { code: 'bad_request', message: 'Período inválido' } })
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
