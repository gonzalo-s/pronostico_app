'use client'

import { useQueries } from '@tanstack/react-query'
import { getRiverCurrent } from '@/lib/api'
import type { RiverStation } from '@/lib/schemas'
import { findRiverStation } from '@/lib/rivers'

const FIVE_MIN_MS = 5 * 60_000

// Escalas del Paraná aguas arriba: indican si llega un pulso de caudal al Delta
export const UPSTREAM_NAMES = ['Rosario', 'Zárate', 'Campana', 'Escobar'] as const

export function useUpstreamRivers(stations: RiverStation[] | undefined) {
  const found = UPSTREAM_NAMES.flatMap((name) => {
    const s = stations ? findRiverStation(stations, name) : undefined
    return s ? [s] : []
  })
  const results = useQueries({
    queries: found.map((s) => ({
      queryKey: ['river-current', s.id],
      queryFn: () => getRiverCurrent(s.id),
      staleTime: FIVE_MIN_MS,
    })),
  })
  return found.flatMap((s, i) => {
    const data = results[i]?.data?.data
    return data ? [{ name: s.name, current: data }] : []
  })
}
