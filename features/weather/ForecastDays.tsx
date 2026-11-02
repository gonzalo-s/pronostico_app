'use client'

import { useState } from 'react'
import { EMPTY, artDate, compass, formatDayLabel, formatTemp, formatTime, formatValue, windText } from '@/lib/format'
import type { ForecastDay, ForecastStep } from '@/lib/schemas'

interface Props {
  days: ForecastDay[]
  steps: ForecastStep[]
  today: string
}

function StepList({ id, steps }: { id: string; steps: ForecastStep[] }) {
  return (
    <ul id={id} className="steps" aria-label="Pasos de 3 horas">
      {steps.map((s) => (
        <li key={s.at} className="step">
          <span>{formatTime(s.at)}</span>
          <span>{formatTemp(s.temp_c)}</span>
          <span>{windText(compass(s.wind_dir_deg), s.wind_kmh)}</span>
          <span>{s.precip_mm === null ? EMPTY : formatValue(s.precip_mm, 'mm', 1)}</span>
        </li>
      ))}
    </ul>
  )
}

export function ForecastDays({ days, steps, today }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section className="card" aria-labelledby="forecast-title">
      <h2 id="forecast-title" className="card__title">Próximos días</h2>
      <ul className="days">
        {days.map((day) => {
          const expanded = open === day.date
          const panelId = `steps-${day.date}`
          return (
            <li key={day.date}>
              <button
                type="button"
                className="day"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : day.date)}
              >
                <span className="day__label">{formatDayLabel(day.date, today)}</span>
                <span className="day__rain">
                  {day.precip_mm_total > 0
                    ? `Lluvia prevista ${formatValue(day.precip_mm_total, 'mm', 1)}`
                    : 'Sin lluvia prevista'}
                </span>
                <span className="day__range">
                  {formatTemp(day.temp_min_c)} / {formatTemp(day.temp_max_c)}
                </span>
              </button>
              {expanded && <StepList id={panelId} steps={steps.filter((s) => artDate(s.at) === day.date)} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
