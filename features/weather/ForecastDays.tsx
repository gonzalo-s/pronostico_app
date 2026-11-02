'use client'

import { useState } from 'react'
import { EMPTY, artDate, compass, formatDayLabel, formatTemp, formatTime, formatValue } from '@/lib/format'
import { rainIcon, rainLevel, type RainLevel } from '@/lib/rain'
import type { ForecastDay, ForecastStep } from '@/lib/schemas'
import { Wind } from './Wind'

interface Props {
  days: ForecastDay[]
  steps: ForecastStep[]
  today: string
}

function RainIcon({ level }: { level: RainLevel | null }) {
  if (level === null) return null
  const { Icon, label } = rainIcon(level)
  return <Icon className="rain__icon" role="img" aria-label={label} />
}

function StepList({ id, steps }: { id: string; steps: ForecastStep[] }) {
  return (
    <ul id={id} className="steps" aria-label="Pasos de 3 horas">
      {steps.map((s) => (
        <li key={s.at} className="step">
          <span>{formatTime(s.at)}</span>
          <span>{formatTemp(s.temp_c)}</span>
          <Wind dir={compass(s.wind_dir_deg)} deg={s.wind_dir_deg} kmh={s.wind_kmh} />
          {s.precip_mm === 0 ? (
            <span className="muted">Sin lluvia</span>
          ) : (
            <span>
              <RainIcon level={rainLevel(s.precip_mm, 'step')} />
              {s.precip_mm === null ? EMPTY : formatValue(s.precip_mm, 'mm', 1)}
            </span>
          )}
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
                  {day.precip_mm_total > 0 ? (
                    <>
                      <RainIcon level={rainLevel(day.precip_mm_total, 'day')} />
                      {`Lluvia prevista ${formatValue(day.precip_mm_total, 'mm', 1)}`}
                    </>
                  ) : (
                    'Sin lluvia prevista'
                  )}
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
