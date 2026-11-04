import type { Station } from './schemas'

const DEFAULT_NAME = 'BUENOS AIRES'

const rad = (d: number) => (d * Math.PI) / 180

/** Estación más cercana a un punto (distancia al círculo máximo) */
export function nearestTo(stations: Station[], lat: number, lon: number): Station | undefined {
  const dist = (s: Station) => {
    const a = Math.sin(rad(s.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(s.lat)) * Math.sin(rad(s.lon - lon) / 2) ** 2
    return 2 * Math.asin(Math.sqrt(a))
  }
  return stations.reduce<Station | undefined>((best, s) => (best === undefined || dist(s) < dist(best) ? s : best), undefined)
}

export function pickDefaultStation(stations: Station[]): Station | undefined {
  const upper = (s: Station) => s.name.toUpperCase()
  return (
    stations.find((s) => upper(s) === DEFAULT_NAME) ??
    stations.find((s) => upper(s).startsWith(DEFAULT_NAME)) ??
    stations[0]
  )
}
