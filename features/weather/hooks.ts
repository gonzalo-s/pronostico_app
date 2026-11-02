'use client'

import { useQuery } from '@tanstack/react-query'
import { getCurrent, getForecast, getStations } from '@/lib/api'
import { pickDefaultStation } from '@/lib/stations'
import { useStation } from '@/lib/useStation'

const DAY_MS = 24 * 3600_000

export const useStations = () =>
  useQuery({ queryKey: ['stations'], queryFn: getStations, staleTime: DAY_MS })

export const useCurrent = (id: number | null) =>
  useQuery({ queryKey: ['current', id], queryFn: () => getCurrent(id as number), enabled: id !== null })

export const useForecast = (id: number | null) =>
  useQuery({ queryKey: ['forecast', id], queryFn: () => getForecast(id as number), enabled: id !== null })

/** Estación activa (la guardada o la de por defecto); `activeId` es null hasta hidratar el almacenamiento */
export function useActiveStation() {
  const { stationId, hydrated } = useStation()
  const stationsQ = useStations()
  const stations = stationsQ.data?.data
  const station = stations ? (stations.find((s) => s.id === stationId) ?? pickDefaultStation(stations)) : undefined
  return { stationsQ, stations, station, activeId: hydrated && station ? station.id : null }
}
