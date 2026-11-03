'use client'

import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'

// Distancia (px) de arrastre a partir de la cual al soltar se recarga
const THRESHOLD = 90
const MAX_PULL = 140

export function PullToRefresh() {
  const client = useQueryClient()
  const fetching = useIsFetching() > 0
  const [pull, setPull] = useState(0)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)

  useEffect(() => {
    const update = (value: number) => {
      pullRef.current = value
      setPull(value)
    }
    const onStart = (e: TouchEvent) => {
      const inSheet = e.target instanceof Element && e.target.closest('.sheet') !== null
      startY.current = window.scrollY <= 0 && !inSheet && e.touches.length === 1 ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      update(dy > 0 && window.scrollY <= 0 ? Math.min(dy, MAX_PULL) : 0)
    }
    const onEnd = () => {
      if (startY.current !== null && pullRef.current >= THRESHOLD) void client.invalidateQueries()
      startY.current = null
      update(0)
    }
    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
    }
  }, [client])

  const pulling = pull > 0
  if (!pulling && !fetching) return null
  const text = pulling ? (pull >= THRESHOLD ? 'Soltá para actualizar' : 'Tirá para actualizar') : 'Actualizando…'
  return (
    <div className="ptr" role="status" style={pulling ? { transform: `translateY(${pull / 2}px)` } : undefined}>
      {text}
    </div>
  )
}
