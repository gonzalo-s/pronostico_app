# Geolocalización, íconos del clima y viento SE resaltado

Segunda iteración sobre la v1 (ver `2026-11-02-pronostico-app-design.md`). Tres cambios independientes que se implementan en este orden: íconos, viento SE, geolocalización.

## 1. Geolocalización con `/stations/nearest`

**Flujo.** La hoja de estaciones (`StationPicker`) suma un botón "Usar mi ubicación". El permiso del navegador se pide solo al tocarlo (nunca al abrir la app). Con la posición se llama a `/stations/nearest`, la estación devuelta se guarda con `setStationId` (misma persistencia en `localStorage` que cualquier elección) y la hoja se cierra. Abrir la app después no consulta la ubicación. Para actualizar, se vuelve a tocar el botón.

**Estados del botón.** Reposo, "Buscando…" (deshabilitado) y error inline debajo del botón. Ante cualquier error la estación activa no cambia:

| Causa | Mensaje |
|---|---|
| Permiso denegado | "No pudimos acceder a tu ubicación. Elegí una estación de la lista." |
| Posición no disponible o timeout (10 s) | "No se pudo obtener tu ubicación. Probá de nuevo." |
| Navegador sin geolocalización | El botón no se muestra. |
| API caída o respuesta inválida | El mensaje de error existente de `errorMessage.ts`. |

**Proxy y privacidad.**
- `lib/proxyAllowlist.ts` suma `^stations/nearest$`.
- El proxy hoy ignora el query string. Para esta ruta reenvía **solo** `lat` y `lon`, validados con el mismo criterio estricto que la API (número decimal, `lat` en [-90, 90], `lon` en [-180, 180]). Cualquier otro parámetro se descarta; valores inválidos devuelven 400 sin llamar al upstream.
- El cliente redondea las coordenadas a 2 decimales (~1 km) antes de enviarlas. Las estaciones distan decenas de km, así que no se pierde precisión útil y no viaja la posición exacta.
- La respuesta cacheable usa el mismo `cache-control` que el resto; al ir redondeadas, las URLs se comparten entre usuarios cercanos.

**Código.**
- `lib/api.ts`: `getNearestStation(lat, lon)` validado con el esquema existente `nearestStationResponse`.
- `lib/geolocation.ts`: `getPosition()` envuelve `navigator.geolocation` en una promesa con error tipado (`denied` | `unavailable` | `timeout`) y `roundCoord`.
- `features/weather/StationPicker.tsx`: botón y estados.

## 2. Íconos del clima

**Librería.** `react-icons/wi` (mismo set Weather Icons que `weather-icons-react`, pero mantenido, tipado y con tree-shaking). `weather-icons-react` se descartó: última publicación en 2022, sin tipos y con sintaxis ESM sin declararla en un `.js`.

**Mapeo de `sky`.** `sky` es texto libre del SMN. Valores observados en las 118 estaciones: "Algo nublado", "Parcialmente nublado", "Nublado", "Despejado", "Cubierto", "Cubierto con neblina", "Cubierto con niebla", "Cubierto con llovizna", "Cubierto con tormenta", "Nublado con tormenta", "Nublado con tormenta sin precipitación", "Nublado con nevada en la hora anterior", "Despejado con lluvia en la hora anterior". `lib/skyIcon.ts` exporta `skyIcon(sky, isDay)` que busca palabras clave sin distinguir mayúsculas ni tildes, en este orden de prioridad:

1. Si el texto contiene "en la hora anterior", el fenómeno ya pasó: se ignora esa parte y se mapea solo el cielo base.
2. tormenta → tormenta
3. nieve / nevada → nieve
4. lluvia / llovizna / chaparr → lluvia
5. neblina / niebla / bruma → niebla
6. cubierto → nublado total
7. nublado → nublado (si empieza con "algo" o "parcialmente", nube con sol o luna)
8. despejado → sol o luna
9. Cualquier otro texto → ícono neutro (`WiNa`). Nunca se rompe la UI por un valor nuevo.

**Día o noche.** `isDay` se calcula con la hora de `observed_at` en `America/Argentina/Buenos_Aires` (UTC-3): día entre las 7 y las 19 h. Es una aproximación deliberada (sin cálculo astronómico). Solo cambia el ícono (sol o luna).

**Dónde.** `CurrentCard` muestra el ícono grande junto a la temperatura, decorativo (`aria-hidden`), porque el texto de `sky` ya se muestra al lado. El pronóstico no trae campo de cielo, así que **no se inventa sol ni nubes**: cada día muestra un ícono de gota con los mm solo cuando `precip_mm_total > 0`, y nada si es 0.

## 3. Viento del sudeste en rojo

**Regla.** Cuando el viento viene del sudeste, el número (km/h) y la dirección se muestran en rojo. El texto sigue presente ("Sudeste" / "SE"), por lo que el color refuerza pero no es la única señal.

**Detección.** `lib/format.ts` suma `isSoutheast(dir)`: verdadero si `dir`, normalizado, es `sudeste` o `se`.
- Estado actual: `wind_dir` es texto de 8 puntos ("Sur", "Sudeste", "Sudoeste", "Oeste", "Este", "Noreste", "Norte", "Noroeste", o `null`), verificado sobre las 118 estaciones. Se muestra "Sudeste 14 km/h" con ambas partes en rojo.
- Pronóstico: `compass(wind_dir_deg)` ya devuelve "SE" para 112,5°–157,5°. Se muestra "SE 14 km/h" en rojo.
- Viento variable o sin dirección: nunca rojo.

**Código.** `windText` (string) se mantiene para no romper usos y tests. Se agrega el componente `features/weather/Wind.tsx` que recibe `dir`, `kmh` y `variable`, y renderiza un único `<span class="wind">` con el mismo texto que `windText` y le suma la clase `wind--se` cuando `isSoutheast(dir)`. La clase usa un rojo con contraste AA sobre el fondo en claro y en oscuro (se define como variable CSS en `globals.css`, igual que el resto de la paleta). `CurrentCard` y `ForecastDays` usan `Wind`.

## Tests

- `skyIcon`: los 13 valores reales (día y noche), "en la hora anterior", prioridad tormenta sobre nublado, valor desconocido → ícono neutro.
- `isSoutheast` y `Wind`: "Sudeste", "SE", "Sudoeste", `null`, variable, y presencia de la clase.
- Proxy: reenvía solo `lat`/`lon` válidos, descarta otros parámetros, 400 ante inválidos.
- `roundCoord` y `getPosition` (con `navigator.geolocation` simulado: éxito, denegado, timeout).
- `StationPicker`: botón en reposo, buscando, éxito (cambia estación y cierra), cada error (la estación no cambia), botón oculto sin geolocalización.
- Fixture nuevo `nearest.json` con respuesta real; `scripts/refresh-fixtures.ts` lo refresca.

## Fuera de alcance

Seguir la ubicación en cada apertura, histórico, búsqueda/favoritas, íconos de cielo por paso del pronóstico.
