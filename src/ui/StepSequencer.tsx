import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { midiName, transposeScale, type ChordQuality } from '../model/harmony.ts'
import type { DrumId, Pattern } from '../model/project.ts'
import { DRUM_COLOR } from './drums.ts'

function dragPitch(origin: number, dy: number, key?: string): number {
  const steps = Math.round(-dy / 8)
  if (key) return transposeScale(key, origin, steps)
  return Math.max(24, Math.min(84, origin + steps))
}

function laneClass(solo: boolean, muted: boolean): string {
  return ['lane', solo ? 'lane-solo' : '', muted ? 'is-muted' : ''].filter(Boolean).join(' ')
}

function groupsOf(length: number, size: number): number[][] {
  const groups: number[][] = []
  for (let index = 0; index < length; index += size) {
    const group: number[] = []
    for (let offset = 0; offset < size && index + offset < length; offset += 1) group.push(index + offset)
    groups.push(group)
  }
  return groups
}

type StepLaneProps = {
  instrumentId: string
  name: string
  drum: DrumId | null
  color?: string
  pattern: Pattern | null
  playhead: number
  groupSize?: number
  viewStart?: number
  viewLength?: number
  solo?: boolean
  muted?: boolean
  face?: (stepIndex: number, on: boolean, degree: number, quality: ChordQuality | null) => string
  chosen?: number
  onChoose?: (stepIndex: number) => void
  onNudge?: (stepIndex: number, delta: number) => void
  onPitch?: (stepIndex: number, pitch: number) => void
  originFor?: (stepIndex: number) => number
  scaleKey?: string
  onPaint: (stepIndex: number, on: boolean) => void
  recording?: boolean
  onRecordHold?: (down: boolean) => void
}

