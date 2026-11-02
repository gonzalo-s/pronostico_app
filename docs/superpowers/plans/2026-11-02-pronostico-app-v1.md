# Pronóstico App v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA mobile-first (Next.js) que muestra clima actual y pronóstico a 5 días de una estación del SMN, consumiendo la API `pronostico` a través de un proxy server-side.

**Architecture:** Next.js App Router con un route handler (`/api/smn/[...path]`) que reenvía solo rutas de una lista blanca a la API inyectando `X-API-Key` desde el entorno. El cliente valida cada respuesta con esquemas zod, cachea con TanStack Query y guarda la última estación en `localStorage`. Un service worker escrito a mano cachea el shell y las últimas respuestas para uso offline.

**Tech Stack:** Next.js (App Router, ≥15), React, TypeScript (strict), zod, @tanstack/react-query, Vitest + Testing Library (jsdom), sharp (solo para generar íconos), tsx (scripts).

Spec: `docs/superpowers/specs/2026-11-02-pronostico-app-design.md`.

## Global Constraints

- Next.js App Router + TypeScript `strict`; desplegable en Vercel.
- `X-API-Key` **nunca** llega al navegador: solo el proxy la usa. Prohibido el prefijo `NEXT_PUBLIC_` para `SMN_API_KEY` y `SMN_API_URL`.
- Variables de entorno: `SMN_API_URL` (sin barra final), `SMN_API_KEY`. Solo en entorno; nunca versionadas ni impresas. `.env.example` sin valores reales.
- La app consume solo `/v1` de la API. El proxy reenvía solo: `stations`, `stations/:id/current`, `stations/:id/forecast` (`:id` entero positivo). No reenvía query string ni cabeceras del cliente.
- Idioma: español (Argentina). Horas en ART (UTC-3 fijo).
- Nota obligatoria del pronóstico (se muestra la `meta.note` de la API): "Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN."
- Valores nulos se muestran como "—". Datos con `updated_at` de más de 6 horas: aviso "Datos desactualizados".
- Cada respuesta se valida con zod; una respuesta inválida produce el error "Respuesta inesperada de la API" (sin renderizar datos parciales).
- YAGNI: no implementar geolocalización, favoritas, histórico/gráfico ni notificaciones. Solo dejar la estructura (`features/`, esquemas de `history`/`nearest`).
- Archivos usados por scripts `tsx` (`lib/schemas.ts`, `lib/stations.ts`) importan con rutas **relativas**, no con el alias `@/`.
- Mensajes de commit terminan con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (segundo `-m`).
- Todos los comandos se ejecutan en `C:\Users\gonzalo.soler\workspace\pronostico_app` (Git Bash: `/c/Users/gonzalo.soler/workspace/pronostico_app`).

## File Structure

