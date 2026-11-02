'use client'

import { useEffect, useMemo, useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { titleCase } from '@/lib/format'
import type { Station } from '@/lib/schemas'

interface Props {
  open: boolean
  stations: Station[]
  selectedId: number | null
  onSelect: (id: number) => void
  onClose: () => void
}

const normalize = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function StationPicker({ open, stations, selectedId, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    return q ? stations.filter((s) => normalize(`${s.name} ${s.province}`).includes(q)) : stations
  }, [stations, query])

  return (
    <BottomSheet open={open} title="Elegir estación" onClose={onClose}>
      <input
        type="search"
        className="search"
        placeholder="Buscar estación"
        aria-label="Buscar estación"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="stationlist">
        {filtered.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              aria-current={s.id === selectedId ? 'true' : undefined}
              onClick={() => {
                onSelect(s.id)
                onClose()
              }}
            >
              <span className="station__name">{titleCase(s.name)}</span>
              <span className="muted">{titleCase(s.province)}</span>
            </button>
          </li>
        ))}
      </ul>
      {filtered.length === 0 && <p className="muted">Sin resultados</p>}
    </BottomSheet>
  )
}
