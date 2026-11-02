// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/smn/[...path]/route'
import { isAllowedPath } from '@/lib/proxyAllowlist'

const call = (path: string[]) =>
  GET(new Request(`http://localhost/api/smn/${path.join('/')}?x=1`), { params: Promise.resolve({ path }) })

beforeEach(() => {
  process.env.SMN_API_URL = 'https://api.test'
  process.env.SMN_API_KEY = 'secret-test-key'
})
afterEach(() => {
  delete process.env.SMN_API_URL
  delete process.env.SMN_API_KEY
})

describe('isAllowedPath', () => {
  it.each(['stations', 'stations/5/current', 'stations/123/forecast'])('permite %s', (p) => {
    expect(isAllowedPath(p)).toBe(true)
  })
  it.each([
    'health', 'internal/ingest', 'stations/abc/current', 'stations/0/current', 'stations/-1/current',
    'stations/1/history', 'stations/nearest', 'stations/1/current/extra', '../stations', '', 'stations/',
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
