interface Props<K extends string> {
  label: string
  options: readonly { key: K; label: string }[]
  value: K
  onChange: (key: K) => void
}

export function Segmented<K extends string>({ label, options, value, onChange }: Props<K>) {
  return (
    <div role="group" aria-label={label} className="segmented">
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
