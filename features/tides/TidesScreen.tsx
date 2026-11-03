'use client'

import { useState } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Segmented } from '@/components/ui/Segmented'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime, formatHeight, isStale } from '@/lib/format'
import { RANGES, type HistoryRange } from '@/lib/history'
import { useOnline } from '@/lib/useOnline'
import { errorMessage } from '@/features/weather/errorMessage'
import { TideChart } from './TideChart'
import { useTideCurrent, useTideHeights } from './hooks'

export function TidesScreen() {
  const online = useOnline()
  const [range, setRange] = useState<HistoryRange>('24h')
  const currentQ = useTideCurrent()
  const heightsQ = useTideHeights(range)
  const now = new Date()

  const heightsBody = () => {
    if (heightsQ.data !== undefined) {
      return (
        <>
          {heightsQ.isError && (
            <Banner tone="warn" onRetry={() => void heightsQ.refetch()}>
              {errorMessage(heightsQ.error)}. Mostrando los últimos datos guardados.
            </Banner>
          )}
          <TideChart readings={heightsQ.data.data} range={range} />
        </>
      )
    }
    if (heightsQ.isError) {
      const retryable = !(heightsQ.error instanceof ApiError && heightsQ.error.kind === 'not_found')
      return (
        <Banner tone="error" onRetry={retryable ? () => void heightsQ.refetch() : undefined}>
          {errorMessage(heightsQ.error)}
        </Banner>
      )
    }
    return <Skeleton height={260} />
  }

  const current = currentQ.data?.data
  const updatedAt = currentQ.data?.meta.updated_at ?? heightsQ.data?.meta.updated_at ?? null

  return (
    <>
      <header className="header header--stack">
        <h1 className="station-btn__name">San Fernando</h1>
        <span className="muted">Referencia para Tigre, San Fernando y Victoria</span>
      </header>

      {!online && (
        <Banner tone="warn">
          {currentQ.data || heightsQ.data ? 'Sin conexión. Mostrando los últimos datos guardados.' : 'Sin conexión.'}
        </Banner>
      )}

      <section className="card" aria-labelledby="tide-now-title">
        <h2 id="tide-now-title" className="card__title">Marea ahora</h2>
        {current ? (
          <>
            {isStale(current.updated_at, now) && <Banner tone="warn">Datos desactualizados</Banner>}
            <p className="current__temp">{formatHeight(current.height_m)}</p>
            <p className="muted">Última lectura: {formatDateTime(current.at)}</p>
          </>
        ) : currentQ.isError ? (
          <Banner tone="error" onRetry={() => void currentQ.refetch()}>{errorMessage(currentQ.error)}</Banner>
        ) : (
          <Skeleton height={80} />
        )}
      </section>

      <section className="card" aria-labelledby="tide-chart-title">
        <h2 id="tide-chart-title" className="card__title">Altura de marea</h2>
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
        {heightsBody()}
      </section>

      <footer className="footer muted">
        <p>Fuente: SHN{updatedAt ? ` · Actualizado ${formatDateTime(updatedAt)}` : ''}</p>
        <p>Alturas medidas por el mareógrafo de San Fernando. No son una predicción. La marea en Tigre y Victoria puede diferir levemente, y el viento (sudestada) la modifica.</p>
      </footer>
    </>
  )
}
