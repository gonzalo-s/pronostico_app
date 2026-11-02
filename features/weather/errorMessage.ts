import { ApiError } from '@/lib/api'

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.kind === 'not_found') return 'Sin datos para esta estación'
    if (err.kind === 'contract') return 'Respuesta inesperada de la API'
    if (err.kind === 'network') return 'Sin conexión'
  }
  return 'No se pudieron cargar los datos'
}
