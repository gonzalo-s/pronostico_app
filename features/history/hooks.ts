'use client'

import { useQuery } from '@tanstack/react-query'
import { getHistory } from '@/lib/api'
import type { HistoryRange } from '@/lib/history'

const FIVE_MIN_MS = 5 * 60_000

export const useHistory = (id: number | null, range: HistoryRange) =>
  useQuery({
    queryKey: ['history', id, range],
    queryFn: () => getHistory(id as number, range),
    enabled: id !== null,
    staleTime: FIVE_MIN_MS,
  })
