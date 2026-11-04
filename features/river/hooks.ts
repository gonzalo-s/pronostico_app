'use client'

import { useQuery } from '@tanstack/react-query'
import { getRiverCurrent, getRiverForecast, getRiverHeights, getRiverStations } from '@/lib/api'
import { findRiverStation } from '@/lib/rivers'

const DAY_MS = 24 * 3600_000
const FIVE_MIN_MS = 5 * 60_000

// Escala del río que representa la zona de Tigre, San Fernando y Victoria
const RIVER_STATION_NAME = 'San Fernando'

export const useRiverStations = () =>
  useQuery({ queryKey: ['river-stations'], queryFn: getRiverStations, staleTime: DAY_MS })

export function useRiverStation() {
  const stationsQ = useRiverStations()
  const station = stationsQ.data ? findRiverStation(stationsQ.data.data, RIVER_STATION_NAME) : undefined
  return { stationsQ, station }
}

export const useRiverCurrent = (id: number | null) =>
  useQuery({
    queryKey: ['river-current', id],
    queryFn: () => getRiverCurrent(id as number),
    enabled: id !== null,
    staleTime: FIVE_MIN_MS,
  })

// Solo se pide si la estación tiene corrida (`has_forecast`): el resto responde 404
export const useRiverForecast = (id: number | null, enabled: boolean) =>
  useQuery({
    queryKey: ['river-forecast', id],
    queryFn: () => getRiverForecast(id as number),
    enabled: id !== null && enabled,
    staleTime: FIVE_MIN_MS,
  })

export const useRiverHeights = (id: number | null, enabled: boolean) =>
  useQuery({
    queryKey: ['river-heights', id, '48h'],
    queryFn: () => getRiverHeights(id as number, '48h'),
    enabled: id !== null && enabled,
    staleTime: FIVE_MIN_MS,
  })
