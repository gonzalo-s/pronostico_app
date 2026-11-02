# Histórico, flecha de viento, íconos de lluvia, altitud y distancia

Tercera iteración (ver `2026-11-02-geolocation-icons-design.md`). Cuatro piezas independientes, implementadas en este orden.

## 1. Flecha del viento (norte arriba)

`WindArrow` (SVG inline, `aria-hidden`) dentro de `Wind`. Apunta hacia **donde va** el viento: gira `(grados + 180) % 360` sobre una flecha que apunta al norte. Hereda el color (`currentColor`), así que con viento SE también es roja.
- Pronóstico: grados de `wind_dir_deg`.
- Estado actual: `wind_dir` es texto de 8 puntos; `windDegrees(dir)` lo convierte (Norte 0, Noreste 45, Este 90, Sudeste 135, Sur 180, Sudoeste 225, Oeste 270, Noroeste 315).
- Viento variable, sin dirección o sin velocidad: sin flecha.
- `Wind` recibe `deg` opcional; si no viene, lo deriva de `dir`.

## 2. Íconos de lluvia por cantidad

`rainLevel(mm, scale)` devuelve `null | 'llovizna' | 'debil' | 'lluvia' | 'fuerte'` y `rainIcon(level)` el ícono (`WiSprinkle`, `WiShowers`, `WiRain`, `WiStormShowers`) con etiqueta accesible ("Llovizna", "Lluvia débil", "Lluvia", "Lluvia fuerte").
- Paso del pronóstico (`scale: 'step'`): 0 → sin ícono; <0,5 llovizna; <2,5 débil; <7,5 lluvia; ≥7,5 fuerte.
- Día (`scale: 'day'`): <1 llovizna; <5 débil; <15 lluvia; ≥15 fuerte.
- Tormenta y tormenta eléctrica solo salen del texto de cielo actual (ya mapeado en `skyIcon`). El pronóstico no trae ese dato y no se inventa.
- Los umbrales son orientativos (la ventana de `precip_mm` por paso es incierta: 1 h o 3 h); se muestran como ícono y etiqueta, no como cantidades exactas nuevas.

## 3. Altitud y distancia

- Altitud: bajo el nombre de la estación en el header, "Provincia · 25 m s. n. m."; se omite si es nula.
- Distancia: `useStation` suma `distanceKm: number | null` en memoria (no persiste). `setStationId(id, distanceKm?)` la fija; elegir una estación a mano la deja en `null`. Se muestra "A 3,2 km de vos" bajo el header. `StationPicker.onSelect` pasa a `(id, distanceKm?)` y el botón de ubicación le pasa `nearest.data.distance_km`.

## 4. Histórico

- **Navegación:** `lib/navigation.ts` suma `{ href: '/history', label: 'Histórico' }`; `BottomNav` aparece solo.
- **Ruta:** `app/history/page.tsx` renderiza `HistoryScreen` en `features/history/`. Usa la estación activa (`useStation`) y el mismo header de estación que Clima; la lista de estaciones y el selector se reutilizan.
- **Controles:** período (24 h, 7 días, 31 días) y métrica (Temperatura °, Humedad %, Presión hPa, Viento km/h), como grupos de botones con `aria-pressed`.
- **Gráfico:** `HistoryChart`, SVG propio sin librería. Escala por mín/máx de la métrica, los valores nulos cortan la línea, eje X con 3 etiquetas de fecha/hora (ART). Debajo: mínimo, máximo y último valor (también sirven como texto accesible, `role="img"` con `aria-label` resumen).
- **Estados:** cargando (skeleton), sin datos del período ("Sin datos históricos para este período"), error con reintento, y datos en caché si hay error o no hay red (mismo patrón que Clima).
- **Datos:** `getHistory(id, range)` → `/api/smn/stations/:id/history?range=24h|7d|31d`, validado con `historyResponse`. `useHistory(id, range)` con react-query.
- **Proxy:** se permite `stations/:id/history` solo con `range` en `{24h, 7d, 31d}` (otro valor o ausente → 400 sin llamar al upstream). El servidor calcula `to` = hora actual redondeada hacia abajo a la hora (`toISOString`), `from` = `to` − 24 h / 7 d / 31 d, y reenvía `from` y `to`; no se aceptan fechas libres. Mismo `cache-control` que el resto.

## Tests

- `windDegrees`, `WindArrow` (rotación y ausencia con variable/null), integración en `Wind`.
- `rainLevel`/`rainIcon` (umbrales de borde en ambas escalas) e integración en `ForecastDays`.
- Altitud en el header, distancia tras ubicación y borrado al elegir a mano, `useStation` con distancia.
- Proxy de history (rango válido/ inválido, `from`/`to` calculados con reloj simulado), `getHistory`, escala y huecos del gráfico, `HistoryScreen` (estados y selección de período/métrica).

## Fuera de alcance

Tormenta en el pronóstico (no hay dato), gráfico de dirección del viento, rango libre de fechas, `/health`.
