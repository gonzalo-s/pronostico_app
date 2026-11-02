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