```
package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore, .env.example
app/layout.tsx, app/page.tsx, app/globals.css, app/manifest.ts
app/api/smn/[...path]/route.ts
components/Providers.tsx, components/ServiceWorkerRegister.tsx
components/ui/{Banner,Skeleton,BottomSheet,BottomNav}.tsx
features/weather/{hooks.ts,errorMessage.ts,CurrentCard.tsx,ForecastDays.tsx,StationPicker.tsx,WeatherScreen.tsx}
lib/{schemas,api,format,stations,navigation,proxyAllowlist,useStation,useOnline}.ts(x)
public/sw.js, public/icons/*
scripts/{refresh-fixtures.ts,make-icons.mjs}
test/{setup.ts,factories.ts,helpers.tsx,fixtures/*.json,**/*.test.ts(x)}
```

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`, `test/setup.ts`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Produces: scripts `dev`, `build`, `start`, `test`, `typecheck`, `refresh-fixtures`, `make-icons`; alias `@/*` → raíz del repo; entorno de tests jsdom con jest-dom.

- [ ] **Step 1: Crear `package.json` e instalar dependencias**

`package.json`:

```json
{
  "name": "pronostico-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "refresh-fixtures": "tsx scripts/refresh-fixtures.ts",
    "make-icons": "node scripts/make-icons.mjs"
  }
}
```

```bash
npm install next react react-dom zod @tanstack/react-query
npm install -D typescript @types/node @types/react @types/react-dom vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx sharp
```

Verificar `node -e "console.log(require('next/package.json').version)"` ≥ 15 (el proxy usa `params` como Promise).

- [ ] **Step 2: Configuración**

`tsconfig.json` (Next puede ajustar `jsx` en el primer build; está bien):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
}

export default config
```

`vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
})
```

`test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
```

`.gitignore`:

```
node_modules
.next
out
coverage
*.tsbuildinfo
next-env.d.ts
.env*
!.env.example
```

`.env.example`:

```
# URL base de la API del SMN, sin barra final (solo servidor)
SMN_API_URL=
# Clave para X-API-Key (solo servidor; nunca con prefijo NEXT_PUBLIC_)
SMN_API_KEY=
```

`app/layout.tsx` (placeholder, se reemplaza en la Task 8):

```tsx
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  )
}
```

`app/page.tsx` (placeholder):

```tsx
export default function Page() {
  return <h1>Pronóstico</h1>
}
```

- [ ] **Step 3: Verificar**

Run: `npm run typecheck && npx vitest run --passWithNoTests && npm run build`
Expected: typecheck sin errores, vitest "No test files found" con exit 0, build exitoso.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Esquemas zod del contrato y fixtures

**Files:**
- Create: `lib/schemas.ts`, `test/factories.ts`, `test/fixtures/{stations,current,current-nulls,forecast,forecast-nulls}.json`
- Test: `test/schemas.test.ts`

**Interfaces:**
- Produces (`lib/schemas.ts`): esquemas `stationSchema`, `currentSchema`, `forecastStepSchema`, `forecastDaySchema`, `historyPointSchema`, `errorSchema`; respuestas `stationsResponse`, `nearestStationResponse`, `currentResponse`, `forecastResponse`, `historyResponse`; tipos `Station`, `Current`, `ForecastStep`, `ForecastDay`, `HistoryPoint`, `StationsResponse`, `CurrentResponse`, `ForecastResponse`.
- Produces (`test/factories.ts`): `makeStation(o?)`, `makeCurrent(o?)`, `makeStep(o?)`, `makeDay(o?)`.

- [ ] **Step 1: Crear fixtures**

Los fixtures `stations/current/forecast` empiezan con valores ilustrativos con la forma documentada del contrato; la Task 3 los reemplaza con respuestas reales. Los `*-nulls` son manuales y **no** los toca el script de refresco.

`test/fixtures/stations.json`:

```json
{
  "data": [
    { "id": 1, "name": "BUENOS AIRES", "province": "CAPITAL FEDERAL", "lat": -34.58, "lon": -58.48, "altitude_m": 25 },
    { "id": 2, "name": "CORDOBA AERO", "province": "CORDOBA", "lat": -31.32, "lon": -64.21, "altitude_m": 474 },
    { "id": 3, "name": "USHUAIA AERO", "province": "TIERRA DEL FUEGO", "lat": -54.84, "lon": -68.31, "altitude_m": null }
  ],
  "meta": { "source": "SMN", "updated_at": null }
}
```

`test/fixtures/current.json`:

```json
{
  "data": {
    "id": 1, "name": "BUENOS AIRES", "province": "CAPITAL FEDERAL",
    "observed_at": "2026-11-02T17:00:00.000Z", "sky": "Despejado", "visibility_km": 10,
    "temp_c": 22.4, "feels_like_c": 23.1, "humidity_pct": 58, "wind_dir": "Norte", "wind_kmh": 14,
    "wind_variable": false, "pressure_hpa": 1013.2, "updated_at": "2026-11-02T17:17:30.000Z"
  },
  "meta": { "source": "SMN", "updated_at": "2026-11-02T17:17:30.000Z" }
}
```

`test/fixtures/current-nulls.json`:

```json
{
  "data": {
    "id": 1, "name": "BUENOS AIRES", "province": "CAPITAL FEDERAL",
    "observed_at": "2026-11-02T17:00:00.000Z", "sky": null, "visibility_km": null,
    "temp_c": 19, "feels_like_c": null, "humidity_pct": null, "wind_dir": null, "wind_kmh": 5,
    "wind_variable": true, "pressure_hpa": null, "updated_at": "2026-11-02T17:17:30.000Z"
  },
  "meta": { "source": "SMN", "updated_at": "2026-11-02T17:17:30.000Z" }
}
```

`test/fixtures/forecast.json`:

```json
{
  "data": {
    "steps": [
      { "locality": "BUENOS AIRES", "at": "2026-11-02T18:00:00.000Z", "temp_c": 24, "wind_dir_deg": 90, "wind_kmh": 12, "precip_mm": 0, "updated_at": "2026-11-02T12:00:00.000Z" },
      { "locality": "BUENOS AIRES", "at": "2026-11-02T21:00:00.000Z", "temp_c": 22, "wind_dir_deg": 100, "wind_kmh": 10, "precip_mm": 0, "updated_at": "2026-11-02T12:00:00.000Z" },
      { "locality": "BUENOS AIRES", "at": "2026-11-03T00:00:00.000Z", "temp_c": 18.1, "wind_dir_deg": 120, "wind_kmh": 8, "precip_mm": 0, "updated_at": "2026-11-02T12:00:00.000Z" },
      { "locality": "BUENOS AIRES", "at": "2026-11-03T03:00:00.000Z", "temp_c": 15.2, "wind_dir_deg": 150, "wind_kmh": 6, "precip_mm": 2.5, "updated_at": "2026-11-02T12:00:00.000Z" },
      { "locality": "BUENOS AIRES", "at": "2026-11-03T09:00:00.000Z", "temp_c": 17, "wind_dir_deg": 180, "wind_kmh": 9, "precip_mm": 0, "updated_at": "2026-11-02T12:00:00.000Z" }
    ],
    "days": [
      { "date": "2026-11-02", "temp_min_c": 18.1, "temp_max_c": 24, "precip_mm_total": 0 },
      { "date": "2026-11-03", "temp_min_c": 15.2, "temp_max_c": 17, "precip_mm_total": 2.5 }
    ]
  },
  "meta": {
    "source": "SMN",
    "updated_at": "2026-11-02T12:00:00.000Z",
    "note": "Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN."
  }
}
```

`test/fixtures/forecast-nulls.json`:

```json
{
  "data": {
    "steps": [
      { "locality": "BUENOS AIRES", "at": "2026-11-02T18:00:00.000Z", "temp_c": null, "wind_dir_deg": null, "wind_kmh": null, "precip_mm": null, "updated_at": "2026-11-02T12:00:00.000Z" }
    ],
    "days": [
      { "date": "2026-11-02", "temp_min_c": null, "temp_max_c": null, "precip_mm_total": 0 }
    ]
  },
  "meta": { "source": "SMN", "updated_at": "2026-11-02T12:00:00.000Z", "note": "Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN." }
}
```

- [ ] **Step 2: Escribir el test que falla**

`test/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  currentResponse,
  errorSchema,
  forecastResponse,
  historyResponse,
  nearestStationResponse,
  stationsResponse,
} from '@/lib/schemas'
import current from './fixtures/current.json'
import currentNulls from './fixtures/current-nulls.json'
import forecast from './fixtures/forecast.json'
import forecastNulls from './fixtures/forecast-nulls.json'
import stations from './fixtures/stations.json'

describe('contrato: fixtures válidos', () => {
  it('stations', () => {
    expect(stationsResponse.parse(stations).data.length).toBeGreaterThan(0)
  })
  it('current (con y sin nulos)', () => {
    expect(currentResponse.parse(current).data.id).toBeTypeOf('number')
    expect(currentResponse.parse(currentNulls).data.feels_like_c).toBeNull()
  })
  it('forecast (con y sin nulos)', () => {
    expect(forecastResponse.parse(forecast).data.days.length).toBeGreaterThan(0)
    expect(forecastResponse.parse(forecast).meta.note).toBeTypeOf('string')
    expect(forecastResponse.parse(forecastNulls).data.days[0].temp_min_c).toBeNull()
  })
})

describe('contrato: rechazos', () => {
  it('falta un campo (nullable no acepta undefined)', () => {
    const bad = structuredClone(current) as { data: Record<string, unknown> }
    delete bad.data.temp_c
    expect(currentResponse.safeParse(bad).success).toBe(false)
  })
  it('tipo incorrecto', () => {
    const bad = structuredClone(current) as { data: Record<string, unknown> }
    bad.data.temp_c = '22'
    expect(currentResponse.safeParse(bad).success).toBe(false)
  })
  it('sin meta', () => {
    expect(stationsResponse.safeParse({ data: [] }).success).toBe(false)
  })
  it('ignora campos extra (tolera que la API agregue campos)', () => {
    const extra = structuredClone(stations) as { data: Record<string, unknown>[] }
    extra.data[0].nuevo = 1
    expect(stationsResponse.safeParse(extra).success).toBe(true)
  })
})

describe('contrato: esquemas de funciones futuras', () => {
  const meta = { source: 'SMN', updated_at: null }
  it('nearest', () => {
    const ok = { data: { ...stations.data[0], distance_km: 3.2 }, meta }
    expect(nearestStationResponse.safeParse(ok).success).toBe(true)
  })
  it('history', () => {
    const point = { at: '2026-11-02T10:00:00.000Z', temp_c: 20, humidity_pct: null, pressure_hpa: 1010, wind_dir_deg: null, wind_kmh: 4 }
    expect(historyResponse.safeParse({ data: [point], meta }).success).toBe(true)
  })
  it('error', () => {
    expect(errorSchema.safeParse({ error: { code: 'not_found', message: 'x' } }).success).toBe(true)
  })
})
```

- [ ] **Step 3: Ejecutar y ver que falla**

Run: `npx vitest run test/schemas.test.ts`
Expected: FAIL (no se puede resolver `@/lib/schemas`).

- [ ] **Step 4: Implementar `lib/schemas.ts`**

Las columnas de la API son `DOUBLE PRECISION`/`INTEGER` (llegan como números JSON) y los timestamps como strings ISO.

```ts
import { z } from 'zod'

const meta = z.object({
  source: z.string(),
  updated_at: z.string().nullable(),
  note: z.string().optional(),
})

function envelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta })
}

const nullableNumber = z.number().nullable()

export const stationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  province: z.string(),
  lat: z.number(),
  lon: z.number(),
  altitude_m: nullableNumber,
})

export const currentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  province: z.string(),
  observed_at: z.string(),
  sky: z.string().nullable(),
  visibility_km: nullableNumber,
  temp_c: nullableNumber,
  feels_like_c: nullableNumber,
  humidity_pct: nullableNumber,
  wind_dir: z.string().nullable(),
  wind_kmh: nullableNumber,
  wind_variable: z.boolean(),
  pressure_hpa: nullableNumber,
  updated_at: z.string(),
})

export const forecastStepSchema = z.object({
  locality: z.string(),
  at: z.string(),
  temp_c: nullableNumber,
  wind_dir_deg: nullableNumber,
  wind_kmh: nullableNumber,
  precip_mm: nullableNumber,
  updated_at: z.string(),
})

export const forecastDaySchema = z.object({
  date: z.string(),
  temp_min_c: nullableNumber,
  temp_max_c: nullableNumber,
  precip_mm_total: z.number(),
})

export const historyPointSchema = z.object({
  at: z.string(),
  temp_c: nullableNumber,
  humidity_pct: nullableNumber,
  pressure_hpa: nullableNumber,
  wind_dir_deg: nullableNumber,
  wind_kmh: nullableNumber,
})

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

export const stationsResponse = envelope(z.array(stationSchema))
export const nearestStationResponse = envelope(stationSchema.extend({ distance_km: z.number() }))
export const currentResponse = envelope(currentSchema)
export const forecastResponse = envelope(
  z.object({ steps: z.array(forecastStepSchema), days: z.array(forecastDaySchema) }),
)
export const historyResponse = envelope(z.array(historyPointSchema))

export type Station = z.infer<typeof stationSchema>
export type Current = z.infer<typeof currentSchema>
export type ForecastStep = z.infer<typeof forecastStepSchema>
export type ForecastDay = z.infer<typeof forecastDaySchema>
export type HistoryPoint = z.infer<typeof historyPointSchema>
export type StationsResponse = z.infer<typeof stationsResponse>
export type CurrentResponse = z.infer<typeof currentResponse>
export type ForecastResponse = z.infer<typeof forecastResponse>
```

- [ ] **Step 5: Crear `test/factories.ts`**

```ts
import type { Current, ForecastDay, ForecastStep, Station } from '@/lib/schemas'

export const makeStation = (o: Partial<Station> = {}): Station => ({
  id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL', lat: -34.58, lon: -58.48, altitude_m: 25, ...o,
})

export const makeCurrent = (o: Partial<Current> = {}): Current => ({
  id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL',
  observed_at: '2026-11-02T17:30:00.000Z', sky: 'Despejado', visibility_km: 10,
  temp_c: 22.4, feels_like_c: 27.8, humidity_pct: 58, wind_dir: 'Norte', wind_kmh: 14,
  wind_variable: false, pressure_hpa: 1013.2, updated_at: '2026-11-02T17:35:00.000Z', ...o,
})

export const makeStep = (o: Partial<ForecastStep> = {}): ForecastStep => ({
  locality: 'BUENOS AIRES', at: '2026-11-02T18:00:00.000Z', temp_c: 20, wind_dir_deg: 90,
  wind_kmh: 10, precip_mm: 0, updated_at: '2026-11-02T12:00:00.000Z', ...o,
})

export const makeDay = (o: Partial<ForecastDay> = {}): ForecastDay => ({
  date: '2026-11-02', temp_min_c: 15, temp_max_c: 24, precip_mm_total: 0, ...o,
})
```

- [ ] **Step 6: Ejecutar y ver que pasa**

Run: `npx vitest run test/schemas.test.ts && npm run typecheck`
Expected: todos los tests PASS, typecheck limpio.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add zod contract schemas, fixtures and factories" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Formateo, selección de estación por defecto y script de fixtures

**Files:**
- Create: `lib/format.ts`, `lib/stations.ts`, `scripts/refresh-fixtures.ts`
- Test: `test/format.test.ts`, `test/stations.test.ts`

**Interfaces:**
- Consumes: `Station`, `stationsResponse`, `currentResponse`, `forecastResponse` (Task 2); `makeStation` (Task 2).
- Produces (`lib/format.ts`): `EMPTY = '—'`; `formatValue(v: number | null, unit: string, digits?: number): string`; `formatTemp(v: number | null): string`; `formatTime(iso: string): string` ("HH:MM" ART); `formatDateTime(iso: string): string`; `artDate(iso: string): string` ("YYYY-MM-DD" ART); `todayArt(now: Date): string`; `formatDayLabel(date: string, today: string): string`; `compass(deg: number | null): string | null`; `windText(dir: string | null, kmh: number | null, variable?: boolean): string`; `isStale(updatedAt: string | null, now: Date, hours?: number): boolean`; `titleCase(s: string): string`.
- Produces (`lib/stations.ts`): `pickDefaultStation(stations: Station[]): Station | undefined`.

- [ ] **Step 1: Escribir tests que fallan**

`test/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  EMPTY, artDate, compass, formatDateTime, formatDayLabel, formatTemp, formatTime,
  formatValue, isStale, titleCase, todayArt, windText,
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
    expect(titleCase('TIERRA DEL FUEGO')).toBe('Tierra Del Fuego')
    expect(titleCase('SAN MIGUEL DE TUCUMÁN')).toBe('San Miguel De Tucumán')
  })
})
```

`test/stations.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pickDefaultStation } from '@/lib/stations'
import { makeStation } from './factories'

describe('pickDefaultStation', () => {
  it('prefiere el nombre exacto "BUENOS AIRES"', () => {
    const list = [
      makeStation({ id: 2, name: 'CORDOBA AERO' }),
      makeStation({ id: 3, name: 'BUENOS AIRES AERO' }),
      makeStation({ id: 4, name: 'BUENOS AIRES' }),
    ]
    expect(pickDefaultStation(list)?.id).toBe(4)
  })
  it('si no hay exacta, la primera que empieza con "BUENOS AIRES"', () => {
    const list = [makeStation({ id: 2, name: 'CORDOBA AERO' }), makeStation({ id: 3, name: 'BUENOS AIRES AERO' })]
    expect(pickDefaultStation(list)?.id).toBe(3)
  })
  it('si no hay ninguna, la primera de la lista', () => {
    expect(pickDefaultStation([makeStation({ id: 9, name: 'USHUAIA AERO' })])?.id).toBe(9)
  })
  it('lista vacía → undefined', () => {
    expect(pickDefaultStation([])).toBeUndefined()
  })
})
```

- [ ] **Step 2: Ejecutar y ver que fallan**

Run: `npx vitest run test/format.test.ts test/stations.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `lib/format.ts`**

```ts
const TZ = 'America/Argentina/Buenos_Aires'
const ART_OFFSET_MS = 3 * 3600_000
const DAY_MS = 24 * 3600_000

export const EMPTY = '—'

export function formatValue(v: number | null, unit: string, digits = 0): string {
  return v === null ? EMPTY : `${v.toFixed(digits).replace('.', ',')} ${unit}`
}

export function formatTemp(v: number | null): string {
  return v === null ? EMPTY : `${Math.round(v) + 0}°`
}

const timeFmt = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ,
})
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: TZ })

export const formatTime = (iso: string): string => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))

export function artDate(iso: string): string {
  return new Date(Date.parse(iso) - ART_OFFSET_MS).toISOString().slice(0, 10)
}

export const todayArt = (now: Date): string => artDate(now.toISOString())

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  const tomorrow = artDate(new Date(Date.parse(`${today}T12:00:00-03:00`) + DAY_MS).toISOString())
  if (date === tomorrow) return 'Mañana'
  const name = weekdayFmt.format(new Date(`${date}T12:00:00-03:00`))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export function compass(deg: number | null): string | null {
  if (deg === null) return null
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

export function windText(dir: string | null, kmh: number | null, variable = false): string {
  if (kmh === null) return EMPTY
  const prefix = variable ? 'Variable' : dir
  return [prefix, `${kmh} km/h`].filter(Boolean).join(' ')
}

export function isStale(updatedAt: string | null, now: Date, hours = 6): boolean {
  return updatedAt !== null && now.getTime() - Date.parse(updatedAt) > hours * 3600_000
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
```

- [ ] **Step 4: Implementar `lib/stations.ts`**

```ts
import type { Station } from './schemas'

const DEFAULT_NAME = 'BUENOS AIRES'

export function pickDefaultStation(stations: Station[]): Station | undefined {
  const upper = (s: Station) => s.name.toUpperCase()
  return (
    stations.find((s) => upper(s) === DEFAULT_NAME) ??
    stations.find((s) => upper(s).startsWith(DEFAULT_NAME)) ??
    stations[0]
  )
}
```

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `npx vitest run test/format.test.ts test/stations.test.ts`
Expected: PASS. Si `formatDayLabel('2026-11-04', …)` o `formatTime` fallan por ICU, revisar con `node -e "console.log(new Intl.DateTimeFormat('es-AR',{weekday:'long'}).format(new Date()))"` (Node 22 trae ICU completo).

- [ ] **Step 6: Script de refresco de fixtures**

`scripts/refresh-fixtures.ts` (valida contra los esquemas antes de escribir: sirve como chequeo de contrato en vivo; nunca imprime la clave):

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { currentResponse, forecastResponse, stationsResponse } from '../lib/schemas'
import { pickDefaultStation } from '../lib/stations'

const base = process.env.SMN_API_URL
const apiKey = process.env.SMN_API_KEY
if (!base || !apiKey) {
  console.error('Definí SMN_API_URL y SMN_API_KEY en el entorno de la terminal.')
  process.exit(1)
}

async function get(route: string): Promise<unknown> {
  const res = await fetch(`${base}/v1/${route}`, { headers: { 'X-API-Key': apiKey as string } })
  if (!res.ok) throw new Error(`GET ${route} -> ${res.status}`)
  return res.json()
}

async function main() {
  const stations = stationsResponse.parse(await get('stations'))
  const station = pickDefaultStation(stations.data)
  if (!station) throw new Error('La API no devolvió estaciones')
  const current = currentResponse.parse(await get(`stations/${station.id}/current`))
  const forecast = forecastResponse.parse(await get(`stations/${station.id}/forecast`))

  const subset = [station, ...stations.data.filter((s) => s.id !== station.id)].slice(0, 10)
  const dir = path.join(process.cwd(), 'test', 'fixtures')
  mkdirSync(dir, { recursive: true })
  const write = (file: string, body: unknown) =>
    writeFileSync(path.join(dir, file), `${JSON.stringify(body, null, 2)}\n`)
  write('stations.json', { data: subset, meta: stations.meta })
  write('current.json', current)
  write('forecast.json', forecast)
  console.log(`Fixtures actualizados para "${station.name}" (id ${station.id}): ${subset.length} estaciones, ${forecast.data.steps.length} pasos.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'error desconocido')
  process.exit(1)
})
```

- [ ] **Step 7: Verificar y commit**

Run: `npm run typecheck && npm test`
Expected: todo PASS. El script se ejecuta en la Task 10 (necesita la clave real, que aporta el usuario en su terminal).

```bash
git add -A
git commit -m "feat: add formatting helpers, default station pick and fixtures refresh script" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Proxy server-side con lista blanca

**Files:**
- Create: `lib/proxyAllowlist.ts`, `app/api/smn/[...path]/route.ts`
- Test: `test/proxy.test.ts`

**Interfaces:**
- Produces: `isAllowedPath(path: string): boolean`; `GET(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response>`.
- Comportamiento: ruta no permitida → 404 `{error:{code:'not_found',...}}`; faltan env → 500 genérico; upstream 200 → 200 con el cuerpo y `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`; upstream 404 → 404 con el cuerpo; cualquier otro estado o fallo de red → 502 genérico `upstream_error`.

- [ ] **Step 1: Escribir el test que falla**

`test/proxy.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/smn/[...path]/route'
import { isAllowedPath } from '@/lib/proxyAllowlist'

const call = (path: string[]) =>
  GET(new Request(`http://localhost/api/smn/${path.join('/')}?x=1`), { params: Promise.resolve({ path }) })

beforeEach(() => {
  process.env.SMN_API_URL = 'https://api.test'
  process.env.SMN_API_KEY = 'secret-test-key'
})
afterEach(() => {
  delete process.env.SMN_API_URL
  delete process.env.SMN_API_KEY
})

describe('isAllowedPath', () => {
  it.each(['stations', 'stations/5/current', 'stations/123/forecast'])('permite %s', (p) => {
    expect(isAllowedPath(p)).toBe(true)
  })
  it.each([
    'health', 'internal/ingest', 'stations/abc/current', 'stations/0/current', 'stations/-1/current',
    'stations/1/history', 'stations/nearest', 'stations/1/current/extra', '../stations', '', 'stations/',
  ])('rechaza %s', (p) => {
    expect(isAllowedPath(p)).toBe(false)
  })
})

describe('GET /api/smn/[...path]', () => {
  it('ruta no permitida → 404 sin llamar a la API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await call(['internal', 'ingest'])
    expect(res.status).toBe(404)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reenvía con X-API-Key, sin query string, y no filtra la clave', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await call(['stations', '5', 'current'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/stations/5/current')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-test-key')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('{"data":1}')
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(res.headers.get('cache-control')).toContain('s-maxage=300')
    expect(JSON.stringify([...res.headers])).not.toContain('secret-test-key')
  })

  it('404 upstream se propaga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":"not_found","message":"x"}}', { status: 404 })))
    const res = await call(['stations', '5', 'forecast'])
    expect(res.status).toBe(404)
  })

  it('401/429/5xx upstream → 502 genérico sin detalle', async () => {
    for (const status of [401, 429, 500]) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('detalle-interno secret-test-key', { status })))
      const res = await call(['stations'])
      const text = await res.text()
      expect(res.status).toBe(502)
      expect(text).toContain('upstream_error')
      expect(text).not.toContain('detalle-interno')
      expect(text).not.toContain('secret-test-key')
    }
  })

  it('fallo de red → 502 genérico', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED api.test') }))
    const res = await call(['stations'])
    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain('ECONNREFUSED')
  })

  it('sin variables de entorno → 500 genérico', async () => {
    delete process.env.SMN_API_KEY
    vi.stubGlobal('fetch', vi.fn())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call(['stations'])
    expect(res.status).toBe(500)
    expect(await res.text()).toContain('config_error')
  })
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run test/proxy.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`lib/proxyAllowlist.ts` (una línea por ruta nueva; para `history`/`nearest` se agregarán en sus propias funciones):

```ts
const ID = '[1-9]\\d{0,9}'

export const ALLOWED_ROUTES: readonly RegExp[] = [
  /^stations$/,
  new RegExp(`^stations/${ID}/current$`),
  new RegExp(`^stations/${ID}/forecast$`),
]

export function isAllowedPath(path: string): boolean {
  return ALLOWED_ROUTES.some((route) => route.test(path))
}
```

`app/api/smn/[...path]/route.ts`:

```ts
import { isAllowedPath } from '@/lib/proxyAllowlist'

const UPSTREAM_TIMEOUT_MS = 10_000
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: JSON_HEADERS })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params
  const route = path.join('/')
  if (!isAllowedPath(route)) return errorResponse(404, 'not_found', 'Ruta no encontrada')

  const base = process.env.SMN_API_URL
  const apiKey = process.env.SMN_API_KEY
  if (!base || !apiKey) {
    console.error('proxy: faltan SMN_API_URL o SMN_API_KEY')
    return errorResponse(500, 'config_error', 'Servicio mal configurado')
  }

  try {
    const upstream = await fetch(`${base}/v1/${route}`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (upstream.status === 200) {
      return new Response(await upstream.text(), {
        status: 200,
        headers: { ...JSON_HEADERS, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }
    if (upstream.status === 404) {
      return new Response(await upstream.text(), { status: 404, headers: JSON_HEADERS })
    }
    console.error(`proxy: upstream respondió ${upstream.status} para ${route}`)
  } catch {
    console.error(`proxy: fallo de red para ${route}`)
  }
  return errorResponse(502, 'upstream_error', 'No se pudo obtener datos del servicio')
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run test/proxy.test.ts && npm run typecheck`
Expected: PASS, typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add allowlisted server-side proxy to the SMN API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Cliente de la API, estado de estación y providers

**Files:**
- Create: `lib/api.ts`, `lib/useStation.tsx`, `lib/useOnline.ts`, `features/weather/hooks.ts`, `components/Providers.tsx`, `test/helpers.tsx`
- Test: `test/api.test.ts`, `test/useStation.test.tsx`

**Interfaces:**
- Consumes: esquemas y tipos (Task 2).
- Produces (`lib/api.ts`): `class ApiError extends Error { kind: 'not_found' | 'network' | 'upstream' | 'contract' }`; `getStations(): Promise<StationsResponse>`; `getCurrent(id: number): Promise<CurrentResponse>`; `getForecast(id: number): Promise<ForecastResponse>`; `shouldRetry(count: number, err: unknown): boolean`. Todas llaman a `fetch('/api/smn/<ruta>')` con un único argumento string.
- Produces (`lib/useStation.tsx`): `StationProvider({children})`; `useStation(): { stationId: number | null; setStationId(id: number): void; hydrated: boolean }` (lanza si no hay provider). Clave de storage: `pronostico:stationId`.
- Produces (`lib/useOnline.ts`): `useOnline(): boolean`.
- Produces (`features/weather/hooks.ts`): `useStations()`, `useCurrent(id: number | null)`, `useForecast(id: number | null)` (TanStack `useQuery`).
- Produces (`test/helpers.tsx`): `mockFetch(routes: Record<string, { status?: number; body: unknown }>)` (devuelve el `vi.fn`; la clave es la ruta sin `/api/smn/`), `renderWithProviders(ui)`.

- [ ] **Step 1: Escribir `test/helpers.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { vi } from 'vitest'
import { StationProvider } from '@/lib/useStation'

export function mockFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const route = routes[String(input).replace(/^.*\/api\/smn\//, '')]
    if (!route) return new Response('{}', { status: 404 })
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { 'content-type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export function renderWithProviders(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always' } } })
  return render(
    <QueryClientProvider client={client}>
      <StationProvider>{ui}</StationProvider>
    </QueryClientProvider>,
  )
}
```

- [ ] **Step 2: Escribir tests que fallan**

`test/api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { ApiError, getCurrent, getForecast, getStations, shouldRetry } from '@/lib/api'
import current from './fixtures/current.json'
import forecast from './fixtures/forecast.json'
import stations from './fixtures/stations.json'
import { mockFetch } from './helpers'

describe('cliente de la API', () => {
  it('devuelve datos validados', async () => {
    const fetchMock = mockFetch({
      stations: { body: stations },
      'stations/1/current': { body: current },
      'stations/1/forecast': { body: forecast },
    })
    expect((await getStations()).data.length).toBeGreaterThan(0)
    expect((await getCurrent(1)).data.id).toBe(1)
    expect((await getForecast(1)).data.days.length).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/stations/1/current')
  })

  it('404 → not_found', async () => {
    mockFetch({ 'stations/1/current': { status: 404, body: { error: { code: 'not_found', message: 'x' } } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ name: 'ApiError', kind: 'not_found' })
  })

  it('5xx → upstream', async () => {
    mockFetch({ 'stations/1/current': { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ kind: 'upstream' })
  })

  it('fallo de red → network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')))
    await expect(getStations()).rejects.toMatchObject({ kind: 'network' })
  })

  it('respuesta que no cumple el esquema → contract', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch({ 'stations/1/current': { body: { data: {}, meta: {} } } })
    await expect(getCurrent(1)).rejects.toMatchObject({ kind: 'contract' })
  })

  it('cuerpo no JSON → contract', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))
    await expect(getStations()).rejects.toMatchObject({ kind: 'contract' })
  })
})

describe('shouldRetry', () => {
  it('no reintenta not_found ni contract', () => {
    expect(shouldRetry(0, new ApiError('not_found', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError('contract', 'x'))).toBe(false)
  })
  it('reintenta hasta 2 veces el resto', () => {
    expect(shouldRetry(0, new ApiError('network', 'x'))).toBe(true)
    expect(shouldRetry(1, new Error('x'))).toBe(true)
    expect(shouldRetry(2, new ApiError('upstream', 'x'))).toBe(false)
  })
})
```

`test/useStation.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Ejecutar y ver que fallan**

Run: `npx vitest run test/api.test.ts test/useStation.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar**

`lib/api.ts`:

```ts
import type { ZodType } from 'zod'
import { currentResponse, forecastResponse, stationsResponse } from '@/lib/schemas'

export type ApiErrorKind = 'not_found' | 'network' | 'upstream' | 'contract'

export class ApiError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson<T>(route: string, schema: ZodType<T>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/smn/${route}`)
  } catch {
    throw new ApiError('network', 'Sin conexión')
  }
  if (res.status === 404) throw new ApiError('not_found', 'Sin datos')
  if (!res.ok) throw new ApiError('upstream', 'Servicio no disponible')

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new ApiError('contract', 'Respuesta inesperada de la API')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.error(`contrato: respuesta inválida de ${route}`, parsed.error.issues)
    throw new ApiError('contract', 'Respuesta inesperada de la API')
  }
  return parsed.data
}

export const getStations = () => getJson('stations', stationsResponse)
export const getCurrent = (id: number) => getJson(`stations/${id}/current`, currentResponse)
export const getForecast = (id: number) => getJson(`stations/${id}/forecast`, forecastResponse)

export function shouldRetry(count: number, err: unknown): boolean {
  if (err instanceof ApiError && (err.kind === 'not_found' || err.kind === 'contract')) return false
  return count < 2
}
```

`lib/useStation.tsx`:

```tsx
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
```

`lib/useOnline.ts`:

```ts
'use client'

import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
}
```

`features/weather/hooks.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { getCurrent, getForecast, getStations } from '@/lib/api'

const DAY_MS = 24 * 3600_000

export const useStations = () =>
  useQuery({ queryKey: ['stations'], queryFn: getStations, staleTime: DAY_MS })

export const useCurrent = (id: number | null) =>
  useQuery({ queryKey: ['current', id], queryFn: () => getCurrent(id as number), enabled: id !== null })

export const useForecast = (id: number | null) =>
  useQuery({ queryKey: ['forecast', id], queryFn: () => getForecast(id as number), enabled: id !== null })
```

`components/Providers.tsx` (`networkMode: 'always'` para que offline se intente el `fetch` y el service worker responda desde caché):

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { shouldRetry } from '@/lib/api'
import { StationProvider } from '@/lib/useStation'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: shouldRetry, networkMode: 'always', staleTime: 5 * 60_000 },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <StationProvider>{children}</StationProvider>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Ejecutar y ver que pasan**

Run: `npx vitest run test/api.test.ts test/useStation.test.tsx && npm run typecheck`
Expected: PASS, typecheck limpio.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add validated API client, station state and query providers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Componentes UI compartidos

**Files:**
- Create: `components/ui/{Banner,Skeleton,BottomSheet,BottomNav}.tsx`, `lib/navigation.ts`
- Test: `test/ui.test.tsx`

**Interfaces:**
- Produces: `Banner({ tone: 'warn' | 'error'; children; onRetry? })`; `Skeleton({ height: number })`; `BottomSheet({ open; title; onClose; children })`; `BottomNav({ tabs?: readonly Tab[] })` (no renderiza nada con menos de 2 pestañas); `lib/navigation.ts`: `type Tab = { href: string; label: string }`, `TABS: readonly Tab[]` (v1: solo Clima).

- [ ] **Step 1: Escribir el test que falla**

`test/ui.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from '@/components/ui/Banner'
import { BottomNav } from '@/components/ui/BottomNav'
import { BottomSheet } from '@/components/ui/BottomSheet'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('Banner', () => {
  it('error: role alert y botón Reintentar', async () => {
    const onRetry = vi.fn()
    render(<Banner tone="error" onRetry={onRetry}>Falló</Banner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('warn: role status y sin botón si no hay onRetry', () => {
    render(<Banner tone="warn">Aviso</Banner>)
    expect(screen.getByRole('status')).toHaveTextContent('Aviso')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('BottomSheet', () => {
  it('no renderiza cerrada', () => {
    render(<BottomSheet open={false} title="T" onClose={() => {}}>contenido</BottomSheet>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('abierta muestra el diálogo y cierra con Escape y con el fondo', async () => {
    const onClose = vi.fn()
    render(<BottomSheet open title="Elegir" onClose={onClose}>contenido</BottomSheet>)
    expect(screen.getByRole('dialog', { name: 'Elegir' })).toHaveTextContent('contenido')
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('clic dentro del panel no cierra', async () => {
    const onClose = vi.fn()
    render(<BottomSheet open title="T" onClose={onClose}>contenido</BottomSheet>)
    await userEvent.click(screen.getByText('contenido'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BottomNav', () => {
  it('con una sola pestaña no renderiza nada', () => {
    const { container } = render(<BottomNav tabs={[{ href: '/', label: 'Clima' }]} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('con varias pestañas marca la actual', () => {
    render(<BottomNav tabs={[{ href: '/', label: 'Clima' }, { href: '/history', label: 'Histórico' }]} />)
    expect(screen.getByRole('link', { name: 'Clima' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Histórico' })).not.toHaveAttribute('aria-current')
  })
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run test/ui.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`lib/navigation.ts`:

```ts
export interface Tab {
  href: string
  label: string
}

// Una entrada por pantalla. Con 2 o más, BottomNav aparece solo.
export const TABS: readonly Tab[] = [{ href: '/', label: 'Clima' }]
```

`components/ui/Banner.tsx`:

```tsx
import type { ReactNode } from 'react'

interface Props {
  tone: 'warn' | 'error'
  children: ReactNode
  onRetry?: () => void
}

export function Banner({ tone, children, onRetry }: Props) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`banner banner--${tone}`}>
      <span>{children}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
```

`components/ui/Skeleton.tsx`:

```tsx
export function Skeleton({ height }: { height: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />
}
```

`components/ui/BottomSheet.tsx`:

```tsx
'use client'

import { useEffect, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function BottomSheet({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="sheet-backdrop" data-testid="sheet-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sheet__title">{title}</h2>
        {children}
      </div>
    </div>
  )
}
```

`components/ui/BottomNav.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TABS, type Tab } from '@/lib/navigation'

export function BottomNav({ tabs = TABS }: { tabs?: readonly Tab[] }) {
  const pathname = usePathname()
  if (tabs.length < 2) return null
  return (
    <nav aria-label="Principal" className="bottomnav">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={pathname === t.href ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run test/ui.test.tsx && npm run typecheck`
Expected: PASS. Si `next/link` falla en jsdom sin router, mockearlo en el test con `vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }))`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add shared UI primitives (banner, skeleton, bottom sheet, bottom nav)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Componentes del clima

**Files:**
- Create: `features/weather/{CurrentCard,ForecastDays,StationPicker}.tsx`, `features/weather/errorMessage.ts`
- Test: `test/weather-components.test.tsx`

**Interfaces:**
- Consumes: `Current`, `ForecastDay`, `ForecastStep`, `Station` (Task 2); `format.ts` (Task 3); `BottomSheet` (Task 6); `ApiError` (Task 5); factories (Task 2).
- Produces: `CurrentCard({ current: Current })`; `ForecastDays({ days: ForecastDay[]; steps: ForecastStep[]; today: string })`; `StationPicker({ open; stations: Station[]; selectedId: number | null; onSelect(id: number): void; onClose(): void })`; `errorMessage(err: unknown): string`.

- [ ] **Step 1: Escribir el test que falla**

`test/weather-components.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CurrentCard } from '@/features/weather/CurrentCard'
import { ForecastDays } from '@/features/weather/ForecastDays'
import { StationPicker } from '@/features/weather/StationPicker'
import { errorMessage } from '@/features/weather/errorMessage'
import { ApiError } from '@/lib/api'
import { makeCurrent, makeDay, makeStation, makeStep } from './factories'

describe('CurrentCard', () => {
  it('muestra los valores formateados', () => {
    render(<CurrentCard current={makeCurrent({ temp_c: 22.4, sky: 'Despejado', humidity_pct: 58, observed_at: '2026-11-02T17:30:00.000Z' })} />)
    expect(screen.getByText('22°')).toBeInTheDocument()
    expect(screen.getByText('Despejado')).toBeInTheDocument()
    expect(screen.getByText('58 %')).toBeInTheDocument()
    expect(screen.getByText('Norte 14 km/h')).toBeInTheDocument()
    expect(screen.getByText('1013,2 hPa')).toBeInTheDocument()
    expect(screen.getByText(/Observado a las 14:30/)).toBeInTheDocument()
  })
  it('nulos → "—" sin romper', () => {
    const { container } = render(
      <CurrentCard current={makeCurrent({
        sky: null, visibility_km: null, temp_c: null, feels_like_c: null, humidity_pct: null,
        wind_dir: null, wind_kmh: null, pressure_hpa: null,
      })} />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5)
    expect(container).not.toHaveTextContent(/null|NaN|undefined/)
  })
})

describe('ForecastDays', () => {
  const days = [makeDay({ date: '2026-11-02' }), makeDay({ date: '2026-11-03', precip_mm_total: 2.5 })]
  const steps = [
    makeStep({ at: '2026-11-02T18:00:00.000Z', temp_c: 24 }),
    makeStep({ at: '2026-11-02T21:00:00.000Z' }),
    makeStep({ at: '2026-11-03T03:00:00.000Z', precip_mm: null, temp_c: null, wind_kmh: null }),
  ]
  it('rotula días y resume lluvia', () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    expect(screen.getByRole('button', { name: /Hoy/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mañana/ })).toHaveTextContent('Lluvia prevista 2,5 mm')
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveTextContent('Sin lluvia prevista')
  })
  it('expande y colapsa los pasos de 3 h del día', async () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    expect(screen.queryByText('15:00')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.queryByText('00:00')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.queryByText('15:00')).toBeNull()
  })
  it('pasos con nulos muestran "—"', async () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    await userEvent.click(screen.getByRole('button', { name: /Mañana/ }))
    expect(within(screen.getByRole('list', { name: 'Pasos de 3 horas' })).getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('StationPicker', () => {
  const stations = [
    makeStation({ id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL' }),
    makeStation({ id: 2, name: 'CÓRDOBA AERO', province: 'CORDOBA' }),
    makeStation({ id: 3, name: 'USHUAIA AERO', province: 'TIERRA DEL FUEGO' }),
  ]
  const setup = (over: Partial<Parameters<typeof StationPicker>[0]> = {}) => {
    const props = { open: true, stations, selectedId: 1, onSelect: vi.fn(), onClose: vi.fn(), ...over }
    render(<StationPicker {...props} />)
    return props
  }
  it('lista todas y marca la seleccionada', () => {
    setup()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText('Buenos Aires').closest('button')).toHaveAttribute('aria-current', 'true')
  })
  it('filtra por texto ignorando tildes y mayúsculas', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar estación' }), 'cordoba')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Córdoba Aero')).toBeInTheDocument()
  })
  it('sin resultados', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
  it('seleccionar llama onSelect y onClose', async () => {
    const props = setup()
    await userEvent.click(screen.getByText('Ushuaia Aero'))
    expect(props.onSelect).toHaveBeenCalledWith(3)
    expect(props.onClose).toHaveBeenCalled()
  })
})

describe('errorMessage', () => {
  it('mapea cada tipo de error', () => {
    expect(errorMessage(new ApiError('not_found', 'x'))).toBe('Sin datos para esta estación')
    expect(errorMessage(new ApiError('contract', 'x'))).toBe('Respuesta inesperada de la API')
    expect(errorMessage(new ApiError('network', 'x'))).toBe('Sin conexión')
    expect(errorMessage(new ApiError('upstream', 'x'))).toBe('No se pudieron cargar los datos')
    expect(errorMessage(new Error('x'))).toBe('No se pudieron cargar los datos')
  })
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run test/weather-components.test.tsx`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`features/weather/errorMessage.ts`:

```ts
import { ApiError } from '@/lib/api'

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'not_found') return 'Sin datos para esta estación'
    if (err.kind === 'contract') return 'Respuesta inesperada de la API'
    if (err.kind === 'network') return 'Sin conexión'
  }
  return 'No se pudieron cargar los datos'
}
```

`features/weather/CurrentCard.tsx`:

```tsx
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
        <Stat label="Presión" value={formatValue(current.pressure_hpa, 'hPa')} />
        <Stat label="Visibilidad" value={formatValue(current.visibility_km, 'km', 1)} />
      </dl>
      <p className="muted">Observado a las {formatTime(current.observed_at)}</p>
    </section>
  )
}
```

`features/weather/ForecastDays.tsx`:

```tsx
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
```

`features/weather/StationPicker.tsx`:

```tsx
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
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `npx vitest run test/weather-components.test.tsx && npm run typecheck`
Expected: PASS, typecheck limpio.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add current conditions, forecast days and station picker components" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pantalla principal, layout y estilos

**Files:**
- Create: `features/weather/WeatherScreen.tsx`, `app/globals.css`
- Modify: `app/layout.tsx` (reemplaza el placeholder), `app/page.tsx` (reemplaza el placeholder)
- Test: `test/weather-screen.test.tsx`

**Interfaces:**
- Consumes: hooks (Task 5), componentes (Tasks 6-7), `pickDefaultStation` (Task 3), `useStation`, `useOnline`, `Providers`, `BottomNav`.
- Produces: `WeatherScreen()` (sin props; debe renderizarse dentro de `QueryClientProvider` + `StationProvider`); el layout raíz con `Providers`, `BottomNav` y (Task 9) `ServiceWorkerRegister`.

- [ ] **Step 1: Escribir el test que falla**

`test/weather-screen.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WeatherScreen } from '@/features/weather/WeatherScreen'
import { titleCase } from '@/lib/format'
import { stationsResponse } from '@/lib/schemas'
import { pickDefaultStation } from '@/lib/stations'
import current from './fixtures/current.json'
import forecast from './fixtures/forecast.json'
import stationsJson from './fixtures/stations.json'
import { mockFetch, renderWithProviders } from './helpers'

const list = stationsResponse.parse(stationsJson).data
const defaultStation = pickDefaultStation(list)!
const NOTE = 'Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN.'

type Route = { status?: number; body: unknown }
function routes(over: Record<string, Route> = {}): Record<string, Route> {
  const base: Record<string, Route> = { stations: { body: stationsJson } }
  for (const s of list) {
    base[`stations/${s.id}/current`] = { body: current }
    base[`stations/${s.id}/forecast`] = { body: forecast }
  }
  return { ...base, ...over }
}
const headerName = (name: string) => screen.findByText(titleCase(name), { selector: '.station-btn__name' })

beforeEach(() => localStorage.clear())

describe('WeatherScreen', () => {
  it('muestra la estación por defecto con condiciones, pronóstico y nota', async () => {
    mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    expect(await headerName(defaultStation.name)).toBeInTheDocument()
    expect(await screen.findByText('Ahora')).toBeInTheDocument()
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    expect(screen.getByText(/Fuente: SMN/)).toBeInTheDocument()
  })

  it('usa la estación guardada en el dispositivo', async () => {
    const saved = list.find((s) => s.id !== defaultStation.id)!
    localStorage.setItem('pronostico:stationId', String(saved.id))
    const fetchMock = mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    expect(await headerName(saved.name)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${saved.id}/current`))
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/smn/stations/${defaultStation.id}/current`)
  })

  it('404 en condiciones: mensaje claro y el pronóstico sigue visible', async () => {
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { status: 404, body: { error: { code: 'not_found', message: 'x' } } } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Sin datos para esta estación')).toBeInTheDocument()
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
  })

  it('datos con más de 6 h → aviso de desactualizados', async () => {
    const stale = { ...current, meta: { ...current.meta, updated_at: '2020-01-01T00:00:00.000Z' } }
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { body: stale } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Datos desactualizados')).toBeInTheDocument()
  })

  it('respuesta fuera de contrato → "Respuesta inesperada de la API"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch(routes({ [`stations/${defaultStation.id}/forecast`]: { body: { data: {}, meta: {} } } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Respuesta inesperada de la API')).toBeInTheDocument()
  })

  it('error de servicio: banner con Reintentar', async () => {
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { status: 502, body: {} } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('cambiar de estación pide sus datos y la recuerda', async () => {
    const other = list.find((s) => s.id !== defaultStation.id)!
    const fetchMock = mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    await headerName(defaultStation.name)
    await userEvent.click(document.querySelector('.station-btn') as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    const option = within(dialog)
      .getAllByRole('button')
      .find((b) => b.querySelector('.station__name')?.textContent === titleCase(other.name))!
    await userEvent.click(option)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${other.id}/current`))
    expect(localStorage.getItem('pronostico:stationId')).toBe(String(other.id))
  })
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run test/weather-screen.test.tsx`
Expected: FAIL (`@/features/weather/WeatherScreen` inexistente).

- [ ] **Step 3: Implementar `WeatherScreen`**

`features/weather/WeatherScreen.tsx`:

```tsx
'use client'

import type { UseQueryResult } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Banner } from '@/components/ui/Banner'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api'
import { formatDateTime, isStale, titleCase, todayArt } from '@/lib/format'
import { pickDefaultStation } from '@/lib/stations'
import { useOnline } from '@/lib/useOnline'
import { useStation } from '@/lib/useStation'
import { CurrentCard } from './CurrentCard'
import { ForecastDays } from './ForecastDays'
import { StationPicker } from './StationPicker'
import { errorMessage } from './errorMessage'
import { useCurrent, useForecast, useStations } from './hooks'

function renderQuery<T>(q: UseQueryResult<T, Error>, height: number, render: (data: T) => ReactNode): ReactNode {
  if (q.data !== undefined) {
    return (
      <>
        {q.isError && <Banner tone="warn">{errorMessage(q.error)}. Mostrando los últimos datos guardados.</Banner>}
        {render(q.data)}
      </>
    )
  }
  if (q.isError) {
    const retryable = !(q.error instanceof ApiError && q.error.kind === 'not_found')
    return (
      <Banner tone="error" onRetry={retryable ? () => void q.refetch() : undefined}>
        {errorMessage(q.error)}
      </Banner>
    )
  }
  return <Skeleton height={height} />
}

export function WeatherScreen() {
  const { stationId, setStationId, hydrated } = useStation()
  const online = useOnline()
  const [pickerOpen, setPickerOpen] = useState(false)

  const stationsQ = useStations()
  const stations = stationsQ.data?.data
  const station = stations ? (stations.find((s) => s.id === stationId) ?? pickDefaultStation(stations)) : undefined
  const activeId = hydrated && station ? station.id : null

  const currentQ = useCurrent(activeId)
  const forecastQ = useForecast(activeId)

  const now = new Date()
  const updatedAt = forecastQ.data?.meta.updated_at ?? currentQ.data?.meta.updated_at ?? null

  return (
    <>
      <header className="header">
        <button
          type="button"
          className="station-btn"
          onClick={() => setPickerOpen(true)}
          disabled={!stations}
          aria-haspopup="dialog"
        >
          <span className="station-btn__name">{station ? titleCase(station.name) : 'Cargando…'}</span>
          {station && <span className="muted">{titleCase(station.province)}</span>}
          <span aria-hidden="true">▾</span>
        </button>
      </header>

      {!online && <Banner tone="warn">Sin conexión: se muestran los últimos datos guardados.</Banner>}

      {!stations && stationsQ.isError && (
        <Banner tone="error" onRetry={() => void stationsQ.refetch()}>
          {errorMessage(stationsQ.error)}
        </Banner>
      )}
      {!stations && stationsQ.isPending && <Skeleton height={180} />}

      {station && (
        <>
          {renderQuery(currentQ, 220, (data) => (
            <>
              {isStale(data.meta.updated_at, now) && <Banner tone="warn">Datos desactualizados</Banner>}
              <CurrentCard current={data.data} />
            </>
          ))}
          {renderQuery(forecastQ, 260, (data) => (
            <ForecastDays days={data.data.days} steps={data.data.steps} today={todayArt(now)} />
          ))}
        </>
      )}

      <footer className="footer muted">
        <p>Fuente: SMN{updatedAt ? ` · Actualizado ${formatDateTime(updatedAt)}` : ''}</p>
        {forecastQ.data?.meta.note && <p>{forecastQ.data.meta.note}</p>}
      </footer>

      {stations && (
        <StationPicker
          open={pickerOpen}
          stations={stations}
          selectedId={station?.id ?? null}
          onSelect={setStationId}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Layout, página y estilos**

`app/page.tsx`:

```tsx
import { WeatherScreen } from '@/features/weather/WeatherScreen'

export default function Page() {
  return <WeatherScreen />
}
```

`app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/components/Providers'
import { BottomNav } from '@/components/ui/BottomNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pronóstico SMN',
  description: 'Clima actual y pronóstico a 5 días con datos abiertos del Servicio Meteorológico Nacional.',
  applicationName: 'Pronóstico SMN',
  appleWebApp: { capable: true, title: 'Pronóstico', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b3d91',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        <Providers>
          <main className="app">{children}</main>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
```

`app/globals.css`:

```css
:root {
  --bg: #f5f7fa; --fg: #14213d; --muted: #5b6b82; --card: #fff; --accent: #0b3d91; --border: #e1e6ee;
  --warn: #fff4d6; --warn-fg: #6b4e00; --err: #fde8e8; --err-fg: #8a1c1c;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e1626; --fg: #e8eefc; --muted: #9fb0cc; --card: #16223a; --accent: #6ea8ff; --border: #25324d;
    --warn: #3a2f10; --warn-fg: #ffd98a; --err: #3d1a1a; --err-fg: #ffb4b4;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.4 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
button { font: inherit; color: inherit; }
.app { max-width: 480px; margin: 0 auto; display: grid; gap: 16px;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom)); }
.muted { color: var(--muted); font-size: 0.875rem; }

.header { display: flex; }
.station-btn { display: flex; align-items: baseline; gap: 8px; min-height: 44px; padding: 8px 12px; width: 100%;
  background: var(--card); border: 1px solid var(--border); border-radius: 12px; text-align: left; cursor: pointer; }
.station-btn__name { font-weight: 600; font-size: 1.125rem; }
.station-btn [aria-hidden] { margin-left: auto; }

.card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
.card__title { margin: 0 0 8px; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
.current__temp { margin: 0; font-size: 4rem; font-weight: 300; line-height: 1; }
.current__sky { margin: 4px 0 16px; font-size: 1.125rem; }
.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 0 0 12px; }
.stat dt { color: var(--muted); font-size: 0.8125rem; }
.stat dd { margin: 0; font-weight: 600; }

.days, .steps, .stationlist { list-style: none; margin: 0; padding: 0; }
.day { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; width: 100%; min-height: 44px; padding: 10px 0;
  background: none; border: 0; border-bottom: 1px solid var(--border); text-align: left; cursor: pointer; }
.day__label { font-weight: 600; }
.day__range { grid-row: 1; grid-column: 2; font-variant-numeric: tabular-nums; }
.day__rain { grid-column: 1; color: var(--muted); font-size: 0.875rem; }
.step { display: grid; grid-template-columns: 3.5rem 3rem 1fr auto; gap: 8px; padding: 8px 0; font-size: 0.9375rem;
  font-variant-numeric: tabular-nums; border-bottom: 1px dashed var(--border); }

.banner { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; }
.banner--warn { background: var(--warn); color: var(--warn-fg); }
.banner--error { background: var(--err); color: var(--err-fg); }
.banner button { min-height: 36px; padding: 4px 12px; border-radius: 8px; border: 1px solid currentColor; background: none; cursor: pointer; }
.skeleton { border-radius: 16px; background: linear-gradient(90deg, var(--border), var(--card), var(--border)); background-size: 200% 100%;
  animation: shimmer 1.4s infinite linear; }
@keyframes shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none; } }

.footer p { margin: 2px 0; }

.sheet-backdrop { position: fixed; inset: 0; z-index: 10; display: flex; align-items: flex-end; background: rgb(0 0 0 / 0.45); }
.sheet { width: 100%; max-width: 480px; margin: 0 auto; max-height: 80dvh; overflow-y: auto; background: var(--card);
  border-radius: 16px 16px 0 0; padding: 16px 16px calc(16px + env(safe-area-inset-bottom)); }
.sheet__title { margin: 0 0 12px; font-size: 1.125rem; }
.search { width: 100%; min-height: 44px; padding: 8px 12px; margin-bottom: 8px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--bg); color: var(--fg); font: inherit; }
.stationlist button { display: flex; flex-direction: column; align-items: flex-start; width: 100%; min-height: 48px; padding: 8px 4px;
  background: none; border: 0; border-bottom: 1px solid var(--border); text-align: left; cursor: pointer; }
.stationlist button[aria-current='true'] { color: var(--accent); font-weight: 600; }

.bottomnav { position: sticky; bottom: 0; display: flex; justify-content: space-around; padding: 8px 0 calc(8px + env(safe-area-inset-bottom));
  background: var(--card); border-top: 1px solid var(--border); }
.bottomnav a { padding: 8px 16px; color: var(--muted); text-decoration: none; }
.bottomnav a[aria-current='page'] { color: var(--accent); font-weight: 600; }
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npx vitest run test/weather-screen.test.tsx && npm test && npm run typecheck && npm run build`
Expected: todo PASS y build exitoso. Si el último test falla por el selector del botón de cabecera, usar `document.querySelector('.station-btn')`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add weather screen, layout and mobile-first styles" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: PWA (manifest, íconos, service worker)

**Files:**
- Create: `app/manifest.ts`, `public/sw.js`, `components/ServiceWorkerRegister.tsx`, `public/icons/icon.svg`, `scripts/make-icons.mjs`, `public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png` (generados)
- Modify: `next.config.ts`, `app/layout.tsx`
- Test: `test/manifest.test.ts`

**Interfaces:**
- Produces: `/manifest.webmanifest` (`display: standalone`, íconos 192/512 + maskable); `/sw.js` (shell + datos con network-first y fallback a caché); registro solo en producción.

- [ ] **Step 1: Escribir el test que falla**

`test/manifest.test.ts`:

```ts
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import manifest from '@/app/manifest'

describe('manifest PWA', () => {
  const m = manifest()
  it('es instalable y en español', () => {
    expect(m.display).toBe('standalone')
    expect(m.start_url).toBe('/')
    expect(m.lang).toBe('es-AR')
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
  })
  it('declara íconos 192 y 512, uno maskable, y los archivos existen', () => {
    const icons = m.icons ?? []
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true)
    expect(icons.some((i) => i.sizes === '512x512' && i.purpose !== 'maskable')).toBe(true)
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true)
    for (const icon of icons) {
      expect(existsSync(path.join(process.cwd(), 'public', icon.src))).toBe(true)
    }
  })
  it('hay ícono para iOS', () => {
    expect(existsSync(path.join(process.cwd(), 'public', 'icons', 'apple-touch-icon.png'))).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `npx vitest run test/manifest.test.ts`
Expected: FAIL (`@/app/manifest` inexistente).

- [ ] **Step 3: Ícono y generador**

`public/icons/icon.svg` (fondo a sangre para que sirva como maskable; reemplazable por un diseño propio):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b3d91"/>
  <circle cx="190" cy="190" r="72" fill="#ffc83d"/>
  <g fill="#ffffff">
    <circle cx="200" cy="330" r="58"/>
    <circle cx="275" cy="298" r="78"/>
    <circle cx="352" cy="338" r="52"/>
    <rect x="200" y="330" width="152" height="60"/>
  </g>
</svg>
```

`scripts/make-icons.mjs`:

```js
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const SOURCE = 'public/icons/icon.svg'
const BACKGROUND = '#0b3d91'
mkdirSync('public/icons', { recursive: true })

async function render(file, size, padRatio) {
  const pad = Math.round(size * padRatio)
  const inner = size - pad * 2
  let img = sharp(SOURCE, { density: 300 }).resize(inner, inner)
  if (pad > 0) img = img.extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND })
  await img.png().toFile(`public/icons/${file}`)
}

await render('icon-192.png', 192, 0)
await render('icon-512.png', 512, 0)
await render('apple-touch-icon.png', 180, 0)
await render('icon-maskable-512.png', 512, 0.2) // zona segura para máscaras circulares
console.log('Íconos generados en public/icons')
```

Run: `npm run make-icons`
Expected: "Íconos generados en public/icons" y cuatro PNG nuevos.

- [ ] **Step 4: Manifest, service worker y registro**

`app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pronóstico SMN',
    short_name: 'Pronóstico',
    description: 'Clima actual y pronóstico a 5 días con datos abiertos del SMN.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'es-AR',
    background_color: '#f5f7fa',
    theme_color: '#0b3d91',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

`public/sw.js`:

```js
const SHELL = 'shell-v1'
const DATA = 'data-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const hit = await cache.match(request)
    if (hit) return hit
    throw err
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/smn/')) {
    event.respondWith(networkFirst(request, DATA))
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL))
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request, SHELL))
  }
})
```

`components/ServiceWorkerRegister.tsx`:

```tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // sin service worker la app sigue funcionando online
    })
  }, [])
  return null
}
```

Modificar `app/layout.tsx`: agregar `import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'`, añadir `icons: { apple: '/icons/apple-touch-icon.png' }` dentro de `metadata`, y renderizar `<ServiceWorkerRegister />` dentro de `<body>` después de `</Providers>`.

Modificar `next.config.ts` para que el navegador revalide siempre el service worker:

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]
  },
}

export default config
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `npm test && npm run typecheck && npm run build`
Expected: todo PASS y build exitoso; la salida del build lista la ruta `/manifest.webmanifest`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: make the app an installable PWA with offline cache" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: README, fixtures reales y verificación en móvil

**Files:**
- Create: `README.md`
- Modify: `test/fixtures/{stations,current,forecast}.json` (los reemplaza el script)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: README**

`README.md`:

````markdown
# Pronóstico App

PWA mobile-first que muestra clima actual y pronóstico a 5 días con datos abiertos del SMN (Argentina). Consume la API del repo `pronostico` a través de un proxy server-side, de modo que la `X-API-Key` nunca llega al navegador.

**Datos: Servicio Meteorológico Nacional (SMN), datos abiertos.** El pronóstico proviene de un modelo numérico y puede diferir del oficial del SMN.

## Variables de entorno

| Variable | Contenido |
|---|---|
| `SMN_API_URL` | URL base de la API, sin barra final |
| `SMN_API_KEY` | Clave para `X-API-Key` (solo servidor) |

Para desarrollo local, crear `.env.local` (ignorado por git) con ambas. Nunca versionar ni imprimir la clave. Ver `.env.example`.

## Desarrollo

```bash
npm install
npm run dev         # http://localhost:3000
npm test
npm run typecheck
npm run build && npm start   # el service worker solo se registra en producción
```

## Estructura

- `app/api/smn/[...path]`: proxy con lista blanca (`lib/proxyAllowlist.ts`). Una línea por ruta nueva.
- `lib/schemas.ts`: contrato con la API (zod). Cada respuesta se valida; si no cumple, la UI muestra "Respuesta inesperada de la API".
- `features/weather`: pantalla v1. Funciones futuras (`history`, `geolocation`, `stations-search`) entran como `features/<nombre>` con su ruta y una entrada en `lib/navigation.ts` (con 2 o más pestañas aparece la barra inferior).
- `public/sw.js`: service worker (shell y últimas respuestas, network-first).

## Contrato con la API

La API (`/v1`) es la dueña del contrato; esta app solo consume `/v1`. Para refrescar los fixtures desde la API en vivo (también valida el contrato), en tu terminal:

```bash
SMN_API_URL="<url de la API>" SMN_API_KEY="<tu clave>" npm run refresh-fixtures
```

Revisar el diff de `test/fixtures` antes de commitear. Si un test de contrato falla, la API cambió.

## Despliegue (Vercel)

Crear un proyecto apuntando a este repo y definir `SMN_API_URL` y `SMN_API_KEY` en las variables de entorno del proyecto (solo servidor).

## Limitaciones conocidas

- El proxy es público (sin autenticación de usuario): cualquiera puede consultar las 3 rutas permitidas a través de él. Los datos son públicos (SMN), pero el consumo cuenta contra el rate limit de la API; si hace falta, agregar rate limiting al proxy.
- `feels_like_c` (sensación) y la ventana de `precip_mm` por paso (1 h vs 3 h) no están documentados por el SMN; la UI no promete acumulados exactos.
- Offline: se muestran las últimas respuestas guardadas por el service worker; sin una primera visita online no hay datos.
````

- [ ] **Step 2: Refrescar fixtures reales (lo ejecuta el usuario en su terminal)**

El usuario define `SMN_API_URL` y `SMN_API_KEY` en su terminal (la clave nunca se pega en el chat ni en archivos versionados) y corre:

```bash
npm run refresh-fixtures
```

Expected: "Fixtures actualizados para "…" (id N): 10 estaciones, 40 pasos." Luego `npm test`. Si un test de contrato falla, la API devuelve algo distinto a lo documentado: ajustar `lib/schemas.ts` (por ejemplo un campo nulo no previsto) y volver a correr. Revisar `git diff test/fixtures` (solo datos públicos del SMN) y commitear.

- [ ] **Step 3: Verificación en móvil**

Crear `.env.local` (valores aportados por el usuario) y correr `npm run build && npm start`. Con el preview del navegador en viewport 375×812 comprobar:

- La pantalla carga con la estación por defecto; header, tarjeta "Ahora", "Próximos días" y pie con "Fuente: SMN" y la nota.
- Tocar un día expande sus pasos de 3 h; tocar de nuevo colapsa.
- Tocar el header abre la hoja inferior; filtrar "cor" y elegir otra estación actualiza datos; recargar conserva la elección.
- Sin scroll horizontal; objetivos táctiles ≥ 44 px; tema claro y oscuro legibles.
- Devtools → Application: manifest sin errores, service worker activo; en Network → Offline y recargar sigue mostrando los últimos datos con el aviso "Sin conexión".
- Inspeccionar el bundle y las respuestas de red: la clave no aparece en ningún lado (`/api/smn/*` no devuelve cabeceras de la API key).

- [ ] **Step 4: Verificación final y commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: todo PASS.

```bash
git add -A
git commit -m "docs: add README and refresh fixtures from the live API" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
