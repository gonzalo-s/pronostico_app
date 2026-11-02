export interface Tab {
  href: string
  label: string
}

// Una entrada por pantalla. Con 2 o más, BottomNav aparece solo.
export const TABS: readonly Tab[] = [
  { href: '/', label: 'Clima' },
  { href: '/history', label: 'Histórico' },
]
