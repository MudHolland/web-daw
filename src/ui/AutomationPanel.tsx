import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  formatAutomation,
  lerpAutomation,
  sliderOf,
  storeOf,
  type AutomationTarget,
} from '../model/automation.ts'

type AutomationPanelProps = {
  targets: AutomationTarget[]
  stepsOf: (id: string) => (number | null)[]
  baseOf: (id: string) => number
  onWrite: (id: string, index: number, stored: number | null) => void
  length: number
  playhead: number
  groupSize: number
  viewStart: number
  viewLength: number
  barLength: number
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

function snapSlider(target: AutomationTarget, value: number): number {
  const clamped = Math.min(target.max, Math.max(target.min, value))
  if (!target.ticks || target.ticks < 2) return clamped
  const last = target.ticks - 1
  const t = (clamped - target.min) / (target.max - target.min || 1)
  const index = Math.max(0, Math.min(last, Math.round(t * last)))
  return target.min + (index / last) * (target.max - target.min)
}

export function AutomationPanel({
  targets,
  stepsOf,
  baseOf,
  onWrite,
  length,
  playhead,
  groupSize,
  viewStart,
  viewLength,
  barLength,
}: AutomationPanelProps) {
  const [open, setOpen] = useState(true)
  const [selected, setSelected] = useState(targets[0]?.id ?? '')
  const target = targets.find((item) => item.id === selected) ?? targets[0]
  const selectedId = target?.id ?? ''
  const ids = targets.map((item) => item.id).join('|')
  const onWriteRef = useRef(onWrite)
  onWriteRef.current = onWrite

  useEffect(() => {
    if (targets.some((item) => item.id === selected)) return
    setSelected(targets[0]?.id ?? '')
  }, [ids, selected, targets])

  const start = Math.max(0, Math.min(viewStart, length))
  const end = Math.max(start, Math.min(length, start + viewLength))
  const groups = groupsOf(end - start, groupSize).map((group) => group.map((offset) => start + offset))
  const steps = selectedId ? stepsOf(selectedId) : []
  const baseStored = selectedId ? baseOf(selectedId) : 0
  const baseSlider = target ? sliderOf(selectedId, baseStored) : 0

  function write(index: number, slider: number | null) {
    if (!target || !selectedId) return
    const stored = slider == null ? null : storeOf(selectedId, snapSlider(target, slider))
    onWriteRef.current(selectedId, index, stored)
  }

  function begin(event: { clientX: number; clientY: number }, stepIndex: number, locked: boolean, origin: number) {
    if (!target) return
    const throwPx = 110
    const span = target.max - target.min || 1
    let mode: 'wait' | 'drag' = 'wait'
    let last = stepIndex
    const move = (pointer: PointerEvent) => {
      const dy = pointer.clientY - event.clientY
      const dx = pointer.clientX - event.clientX
      if (mode === 'wait') {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        mode = 'drag'
      }
      const slider = snapSlider(target, origin - (dy / throwPx) * span)
      const node = document.elementFromPoint(pointer.clientX, pointer.clientY)
      const stepEl = node?.closest<HTMLElement>('[data-lane="automation"] [data-auto-step]')
      const step = stepEl?.dataset.autoStep != null ? Number(stepEl.dataset.autoStep) : last
      if (Number.isInteger(step)) last = step
      write(last, slider)
    }
    const endDrag = () => {
      if (mode === 'wait') write(stepIndex, locked ? null : origin)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }

  return (
    <article className={open ? 'automation-panel' : 'automation-panel is-collapsed'}>
      <button
        type="button"
        className="strip-fold"
        aria-expanded={open}
        aria-label={open ? 'Minimize automation' : 'Show automation'}
        data-testid="automation-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Automation</span>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {open && target ? (
        <div className="lane" data-lane="automation">
          <label className="lane-name automation-pick">
            <select
              aria-label="Automation property"
              data-testid="automation-param"
              value={selectedId}
              onChange={(event) => setSelected(event.target.value)}
            >
              {targets.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div
            className="step-row"
            style={
              {
                '--groups': groups.length,
                '--group-size': groupSize,
                '--bar-groups': Math.max(1, Math.round(barLength / groupSize)),
                '--auto-count': Math.max(1, Math.min(barLength, end - start)),
              } as CSSProperties
            }
          >
            {groups.map((group, groupIndex) => (
              <div key={groupIndex} className="step-group">
                <div className="step-buttons">
                  {group.map((stepIndex) => {
                    const stored = steps[stepIndex]
                    const locked = stored != null
                    const heard = lerpAutomation(steps, stepIndex, baseStored, selectedId)
                    const slider = sliderOf(selectedId, locked ? stored : heard)
                    const fill = ((slider - target.min) / (target.max - target.min || 1)) * 100
                    const ramped = !locked && steps.some((value) => value != null)
                    return (
                      <button
                        key={stepIndex}
                        type="button"
                        className={['step', 'auto-step', locked ? 'is-on' : '', ramped ? 'is-ramp' : '']
                          .filter(Boolean)
                          .join(' ')}
                        data-testid={`auto-${stepIndex}`}
                        data-auto-step={stepIndex}
                        aria-label={`${target.label} step ${stepIndex + 1}${locked ? `, ${formatAutomation(selectedId, stored)}` : ''}`}
                        aria-pressed={locked}
                        aria-current={stepIndex === playhead ? 'step' : undefined}
                        style={{ '--auto-fill': `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          begin(event, stepIndex, locked, locked ? sliderOf(selectedId, stored) : baseSlider)
                        }}
                        onClick={(event) => event.preventDefault()}
                      >
                        {locked ? formatAutomation(selectedId, stored) : String(stepIndex - viewStart + 1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}
