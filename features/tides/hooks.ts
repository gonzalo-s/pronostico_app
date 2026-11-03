'use client'

import { useQuery } from '@tanstack/react-query'
import { getTideCurrent, getTideExtremes, getTideForecast, getTideHeights } from '@/lib/api'
import type { HistoryRange } from '@/lib/history'

const FIVE_MIN_MS = 5 * 60_000

// Mareógrafo del SHN que representa la zona de Tigre, San Fernando y Victoria
export const TIDE_STATION_ID = 2

export const useTideCurrent = () =>
  useQuery({ queryKey: ['tide-current', TIDE_STATION_ID], queryFn: () => getTideCurrent(TIDE_STATION_ID) })

export const useTideExtremes = (range: HistoryRange) =>
  useQuery({
    queryKey: ['tide-extremes', TIDE_STATION_ID, range],
    queryFn: () => getTideExtremes(TIDE_STATION_ID, range),
    staleTime: FIVE_MIN_MS,
  })

// 404 = el mareógrafo no tiene pronóstico (no es un error)
export const useTideForecast = () =>
  useQuery({
    queryKey: ['tide-forecast', TIDE_STATION_ID],
    queryFn: () => getTideForecast(TIDE_STATION_ID),
    staleTime: FIVE_MIN_MS,
  })

export const useTideHeights = (range: HistoryRange) =>
  useQuery({
    queryKey: ['tide-heights', TIDE_STATION_ID, range],
    queryFn: () => getTideHeights(TIDE_STATION_ID, range),
    staleTime: FIVE_MIN_MS,
  })
