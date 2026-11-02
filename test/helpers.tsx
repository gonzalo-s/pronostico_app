import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { StationProvider } from '@/lib/useStation'

export function mockFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const route = routes[String(input).replace(/^.*\/api\/smn\//, '')]
    if (!route) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  return render(
    <QueryClientProvider client={client}>
      <StationProvider>{ui}</StationProvider>
    </QueryClientProvider>,
  )
}
