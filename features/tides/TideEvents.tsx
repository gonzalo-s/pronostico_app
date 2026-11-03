import { formatDateTime, formatHeight } from '@/lib/format'
import type { TideEvent } from '@/lib/schemas'
import { levelOf } from '@/lib/tides'

interface Props {
  events: TideEvent[]
  empty: string
}

const LABEL = { high: 'Pleamar', low: 'Bajamar' } as const

export function TideEvents({ events, empty }: Props) {
  if (events.length === 0) return <p className="muted">{empty}</p>
  return (
    <ul className="tide-events">
      {events.map((e) => (
        <li key={`${e.kind}-${e.at}`}>
          <span className="tide-legend__swatch" style={{ background: `var(--tide-${levelOf(e.height_m)})` }} aria-hidden="true" />
          <span className="tide-events__kind">{LABEL[e.kind]}</span>
          <span className="tide-events__height">{formatHeight(e.height_m)}</span>
          <span className="muted">{formatDateTime(e.at)}</span>
        </li>
      ))}
    </ul>
  )
}
