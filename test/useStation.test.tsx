import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { StationProvider, useStation } from '@/lib/useStation'

beforeEach(() => localStorage.clear())
const setup = () => renderHook(() => useStation(), { wrapper: StationProvider })

describe('useStation', () => {
  it('arranca sin estación y queda hidratado', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.stationId).toBeNull()
  })
  it('lee la estación guardada', async () => {
    localStorage.setItem('pronostico:stationId', '42')
    const { result } = setup()
    await waitFor(() => expect(result.current.stationId).toBe(42))
    expect(result.current.hydrated).toBe(true)
  })
  it('ignora valores inválidos', async () => {
    localStorage.setItem('pronostico:stationId', 'abc')
    const { result } = setup()
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(result.current.stationId).toBeNull()
  })
  it('persiste setStationId', async () => {
    const { result } = setup()
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    act(() => result.current.setStationId(7))
    expect(result.current.stationId).toBe(7)
    expect(localStorage.getItem('pronostico:stationId')).toBe('7')
  })
  it('lanza fuera del provider', () => {
    expect(() => renderHook(() => useStation())).toThrow()
  })
})
