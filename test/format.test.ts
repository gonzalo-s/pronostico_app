import { describe, expect, it } from 'vitest'
import {
  EMPTY, artDate, compass, formatDateTime, formatDayLabel, formatTemp, formatTime,
  formatValue, isDaytime, isStale, titleCase, todayArt, windText,
} from '@/lib/format'

describe('formatValue / formatTemp', () => {
  it('nulos → "—"', () => {
    expect(formatValue(null, 'km')).toBe(EMPTY)
    expect(formatTemp(null)).toBe(EMPTY)
  })
  it('formatea con coma decimal y unidad', () => {
    expect(formatValue(1013.2, 'hPa', 1)).toBe('1013,2 hPa')
    expect(formatValue(58, '%')).toBe('58 %')
  })
  it('redondea la temperatura y evita "-0"', () => {
    expect(formatTemp(22.4)).toBe('22°')
    expect(formatTemp(-3.2)).toBe('-3°')
    expect(formatTemp(-0.4)).toBe('0°')
  })
})

describe('fechas en ART', () => {
  it('formatTime', () => {
    expect(formatTime('2026-11-02T17:30:00Z')).toBe('14:30')
    expect(formatTime('2026-11-03T03:00:00Z')).toBe('00:00')
  })
  it('formatDateTime incluye la hora ART', () => {
    expect(formatDateTime('2026-11-02T17:30:00Z')).toContain('14:30')
  })
  it('artDate / todayArt', () => {
    expect(artDate('2026-11-03T01:00:00Z')).toBe('2026-11-02')
    expect(todayArt(new Date('2026-11-02T12:00:00Z'))).toBe('2026-11-02')
  })
  it('formatDayLabel', () => {
    expect(formatDayLabel('2026-11-02', '2026-11-02')).toBe('Hoy')
    expect(formatDayLabel('2026-11-03', '2026-11-02')).toBe('Mañana')
    expect(formatDayLabel('2026-11-04', '2026-11-02')).toBe('Miércoles')
  })
})

describe('viento y brújula', () => {
  it('compass', () => {
    expect(compass(null)).toBeNull()
    expect(compass(0)).toBe('N')
    expect(compass(90)).toBe('E')
    expect(compass(225)).toBe('SO')
    expect(compass(359)).toBe('N')
  })
  it('windText', () => {
    expect(windText('Norte', 14)).toBe('Norte 14 km/h')
    expect(windText(null, 5, true)).toBe('Variable 5 km/h')
    expect(windText(null, 5)).toBe('5 km/h')
    expect(windText('Norte', null)).toBe(EMPTY)
  })
})

describe('isStale', () => {
  const now = new Date('2026-11-02T20:00:00Z')
  it('más de 6 h → true', () => expect(isStale('2026-11-02T13:00:00Z', now)).toBe(true))
  it('menos de 6 h → false', () => expect(isStale('2026-11-02T15:00:00Z', now)).toBe(false))
  it('sin fecha → false', () => expect(isStale(null, now)).toBe(false))
})

describe('titleCase', () => {
  it('capitaliza cada palabra', () => {
    expect(titleCase('BUENOS AIRES AERO')).toBe('Buenos Aires Aero')
    expect(titleCase('TIERRA DEL FUEGO')).toBe('Tierra del Fuego')
    expect(titleCase('DE LA PLATA')).toBe('De la Plata')
    expect(titleCase('SAN MIGUEL DE TUCUMÁN')).toBe('San Miguel de Tucumán')
  })
})

describe('isDaytime', () => {
  it.each([
    ['2026-11-02T10:00:00.000Z', true],  // 07:00 ART
    ['2026-11-02T21:59:00.000Z', true],  // 18:59 ART
    ['2026-11-02T22:00:00.000Z', false], // 19:00 ART
    ['2026-11-02T09:59:00.000Z', false], // 06:59 ART
    ['2026-11-02T03:00:00.000Z', false], // 00:00 ART
  ])('%s → %s', (iso, expected) => {
    expect(isDaytime(iso)).toBe(expected)
  })
})
