import { ApiError } from '@/lib/api'
import { GeoError } from '@/lib/geolocation'

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'not_found') return 'Sin datos para esta estación'
    if (err.kind === 'contract') return 'Respuesta inesperada de la API'
    if (err.kind === 'network') return 'Sin conexión'
  }
  return 'No se pudieron cargar los datos'
}

export function geoErrorMessage(err: unknown): string {
  if (err instanceof GeoError) {
    return err.kind === 'denied'
      ? 'No pudimos acceder a tu ubicación. Elegí una estación de la lista.'
      : 'No se pudo obtener tu ubicación. Probá de nuevo.'
  }
  return errorMessage(err)
}
