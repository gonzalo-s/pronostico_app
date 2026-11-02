import { EMPTY, formatTemp, formatTime, formatValue, windText } from '@/lib/format'
import type { Current } from '@/lib/schemas'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function CurrentCard({ current }: { current: Current }) {
  return (
    <section className="card" aria-labelledby="current-title">
      <h2 id="current-title" className="card__title">Ahora</h2>
      <p className="current__temp">{formatTemp(current.temp_c)}</p>
      <p className="current__sky">{current.sky ?? EMPTY}</p>
      <dl className="stats">
        <Stat label="Sensación" value={formatTemp(current.feels_like_c)} />
        <Stat label="Humedad" value={formatValue(current.humidity_pct, '%')} />
        <Stat label="Viento" value={windText(current.wind_dir, current.wind_kmh, current.wind_variable)} />
        <Stat label="Presión" value={formatValue(current.pressure_hpa, 'hPa', 1)} />
        <Stat label="Visibilidad" value={formatValue(current.visibility_km, 'km', 1)} />
      </dl>
      <p className="muted">Observado a las {formatTime(current.observed_at)}</p>
    </section>
  )
}
