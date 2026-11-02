'use client'

import { useState } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { METRICS, RANGES, type HistoryRange, type MetricKey } from '@/lib/history'
import { useOnline } from '@/lib/useOnline'
import { StationBar } from '@/features/weather/StationBar'
import { errorMessage } from '@/features/weather/errorMessage'
import { useActiveStation } from '@/features/weather/hooks'
import { HistoryChart } from './HistoryChart'
import { useHistory } from './hooks'

export function HistoryScreen() {
  const online = useOnline()
  const { stationsQ, stations, station, activeId } = useActiveStation()
  const [range, setRange] = useState<HistoryRange>('24h')
  const [metric, setMetric] = useState<MetricKey>('temp_c')
  const q = useHistory(activeId, range)

  const body = () => {
    if (q.data !== undefined) {
      return (
        <>
          {q.isError && (
            <Banner tone="warn" onRetry={() => void q.refetch()}>
              {errorMessage(q.error)}. Mostrando los últimos datos guardados.
            </Banner>
          )}
          <HistoryChart points={q.data.data} metric={metric} range={range} />
        </>
      )
    }
    if (q.isError) {
      const retryable = !(q.error instanceof ApiError && q.error.kind === 'not_found')
      return (
        <Banner tone="error" onRetry={retryable ? () => void q.refetch() : undefined}>
          {errorMessage(q.error)}
        </Banner>
      )
    }
    return <Skeleton height={260} />
  }

  const updatedAt = q.data?.meta.updated_at ?? null

  return (
    <>
      <StationBar stations={stations} station={station} />

      {!online && (
        <Banner tone="warn">
          {q.data ? 'Sin conexión. Mostrando los últimos datos guardados.' : 'Sin conexión.'}
        </Banner>
      )}

      {!stations && stationsQ.isError && (
        <Banner tone="error" onRetry={() => void stationsQ.refetch()}>
          {errorMessage(stationsQ.error)}
        </Banner>
      )}
      {!stations && stationsQ.isPending && <Skeleton height={180} />}

      {station && (
        <section className="card" aria-labelledby="history-title">
          <h2 id="history-title" className="card__title">Histórico</h2>
          <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
          <Segmented label="Métrica" options={METRICS} value={metric} onChange={setMetric} />
          {body()}
        </section>
      )}

      <footer className="footer muted">
        <p>Fuente: SMN{updatedAt ? ` · Actualizado ${formatDateTime(updatedAt)}` : ''}</p>
      </footer>
    </>
  )
}
