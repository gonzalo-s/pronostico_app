export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout'

export class GeoError extends Error {
  constructor(readonly kind: GeoErrorKind) {
    super(kind)
    this.name = 'GeoError'
  }
}

// ~1 km: las estaciones distan decenas de km, no hace falta enviar la posición exacta
export const roundCoord = (n: number): number => Number(n.toFixed(2))

export function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

const TIMEOUT_MS = 10_000

export function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new GeoError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { timeout: TIMEOUT_MS, maximumAge: 300_000 },
    )
  })
}
