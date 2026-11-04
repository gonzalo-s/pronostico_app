'use client'

import { Skeleton } from '@/components/ui/Skeleton'
import { useHistory } from '@/features/history/hooks'
import { useRiverCurrent, useRiverForecast, useRiverStation } from '@/features/river/hooks'
import { useTideCurrent, useTideForecast } from '@/features/tides/hooks'
import { useForecast, useStations } from '@/features/weather/hooks'
import { EL_NINO, ZONE } from '@/lib/elnino'
import { LEVEL_LABELS, evaluateFlood, type Level, type SignalState } from '@/lib/flood'
import { formatDateTime } from '@/lib/format'
import { nearestTo } from '@/lib/stations'
import { useUpstreamRivers } from './hooks'

const STATE_TEXT: Record<SignalState, string> = { active: 'Activa', inactive: 'Sin señal', nodata: 'Sin datos' }

export function FloodScreen() {
  const tideQ = useTideCurrent()
  const tideFcQ = useTideForecast()
  const { stationsQ: riverStationsQ, station: riverStation } = useRiverStation()
  const riverId = riverStation?.id ?? null
  const riverQ = useRiverCurrent(riverId)
  const riverFcQ = useRiverForecast(riverId, riverStation?.has_forecast ?? false)
  const upstream = useUpstreamRivers(riverStationsQ.data?.data)
  const smnStationsQ = useStations()
  const smn = smnStationsQ.data ? nearestTo(smnStationsQ.data.data, ZONE.lat, ZONE.lon) : undefined
  const smnId = smn?.id ?? null
  const stepsQ = useForecast(smnId)
  const historyQ = useHistory(smnId, '7d')

  const loading = tideQ.isPending || riverStationsQ.isPending || smnStationsQ.isPending
  const now = new Date()

  if (loading) return <Skeleton height={220} />

  const result = evaluateFlood({
    now: now.getTime(),
    tide: { current: tideQ.data?.data ?? null, events: tideFcQ.data?.data.events ?? null },
    river: { current: riverQ.data?.data ?? null, forecast: riverFcQ.data?.data ?? null },
    wind: { history: historyQ.data?.data ?? null, steps: stepsQ.data?.data.steps ?? null },
    upstream,
  })
  const level: Level | null = result.level

  return (
    <>
      <header className="header header--stack">
        <h1 className="station-btn__name">Crecida</h1>
        <span className="muted">San Fernando, Tigre y Victoria</span>
      </header>

      <section className="card flood-card" aria-labelledby="flood-title" style={{ borderLeftColor: `var(--flood-${level ?? 0})` }}>
        <h2 id="flood-title" className="card__title">Posible crecida</h2>
        {level === null ? (
          <>
            <p className="flood-level">Sin datos recientes</p>
            <p className="muted">No hay lecturas actuales de marea ni de río: no se puede evaluar.</p>
          </>
        ) : (
          <>
            <p className="flood-level">{LEVEL_LABELS[level]}</p>
            <p>{result.reasons.length > 0 ? `Señales activas: ${result.reasons.join(', ')}.` : 'Sin señales de crecida.'}</p>
            {result.partial && <p className="muted">Evaluación parcial: faltan datos de alguna fuente.</p>}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="flood-evidence-title">
        <h2 id="flood-evidence-title" className="card__title">Evidencia</h2>
        <ul className="flood-signals">
          {result.signals.map((s) => (
            <li key={s.key}>
              <p className="flood-signal__head">
                <strong>{s.title}</strong>
                <span className={`flood-badge flood-badge--${s.state}`}>{STATE_TEXT[s.state]}</span>
              </p>
              {s.lines.map((line) => (
                <p key={line} className="muted">{line}</p>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="flood-nino-title">
        <h2 id="flood-nino-title" className="card__title">Contexto: El Niño</h2>
        <p>{EL_NINO.text}</p>
        <p className="muted">Fuente: {EL_NINO.source}, {EL_NINO.asOf}. Contexto estacional: no suma a la evaluación.</p>
      </section>

      <footer className="footer muted">
        <p>
          Evaluación orientativa con umbrales provisorios; no es una alerta oficial. Las predicciones pueden ser optimistas:
          se usan márgenes de prudencia y la banda alta del pronóstico del río. Ante una emergencia, seguí al SMN, al SHN y a
          Defensa Civil.
        </p>
        <p>Fuentes: SHN, INA y Prefectura Naval Argentina, SMN. Evaluado el {formatDateTime(now.toISOString())}.</p>
      </footer>
    </>
  )
}
