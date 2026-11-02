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
