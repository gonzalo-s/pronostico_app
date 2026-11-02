'use client'

import { useState } from 'react'
import { formatAltitude, formatDistance, titleCase } from '@/lib/format'
import type { Station } from '@/lib/schemas'
import { useStation } from '@/lib/useStation'
import { StationPicker } from './StationPicker'

interface Props {
  stations: Station[] | undefined
  station: Station | undefined
}

export function StationBar({ stations, station }: Props) {
  const { setStationId, distanceKm } = useStation()
  const [open, setOpen] = useState(false)
  const detail = station
    ? [titleCase(station.province), formatAltitude(station.altitude_m)].filter(Boolean).join(' · ')
    : null

  return (
    <>
      <header className="header">
        <button
          type="button"
          className="station-btn"
          onClick={() => setOpen(true)}
          disabled={!stations}
          aria-haspopup="dialog"
        >
          <span className="station-btn__name">{station ? titleCase(station.name) : 'Cargando…'}</span>
          {detail && <span className="muted">{detail}</span>}
          <span aria-hidden="true">▾</span>
        </button>
      </header>
      {distanceKm !== null && <p className="muted station-distance">{formatDistance(distanceKm)}</p>}
      {stations && (
        <StationPicker
          open={open}
          stations={stations}
          selectedId={station?.id ?? null}
          onSelect={setStationId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
