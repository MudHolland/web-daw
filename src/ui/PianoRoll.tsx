import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { midiName, scaleTone } from '../model/harmony.ts'
import type { NoteEvent } from '../model/project.ts'

type PianoRollProps = {
  notes: NoteEvent[]
  length: number
  groupSize: number
  songKey: string
  scale: 'major' | 'minor'
  low: number
  high: number
  playhead: number
  column: number
  onColumn: (step: number) => void
  onChange: (notes: NoteEvent[]) => void
  onSpan?: (span: { start: number; duration: number }) => void
  heldSpan?: { start: number; duration: number } | null
}

type Drag =
  | { kind: 'draw'; pitch: number; start: number; duration: number }
  | { kind: 'move'; index: number; pitch: number; start: number; duration: number; originX: number; originY: number; moved: boolean }
  | { kind: 'resize'; index: number; start: number; duration: number; originX: number }

const BLACK = new Set([1, 3, 6, 8, 10])

export function PianoRoll({
  notes,
  length,
  groupSize,
  songKey,
  scale,
  low,
  high,
  playhead,
  column,
  onColumn,
  onChange,
  onSpan,
  heldSpan,
}: PianoRollProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const beatsRef = useRef<HTMLDivElement>(null)
  const spanRef = useRef<{ start: number; duration: number } | null>(null)
  const spanDrag = useRef<number | null>(null)
  const scrolled = useRef(false)
  const dragRef = useRef<Drag | null>(null)
  const draftRef = useRef<NoteEvent[] | null>(null)
  const [draft, setDraft] = useState<NoteEvent[] | null>(null)
  function showDraft(next: NoteEvent[] | null) {
    draftRef.current = next
    setDraft(next)
  }
  const [selected, setSelected] = useState<number | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [span, setSpan] = useState<{ start: number; duration: number } | null>(null)
  const [dragSpan, setDragSpan] = useState<{ start: number; duration: number } | null>(null)
  const highlight = dragSpan ?? (heldSpan !== undefined ? heldSpan : span)
  function showSpan(next: { start: number; duration: number } | null) {
    spanRef.current = next
    if (heldSpan !== undefined) setDragSpan(next)
    else setSpan(next)
  }
  const shown = draft ?? notes
  let pitchLow = low
  let pitchHigh = high
  for (const note of shown) {
    if (note.pitch < pitchLow) pitchLow = note.pitch
    if (note.pitch > pitchHigh) pitchHigh = note.pitch
  }
  const pitches: number[] = []
  for (let pitch = pitchHigh; pitch >= pitchLow; pitch -= 1) pitches.push(pitch)

  useEffect(() => {
    if (selected != null && selected >= notes.length) setSelected(null)
  }, [notes, selected])

  useEffect(() => {
    if (scrolled.current) return
    const grid = gridRef.current
    const scroller = grid?.closest('.roll-scroll')
    const note = grid?.querySelector<HTMLElement>('[data-note]')
    if (!scroller || !note) return
    scrolled.current = true
    const delta = note.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTop += delta - scroller.clientHeight / 2
  }, [shown.length])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selected == null) return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      onChange(notes.filter((_, index) => index !== selected))
      setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notes, onChange, selected])

  function stepFromBeats(event: { clientX: number }) {
    const beats = beatsRef.current
    if (!beats) return 0
    const rect = beats.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const x = Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left))
    return Math.min(length - 1, Math.floor((x / rect.width) * length))
  }

  function onBeatDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!onSpan || event.button !== 0) return
    const step = stepFromBeats(event)
    spanDrag.current = step
    showSpan({ start: step, duration: 1 })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer can already be gone for a synthetic event. */
    }
  }

  function onBeatMove(event: ReactPointerEvent<HTMLDivElement>) {
    const anchor = spanDrag.current
    if (anchor == null) return
    const step = stepFromBeats(event)
    const start = Math.min(anchor, step)
    showSpan({ start, duration: Math.max(anchor, step) - start + 1 })
  }

  function onBeatUp() {
    if (spanDrag.current == null) return
    spanDrag.current = null
    const next = spanRef.current
    if (heldSpan !== undefined) setDragSpan(null)
    if (next) onSpan?.(next)
  }

  function cellAt(event: { clientX: number; clientY: number }) {
    const grid = gridRef.current
    if (!grid) return null
    const rect = grid.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    const x = Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left))
    const y = Math.min(rect.height - 1, Math.max(0, event.clientY - rect.top))
    const step = Math.min(length - 1, Math.floor((x / rect.width) * length))
    const row = Math.min(pitches.length - 1, Math.floor((y / rect.height) * pitches.length))
    return { step, pitch: pitches[row] ?? pitchHigh, rect }
  }

  function applyDrag(drag: Drag, event: { clientX: number; clientY: number }) {
    const grid = gridRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const columnWidth = rect.width / length
    const rowHeight = rect.height / pitches.length
    if (drag.kind === 'draw') {
      const cell = cellAt(event)
      if (!cell) return
      const duration = Math.max(1, Math.min(length - drag.start, cell.step - drag.start + 1))
      drag.duration = duration
      showDraft([...notes, { pitch: drag.pitch, start: drag.start, duration, velocity: 0.9 }])
      return
    }
    if (drag.kind === 'resize') {
      const delta = Math.round((event.clientX - drag.originX) / columnWidth)
      const duration = Math.max(1, Math.min(length - drag.start, drag.duration + delta))
      showDraft(notes.map((note, index) => (index === drag.index ? { ...note, duration } : note)))
      return
    }
    const stepDelta = Math.round((event.clientX - drag.originX) / columnWidth)
    const rowDelta = Math.round((event.clientY - drag.originY) / rowHeight)
    if (Math.abs(event.clientX - drag.originX) > 3 || Math.abs(event.clientY - drag.originY) > 3) drag.moved = true
    if (!drag.moved) return
    const start = Math.max(0, Math.min(length - drag.duration, drag.start + stepDelta))
    const row = Math.max(0, Math.min(pitches.length - 1, pitches.indexOf(drag.pitch) + rowDelta))
    const pitch = pitches[row] ?? drag.pitch
    showDraft(notes.map((note, index) => (index === drag.index ? { ...note, pitch, start } : note)))
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const grid = gridRef.current
    if (!grid) return
    const noteEl = (event.target as HTMLElement).closest('[data-note]')
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer can already be gone for a synthetic event. */
    }
    if (noteEl && grid.contains(noteEl)) {
      const index = Number(noteEl.getAttribute('data-note'))
      const note = notes[index]
      if (!note) return
      onColumn(note.start)
      const rect = noteEl.getBoundingClientRect()
      const edge = event.clientX >= rect.right - 10
      dragRef.current = edge
        ? { kind: 'resize', index, start: note.start, duration: note.duration, originX: event.clientX }
        : {
            kind: 'move',
            index,
            pitch: note.pitch,
            start: note.start,
            duration: note.duration,
            originX: event.clientX,
            originY: event.clientY,
            moved: false,
          }
      return
    }
    const cell = cellAt(event)
    if (!cell) return
    onColumn(cell.step)
    dragRef.current = { kind: 'draw', pitch: cell.pitch, start: cell.step, duration: 1 }
    showDraft([...notes, { pitch: cell.pitch, start: cell.step, duration: 1, velocity: 0.9 }])
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    applyDrag(drag, event)
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.kind === 'move' && !drag.moved) {
      showDraft(null)
      if (selected === drag.index) {
        onChange(notes.filter((_, index) => index !== drag.index))
        setSelected(null)
      } else {
        setSelected(drag.index)
      }
      return
    }
    const next = draftRef.current
    if (next) onChange(next)
    if (drag.kind === 'draw') setSelected(notes.length)
    else setSelected(drag.index)
    showDraft(null)
  }

  const bars = Math.floor(length / groupSize)

  return (
    <div className={['roll', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')} data-testid="piano-roll" style={{ '--steps': length, '--rows': pitches.length } as CSSProperties}>
      <div className="roll-scroll">
        <div className="roll-sheet">
          <div className="roll-corner">
            <button
              type="button"
              className={['roll-fold', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')}
              data-testid="piano-roll-toggle"
              aria-label={collapsed ? 'Show piano roll keys' : 'Collapse piano roll keys'}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((c) => !c)}
            >
              <svg className="chevron-icon" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
          <div
            ref={beatsRef}
            className={onSpan ? 'roll-beats is-chord' : 'roll-beats'}
            data-testid="roll-beats"
            onPointerDown={onBeatDown}
            onPointerMove={onBeatMove}
            onPointerUp={onBeatUp}
            onPointerCancel={onBeatUp}
          >
            {highlight ? (
              <div
                className="roll-beat-span"
                style={{ left: `${(highlight.start * 100) / length}%`, width: `${(highlight.duration * 100) / length}%` }}
              />
            ) : null}
            {Array.from({ length }, (_, index) => {
              const beat = Math.floor(index / groupSize) + 1
              const sub = (index % groupSize) + 1
              return (
                <span key={index} className={sub === 1 ? 'is-downbeat' : ''}>
                  {beat}.{sub}
                </span>
              )
            })}
          </div>
          <div className="roll-pitches">
            {pitches.map((pitch) => {
              const pc = ((pitch % 12) + 12) % 12
              const black = BLACK.has(pc)
              const inKey = scaleTone(songKey, pitch, scale)
              return (
                <div key={pitch} className={['roll-pitch', black ? 'is-black' : '', inKey ? 'is-scale' : ''].filter(Boolean).join(' ')}>
                  {midiName(pitch)}
                </div>
              )
            })}
          </div>
          <div
            ref={gridRef}
            className="roll-grid"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {pitches.map((pitch) => {
              const pc = ((pitch % 12) + 12) % 12
              const black = BLACK.has(pc)
              const inKey = scaleTone(songKey, pitch, scale)
              return <div key={pitch} className={['roll-row', black ? 'is-black' : '', inKey ? 'is-scale' : ''].filter(Boolean).join(' ')} />
            })}
            {Array.from({ length: bars - (length % groupSize === 0 ? 1 : 0) }, (_, index) => (
              <div key={index} className="roll-barline" style={{ left: `${((index + 1) * groupSize * 100) / length}%` }} />
            ))}
            {highlight ? (
              <div className="roll-span" style={{ left: `${(highlight.start * 100) / length}%`, width: `${(highlight.duration * 100) / length}%` }} />
            ) : null}
            {column >= 0 && column < length ? (
              <div className="roll-column" style={{ left: `${(column * 100) / length}%`, width: `${100 / length}%` }} />
            ) : null}
            {playhead >= 0 && playhead < length ? (
              <div className="roll-playhead" style={{ left: `${(playhead * 100) / length}%` }} />
            ) : null}
            {shown.map((note, index) => {
              const row = pitches.indexOf(note.pitch)
              if (row < 0) return null
              return (
                <div
                  key={`${index}-${note.pitch}-${note.start}`}
                  data-note={index}
                  data-testid="roll-note"
                  className={selected === index ? 'roll-note is-selected' : 'roll-note'}
                  title={`${midiName(note.pitch)}, ${note.duration} step${note.duration === 1 ? '' : 's'}`}
                  style={{
                    top: row * 20,
                    left: `${(note.start * 100) / length}%`,
                    width: `${(note.duration * 100) / length}%`,
                  }}
                >
                  <span className="roll-note-name">{midiName(note.pitch)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
