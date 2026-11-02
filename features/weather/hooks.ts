'use client'

import { useQuery } from '@tanstack/react-query'
import { getCurrent, getForecast, getStations } from '@/lib/api'

const DAY_MS = 24 * 3600_000

export const useStations = () =>
  useQuery({ queryKey: ['stations'], queryFn: getStations, staleTime: DAY_MS })

export const useCurrent = (id: number | null) =>
  useQuery({ queryKey: ['current', id], queryFn: () => getCurrent(id as number), enabled: id !== null })

export const useForecast = (id: number | null) =>
  useQuery({ queryKey: ['forecast', id], queryFn: () => getForecast(id as number), enabled: id !== null })