export function StepLane({
  instrumentId,
  name,
  drum,
  color,
  pattern,
  playhead,
  groupSize = 4,
  viewStart = 0,
  viewLength,
  solo = false,
  muted = false,
  face,
  chosen = -1,
  onChoose,
  onNudge,
  onPitch,
  originFor,
  scaleKey,
  onPaint,
  recording = false,
  onRecordHold,
}: StepLaneProps) {
  const paint = useRef<{ on: boolean; last: number } | null>(null)
  const onPaintRef = useRef(onPaint)
  onPaintRef.current = onPaint

  const groups: { stepIndex: number; on: boolean }[][] = []
  if (pattern) {
    const start = Math.max(0, Math.min(viewStart, pattern.steps.length))
    const end = Math.max(start, Math.min(pattern.steps.length, viewLength != null ? start + viewLength : pattern.steps.length))
    for (let index = start; index < end; index += groupSize) {
      groups.push(
        pattern.steps.slice(index, Math.min(index + groupSize, end)).map((step, offset) => ({
          stepIndex: index + offset,
          on: step.on,
        })),
      )
    }
  }

  const style = { '--step-on': color ?? (drum ? DRUM_COLOR[drum] : '#ffb000') } as CSSProperties

  function begin(index: number, currentlyOn: boolean, event: { clientX: number; clientY: number }) {
    if (onPitch) {
      beginPitch(index, currentlyOn, event.clientY, event.clientX)
      return
    }
    const next = !currentlyOn
    paint.current = { on: next, last: index }
    onPaintRef.current(index, next)

    const move = (event: PointerEvent) => {
      const current = paint.current
      if (!current) return
      const node = document.elementFromPoint(event.clientX, event.clientY)
      const stepEl = node?.closest<HTMLElement>(`[data-lane="${instrumentId}"] [data-step]`)
      if (!stepEl?.dataset.step) return
      const step = Number(stepEl.dataset.step)
      if (!Number.isInteger(step) || step === current.last) return
      current.last = step
      onPaintRef.current(step, current.on)
    }
    const end = () => {
      paint.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  function beginPitch(index: number, currentlyOn: boolean, startY: number, startX: number) {
    const origin = pattern?.steps[index]?.pitch ?? originFor?.(index) ?? 40
    let mode: 'wait' | 'pitch' | 'paint' = 'wait'
    const move = (pointer: PointerEvent) => {
      const dx = pointer.clientX - startX
      const dy = pointer.clientY - startY
      if (mode === 'wait') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        if (Math.abs(dy) > Math.abs(dx)) {
          mode = 'pitch'
          onPitch?.(index, dragPitch(origin, dy, scaleKey))
          return
        }
        mode = 'paint'
        paint.current = { on: !currentlyOn, last: index }
        onPaintRef.current(index, !currentlyOn)
      }
      if (mode === 'pitch') {
        onPitch?.(index, dragPitch(origin, pointer.clientY - startY, scaleKey))
        return
      }
      const current = paint.current
      if (!current) return
      const node = document.elementFromPoint(pointer.clientX, pointer.clientY)
      const stepEl = node?.closest<HTMLElement>(`[data-lane="${instrumentId}"] [data-step]`)
      if (!stepEl?.dataset.step) return
      const step = Number(stepEl.dataset.step)
      if (!Number.isInteger(step) || step === current.last) return
      current.last = step
      onPaintRef.current(step, current.on)
    }
    const end = () => {
      if (mode === 'wait') onPaintRef.current(index, !currentlyOn)
      paint.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <div className={laneClass(solo, muted)} style={style} data-lane={instrumentId}>
      {recording && onRecordHold ? (
        <button
          type="button"
          className="lane-name is-record"
          data-testid={`record-pad-${instrumentId}`}
          aria-label={`Record ${name}`}
          onPointerDown={(event) => beginPadHold(onRecordHold, event)}
        >
          {name}
        </button>
      ) : (
        <span className="lane-name">{name}</span>
      )}
      <div className="step-row" style={{ '--groups': groups.length, '--group-size': groupSize } as CSSProperties}>
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="step-group">
            <div className="step-buttons">
              {group.map((step) => {
                const current = step.stepIndex === playhead
                const stored = pattern?.steps[step.stepIndex]
                const local = String(step.stepIndex - viewStart + 1)
                const label = step.on
                  ? face
                    ? face(step.stepIndex, step.on, stored?.degree ?? 0, stored?.quality ?? null)
                    : stored?.pitch != null
                      ? midiName(stored.pitch)
                      : local
                  : local
                const picked = step.stepIndex === chosen
                return (
                  <div key={step.stepIndex} className="step-slot">
                    <button
                      type="button"
                      className={[step.on ? 'step is-on' : 'step', picked ? 'is-chosen' : ''].filter(Boolean).join(' ')}
                      data-testid={`step-${instrumentId}-${step.stepIndex}`}
                      data-step={step.stepIndex}
                      aria-label={`${name} step ${step.stepIndex + 1}${label !== String(step.stepIndex + 1) ? `, ${label.replace('\n', ' ')}` : ''}`}
                      aria-pressed={step.on}
                      aria-current={current ? 'step' : undefined}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        onChoose?.(step.stepIndex)
                        begin(step.stepIndex, step.on, event)
                      }}
                      onClick={(event) => event.preventDefault()}
                    >
                      {label}
                    </button>
                    {onNudge ? (
                      <div className="step-nudge">
                        <button
                          type="button"
                          aria-label={`Lower ${name} step ${step.stepIndex + 1}`}
                          onPointerDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onNudge(step.stepIndex, -1)
                          }}
                        >
                          −
                        </button>
                        <button
                          type="button"
                          aria-label={`Raise ${name} step ${step.stepIndex + 1}`}
                          onPointerDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            onNudge(step.stepIndex, 1)
                          }}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type AccentRowProps = {
  accent: boolean[]
  playhead: number
  groupSize?: number
  viewStart?: number
  viewLength?: number
  onAccent: (stepIndex: number, on: boolean) => void
}

export function AccentRow({ accent, playhead, groupSize = 4, viewStart = 0, viewLength, onAccent }: AccentRowProps) {
  const paint = useRef<{ on: boolean; last: number } | null>(null)
  const onAccentRef = useRef(onAccent)
  onAccentRef.current = onAccent
  const start = Math.max(0, Math.min(viewStart, accent.length))
  const end = Math.max(start, Math.min(accent.length, viewLength != null ? start + viewLength : accent.length))
  const groups = groupsOf(end - start, groupSize).map((group) => group.map((offset) => start + offset))

  function begin(index: number, currentlyOn: boolean) {
    const next = !currentlyOn
    paint.current = { on: next, last: index }
    onAccentRef.current(index, next)

    const move = (event: PointerEvent) => {
      const current = paint.current
      if (!current) return
      const node = document.elementFromPoint(event.clientX, event.clientY)
      const stepEl = node?.closest<HTMLElement>('[data-lane="accent"] [data-accent]')
      if (!stepEl?.dataset.accent) return
      const step = Number(stepEl.dataset.accent)
      if (!Number.isInteger(step) || step === current.last) return
      current.last = step
      onAccentRef.current(step, current.on)
    }
    const end = () => {
      paint.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <div className="lane lane-accent" data-lane="accent">
      <span className="lane-name">Accent</span>
      <div className="step-row" style={{ '--groups': groups.length, '--group-size': groupSize } as CSSProperties}>
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="step-group">
            <div className="step-buttons">
              {group.map((stepIndex) => {
                const on = accent[stepIndex] === true
                return (
                  <button
                    key={stepIndex}
                    type="button"
                    className={on ? 'accent-step is-on' : 'accent-step'}
                    data-testid={`accent-${stepIndex}`}
                    data-accent={stepIndex}
                    aria-label={`Accent step ${stepIndex + 1}`}
                    aria-pressed={on}
                    aria-current={stepIndex === playhead ? 'step' : undefined}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      begin(stepIndex, on)
                    }}
                    onClick={(event) => event.preventDefault()}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function beginPadHold(hold: ((down: boolean) => void) | undefined, event: { button: number; preventDefault(): void }) {
  if (!hold || event.button !== 0) return
  event.preventDefault()
  hold(true)
  const up = () => {
    hold(false)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
