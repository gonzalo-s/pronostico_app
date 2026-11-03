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
import { trendInfo } from '@/lib/tides'
import { TideChart } from './TideChart'
import { TideEvents } from './TideEvents'
import { useTideCurrent, useTideExtremes, useTideForecast, useTideHeights } from './hooks'

const MAX_EXTREMES = 6

export function TidesScreen() {
  const online = useOnline()
  const [range, setRange] = useState<HistoryRange>('24h')
  const currentQ = useTideCurrent()
  const heightsQ = useTideHeights(range)
  const extremesQ = useTideExtremes(range)
  const forecastQ = useTideForecast()
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

  const forecastBody = () => {
    if (forecastQ.data !== undefined) {
      const { events, valid_to } = forecastQ.data.data
      return (
        <>
          {valid_to && <p className="muted">Emisión válida hasta {formatDateTime(valid_to)}</p>}
          <TideEvents events={events} empty="Sin pleamares ni bajamares previstas por ahora" />
        </>
      )
    }
    if (forecastQ.isError) {
      if (forecastQ.error instanceof ApiError && forecastQ.error.kind === 'not_found') {
        return <p className="muted">Sin pronóstico para este mareógrafo</p>
      }
      return (
        <Banner tone="error" onRetry={() => void forecastQ.refetch()}>{errorMessage(forecastQ.error)}</Banner>
      )
    }
    return <Skeleton height={140} />
  }

  const extremesBody = () => {
    if (extremesQ.data !== undefined) {
      // Los más recientes primero; en períodos largos se muestran los últimos
      const latest = extremesQ.data.data.slice(-MAX_EXTREMES).reverse()
      return <TideEvents events={latest} empty="Sin pleamares ni bajamares observadas en este período" />
    }
    if (extremesQ.isError) {
      return <Banner tone="error" onRetry={() => void extremesQ.refetch()}>{errorMessage(extremesQ.error)}</Banner>
    }
    return <Skeleton height={140} />
  }

  const current = currentQ.data?.data
  const trend = current ? trendInfo(current.trend, current.change_m_per_hour) : null
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
            {trend && <p className="tide-trend"><span aria-hidden="true">{trend.arrow}</span> {trend.text}</p>}
            <p className="muted">Última lectura: {formatDateTime(current.at)}</p>
          </>
        ) : currentQ.isError ? (
          <Banner tone="error" onRetry={() => void currentQ.refetch()}>{errorMessage(currentQ.error)}</Banner>
        ) : (
          <Skeleton height={80} />
        )}
      </section>

      <section className="card" aria-labelledby="tide-forecast-title">
        <h2 id="tide-forecast-title" className="card__title">Próximas pleamares y bajamares</h2>
        {forecastBody()}
      </section>

      <section className="card" aria-labelledby="tide-chart-title">
        <h2 id="tide-chart-title" className="card__title">Altura de marea</h2>
        <Segmented label="Período" options={RANGES} value={range} onChange={setRange} />
        {heightsBody()}
        <h3 className="card__title">Pleamares y bajamares observadas</h3>
        {extremesBody()}
      </section>

      <footer className="footer muted">
        <p>Fuente: SHN{updatedAt ? ` · Actualizado ${formatDateTime(updatedAt)}` : ''}</p>
        <p>Alturas medidas por el mareógrafo de San Fernando; las pleamares y bajamares previstas son el pronóstico del SHN. La marea en Tigre y Victoria puede diferir levemente, y el viento (sudestada) la modifica.</p>
      </footer>
    </>
  )
}
