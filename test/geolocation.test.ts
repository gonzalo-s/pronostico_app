import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeoError, geolocationSupported, getPosition, roundCoord } from '@/lib/geolocation'

function stubGeolocation(getCurrentPosition: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('roundCoord', () => {
  it.each([
    [-34.6037, -34.6],
    [-58.3816, -58.38],
    [-34.557, -34.56],
    [0.004, 0],
  ])('%s → %s', (input, expected) => {
    expect(roundCoord(input)).toBe(expected)
  })
})

describe('geolocationSupported', () => {
  it('false sin navigator.geolocation, true con él', () => {
    expect(geolocationSupported()).toBe(false)
    stubGeolocation(vi.fn())
    expect(geolocationSupported()).toBe(true)
  })
})

describe('getPosition', () => {
  it('resuelve lat/lon', async () => {
    stubGeolocation((ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6, longitude: -58.4 } }))
    await expect(getPosition()).resolves.toEqual({ lat: -34.6, lon: -58.4 })
  })
  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('código %s → GeoError %s', async (code, kind) => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code }))
    const err = await getPosition().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GeoError)
    expect(err).toMatchObject({ kind })
  })
  it('pide timeout de 10 s', async () => {
    const spy = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: 0, longitude: 0 } }))
    stubGeolocation(spy)
    await getPosition()
    expect((spy.mock.calls[0] as unknown[])[2]).toMatchObject({ timeout: 10_000 })
  })
})
