'use client'

import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime, formatHeight } from '@/lib/format'
import { OFFICIAL, bandText, changeText } from '@/lib/rivers'
import { errorMessage } from '@/features/weather/errorMessage'
import { RiverForecastChart } from './RiverForecastChart'
import { useRiverCurrent, useRiverForecast, useRiverHeights, useRiverStation } from './hooks'

const isNotFound = (e: unknown) => e instanceof ApiError && e.kind === 'not_found'

export function RiverSection({ now }: { now: Date }) {
  const { stationsQ, station } = useRiverStation()
  const id = station?.id ?? null
  const currentQ = useRiverCurrent(id)
  const hasForecast = station?.has_forecast ?? false
  const forecastQ = useRiverForecast(id, hasForecast)
  const heightsQ = useRiverHeights(id, hasForecast)

  if (stationsQ.isPending) return <Skeleton height={140} />
  if (stationsQ.isError) {
    return (
      <Banner tone="error" onRetry={() => void stationsQ.refetch()}>{errorMessage(stationsQ.error)}</Banner>
    )
  }
  if (!station) return null

  const current = currentQ.data?.data
  const status = current && current.official_level !== 'unknown' ? OFFICIAL[current.official_level] : null
  const change = current ? changeText(current.change_24h_m) : null
  const band = current ? bandText(current.level_band) : null
  const note = currentQ.data?.meta.note

  return (
    <>
      <section className="card" aria-labelledby="river-now-title">
        <h2 id="river-now-title" className="card__title">Río en {station.name}</h2>
        {current ? (
          <>
            <p className="current__temp">{formatHeight(current.height_m)}</p>
            {status && <p className={`river-status river-status--${status.tone}`}>{status.label}</p>}
            {change && <p>{change}</p>}
            {band && <p className="muted">{band}</p>}
            <p className="muted">
              {current.river} · lectura del {formatDateTime(current.at)}
            </p>
            {note && <p className="muted">{note}</p>}
          </>
        ) : currentQ.isError ? (
          isNotFound(currentQ.error) ? (
            <p className="muted">Sin lecturas</p>
          ) : (
            <Banner tone="error" onRetry={() => void currentQ.refetch()}>{errorMessage(currentQ.error)}</Banner>
          )
        ) : (
          <Skeleton height={100} />
        )}
      </section>

      {hasForecast && !(forecastQ.isError && isNotFound(forecastQ.error)) && (
        <section className="card" aria-labelledby="river-forecast-title">
          <h2 id="river-forecast-title" className="card__title">Pronóstico del río</h2>
          {forecastQ.data ? (
            <RiverForecastChart forecast={forecastQ.data.data} readings={heightsQ.data?.data ?? []} now={now} />
          ) : forecastQ.isError ? (
            <Banner tone="error" onRetry={() => void forecastQ.refetch()}>{errorMessage(forecastQ.error)}</Banner>
          ) : (
            <Skeleton height={260} />
          )}
        </section>
      )}
    </>
  )
}
