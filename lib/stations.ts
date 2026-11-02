import type { Station } from './schemas'

const DEFAULT_NAME = 'BUENOS AIRES'

export function pickDefaultStation(stations: Station[]): Station | undefined {
  const upper = (s: Station) => s.name.toUpperCase()
  return (
    stations.find((s) => upper(s) === DEFAULT_NAME) ??
    stations.find((s) => upper(s).startsWith(DEFAULT_NAME)) ??
    stations[0]
  )
}
