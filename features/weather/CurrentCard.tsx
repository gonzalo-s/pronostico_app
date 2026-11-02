import type { ReactNode } from 'react'
import { EMPTY, formatTemp, formatTime, formatValue, isDaytime } from '@/lib/format'
import type { Current } from '@/lib/schemas'
import { skyIcon } from '@/lib/skyIcon'
import { Wind } from './Wind'

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function CurrentCard({ current }: { current: Current }) {
  const Icon = skyIcon(current.sky, isDaytime(current.observed_at))
  return (
    <section className="card" aria-labelledby="current-title">
      <h2 id="current-title" className="card__title">Ahora</h2>
      <div className="current__main">
        <p className="current__temp">{formatTemp(current.temp_c)}</p>
        {Icon && <Icon className="current__icon" aria-hidden="true" />}
      </div>
      <p className="current__sky">{current.sky ?? EMPTY}</p>
      <dl className="stats">
        <Stat label="Sensación" value={formatTemp(current.feels_like_c)} />
        <Stat label="Humedad" value={formatValue(current.humidity_pct, '%')} />
        <Stat label="Viento" value={<Wind dir={current.wind_dir} kmh={current.wind_kmh} variable={current.wind_variable} />} />
        <Stat label="Presión" value={formatValue(current.pressure_hpa, 'hPa', 1)} />
        <Stat label="Visibilidad" value={formatValue(current.visibility_km, 'km', 1)} />
      </dl>
      <p className="muted">Observado a las {formatTime(current.observed_at)}</p>
    </section>
  )
}
