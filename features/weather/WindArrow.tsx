// Flecha con el norte arriba: apunta hacia donde va el viento (sentido opuesto al de origen)
export function WindArrow({ from }: { from: number }) {
  const to = (((from + 180) % 360) + 360) % 360
  return (
    <svg
      className="wind__arrow"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${to}deg)` }}
    >
      <path d="M12 2l6 9h-4.5v11h-3V11H6z" fill="currentColor" />
    </svg>
  )
}
