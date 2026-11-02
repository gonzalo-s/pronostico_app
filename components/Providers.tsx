'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { shouldRetry } from '@/lib/api'
import { StationProvider } from '@/lib/useStation'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetry, networkMode: 'always', staleTime: 5 * 60_000 },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <StationProvider>{children}</StationProvider>
    </QueryClientProvider>
  )
}
