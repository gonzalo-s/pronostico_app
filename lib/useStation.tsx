'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'pronostico:stationId'

interface StationContextValue {
  stationId: number | null
  setStationId: (id: number) => void
  hydrated: boolean
}

const StationContext = createContext<StationContextValue | null>(null)

export function StationProvider({ children }: { children: ReactNode }) {
  const [stationId, setId] = useState<number | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw && /^\d+$/.test(raw) && Number(raw) > 0) setId(Number(raw))
    } catch {
      // localStorage no disponible: se usa la estación por defecto
    }
    setHydrated(true)
  }, [])

  const setStationId = useCallback((id: number) => {
    setId(id)
    try {
      localStorage.setItem(STORAGE_KEY, String(id))
    } catch {
      // sin persistencia
    }
  }, [])

  const value = useMemo(() => ({ stationId, setStationId, hydrated }), [stationId, setStationId, hydrated])
  return <StationContext.Provider value={value}>{children}</StationContext.Provider>
}

export function useStation(): StationContextValue {
  const ctx = useContext(StationContext)
  if (!ctx) throw new Error('useStation debe usarse dentro de <StationProvider>')
  return ctx
}
