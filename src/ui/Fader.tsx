import type { CSSProperties } from 'react'

type FaderProps = {
  min: number
  max: number
  step?: number
  value: number
  reset?: number
  testId?: string
  vertical?: boolean
  onChange: (value: number) => void
}

export function Fader({ min, max, step, value, reset, testId, vertical = false, onChange }: FaderProps) {
  const span = max - min || 1
  const pct = ((value - min) / span) * 100
  const bipolar = min < 0 && max > 0
  return (
    <input
      type="range"
      className={['fader', bipolar ? 'is-bipolar' : '', vertical ? 'is-vertical' : ''].filter(Boolean).join(' ')}
      min={min}
      max={max}
      step={step}
      value={value}
      data-testid={testId}
      title={reset === undefined ? undefined : 'Double-click to reset'}
      style={{ '--pct': `${pct}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
      onDoubleClick={(event) => {
        if (reset === undefined) return
        event.preventDefault()
        onChange(reset)
      }}
    />
  )
}
