import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { faderToGain, formatGainDb, GAIN_UNITY_POS, gainToFader } from '../model/gain.ts'
import { registerCcTarget, touchCcTarget } from '../midi/ccBus.ts'

type FaderProps = {
  min: number
  max: number
  step?: number
  value: number
  reset?: number
  testId?: string
  vertical?: boolean
  /** Hairline mark as 0–100 of throw from the minimum. */
  detent?: number
  /** Fill from the midpoint (pan / mix) instead of from the minimum. */
  split?: boolean
  onChange: (value: number) => void
}

export function Fader({ min, max, step, value, reset, testId, vertical = false, detent, split = false, onChange }: FaderProps) {
  useEffect(() => {
    if (!testId) return
    return registerCcTarget(testId, { min, max, step, apply: onChange })
  }, [testId, min, max, step, onChange])

  const span = max - min || 1
  const pct = ((value - min) / span) * 100
  const bipolar = min < 0 && max > 0
  const fromMid = bipolar || split
  const mark = detent ?? (fromMid ? 50 : undefined)
  const origin = fromMid ? 50 : 0
  const fillStart = Math.min(origin, pct)
  const fillSize = Math.abs(pct - origin)
  return (
    <span
      className={['fader', fromMid ? 'is-bipolar' : '', vertical ? 'is-vertical' : '', mark !== undefined ? 'has-detent' : '']
        .filter(Boolean)
        .join(' ')}
      style={
        {
          '--pct': `${pct}%`,
          '--detent': mark !== undefined ? `${mark}%` : undefined,
          '--fill-start': `${fillStart}%`,
          '--fill-size': `${fillSize}%`,
        } as CSSProperties
      }
    >
      <span className="fader-face" aria-hidden="true">
        <span className="fader-ticks" />
        <span className="fader-groove">
          <span className="fader-fill" />
          {mark !== undefined ? <span className="fader-detent" /> : null}
          <span className="fader-cap" />
        </span>
      </span>
      <input
        type="range"
        className="fader-native"
        min={min}
        max={max}
        step={step}
        value={value}
        data-testid={testId}
        title={reset === undefined ? undefined : 'Double-click to reset'}
        onPointerDown={() => {
          if (testId) touchCcTarget(testId)
        }}
        onFocus={() => {
          if (testId) touchCcTarget(testId)
        }}
        onChange={(event) => onChange(Number(event.target.value))}
        onDoubleClick={(event) => {
          if (reset === undefined) return
          event.preventDefault()
          onChange(reset)
        }}
      />
    </span>
  )
}

type GainFaderProps = {
  gain: number
  onChange: (gain: number) => void
  testId?: string
  reset?: number
}

export function GainFader({ gain, onChange, testId, reset = 1 }: GainFaderProps) {
  return (
    <Fader
      vertical
      min={0}
      max={1}
      step={0.001}
      value={gainToFader(gain)}
      reset={gainToFader(reset)}
      detent={GAIN_UNITY_POS * 100}
      testId={testId}
      onChange={(throwPos) => onChange(faderToGain(throwPos))}
    />
  )
}

export { formatGainDb }
