'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime, isStale, titleCase, todayArt } from '@/lib/format'
import { pickDefaultStation } from '@/lib/stations'
import { useOnline } from '@/lib/useOnline'
import { useStation } from '@/lib/useStation'
import { CurrentCard } from './CurrentCard'
import { ForecastDays } from './ForecastDays'
import { StationPicker } from './StationPicker'
import { errorMessage } from './errorMessage'
import { useCurrent, useForecast, useStations } from './hooks'

function renderQuery<T>(q: UseQueryResult<T, Error>, height: number, render: (data: T) => ReactNode): ReactNode {
  if (q.data !== undefined) {
    return (
      <>
        {q.isError && <Banner tone="warn">{errorMessage(q.error)}. Mostrando los últimos datos guardados.</Banner>}
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
  const { stationId, setStationId, hydrated } = useStation()
  const online = useOnline()
  const [pickerOpen, setPickerOpen] = useState(false)

  const stationsQ = useStations()
  const stations = stationsQ.data?.data
  const station = stations ? (stations.find((s) => s.id === stationId) ?? pickDefaultStation(stations)) : undefined
  const activeId = hydrated && station ? station.id : null

  const currentQ = useCurrent(activeId)
  const forecastQ = useForecast(activeId)

  const now = new Date()
  const updatedAt = forecastQ.data?.meta.updated_at ?? currentQ.data?.meta.updated_at ?? null

  return (
    <>
      <header className="header">
        <button
          type="button"
          className="station-btn"
          onClick={() => setPickerOpen(true)}
          disabled={!stations}
          aria-haspopup="dialog"
        >
          <span className="station-btn__name">{station ? titleCase(station.name) : 'Cargando…'}</span>
          {station && <span className="muted">{titleCase(station.province)}</span>}
          <span aria-hidden="true">▾</span>
        </button>
      </header>

      {!online && <Banner tone="warn">Sin conexión: se muestran los últimos datos guardados.</Banner>}

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

      {stations && (
        <StationPicker
          open={pickerOpen}
          stations={stations}
          selectedId={station?.id ?? null}
          onSelect={setStationId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
