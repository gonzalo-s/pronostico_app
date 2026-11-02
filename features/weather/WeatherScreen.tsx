'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime, isStale, todayArt } from '@/lib/format'
import { pickDefaultStation } from '@/lib/stations'
import { useOnline } from '@/lib/useOnline'
import { useStation } from '@/lib/useStation'
import { CurrentCard } from './CurrentCard'
import { ForecastDays } from './ForecastDays'
import { StationBar } from './StationBar'
import { errorMessage } from './errorMessage'
import { useCurrent, useForecast, useStations } from './hooks'

function renderQuery<T>(q: UseQueryResult<T, Error>, height: number, render: (data: T) => ReactNode): ReactNode {
  if (q.data !== undefined) {
    return (
      <>
        {q.isError && (
          <Banner tone="warn" onRetry={() => void q.refetch()}>
            {errorMessage(q.error)}. Mostrando los últimos datos guardados.
          </Banner>
        )}
        {render(q.data)}
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
  return <Skeleton height={height} />
}

export function WeatherScreen() {
  const { stationId, hydrated } = useStation()
  const online = useOnline()

  const stationsQ = useStations()
  const stations = stationsQ.data?.data
  const station = stations ? (stations.find((s) => s.id === stationId) ?? pickDefaultStation(stations)) : undefined
  const activeId = hydrated && station ? station.id : null

  const currentQ = useCurrent(activeId)
  const forecastQ = useForecast(activeId)

  const hasData = Boolean(currentQ.data || forecastQ.data)
  const now = new Date()
  const updatedAt = forecastQ.data?.meta.updated_at ?? currentQ.data?.meta.updated_at ?? null

  return (
    <>
      <StationBar stations={stations} station={station} />

      {!online && (
        <Banner tone="warn">
          {hasData ? 'Sin conexión. Mostrando los últimos datos guardados.' : 'Sin conexión.'}
        </Banner>
      )}

      {!stations && stationsQ.isError && (
        <Banner tone="error" onRetry={() => void stationsQ.refetch()}>
          {errorMessage(stationsQ.error)}
        </Banner>
      )}
      {!stations && stationsQ.isPending && <Skeleton height={180} />}

      {station && (
        <>
          {renderQuery(currentQ, 220, (data) => (
            <>
              {isStale(data.meta.updated_at, now) && <Banner tone="warn">Datos desactualizados</Banner>}
              <CurrentCard current={data.data} />
            </>
          ))}
          {renderQuery(forecastQ, 260, (data) => (
            <>
              {isStale(data.meta.updated_at, now) && <Banner tone="warn">Datos desactualizados</Banner>}
              <ForecastDays days={data.data.days} steps={data.data.steps} today={todayArt(now)} />
            </>
          ))}
        </>
      )}

      <footer className="footer muted">
        <p>Fuente: SMN{updatedAt ? ` · Actualizado ${formatDateTime(updatedAt)}` : ''}</p>
        {forecastQ.data?.meta.note && <p>{forecastQ.data.meta.note}</p>}
      </footer>
    </>
  )
}
