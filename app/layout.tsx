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
