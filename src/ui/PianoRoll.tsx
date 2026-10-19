import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { midiName, scaleTone } from '../model/harmony.ts'
import type { NoteEvent } from '../model/project.ts'
import { beginPadHold } from './InstrumentList.tsx'

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
  viewStart?: number
  viewLength?: number
  onColumn: (step: number) => void
  onChange: (notes: NoteEvent[]) => void
  onSpan?: (span: { start: number; duration: number }) => void
  heldSpan?: { start: number; duration: number } | null
  onHear?: (midi: number, down: boolean) => void
}

type Drag =
  | { kind: 'draw'; pitch: number; start: number; duration: number }
  | { kind: 'move'; index: number; indices: number[]; pitch: number; start: number; duration: number; originX: number; originY: number; moved: boolean }
  | { kind: 'resize'; index: number; start: number; duration: number; originX: number }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; moved: boolean }

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
  viewStart = 0,
  viewLength,
  onColumn,
  onChange,
  onSpan,
  heldSpan,
  onHear,
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
  const [selected, setSelected] = useState<number[]>([])
  const selectedRef = useRef<number[]>([])
  selectedRef.current = selected
  function pickNotes(next: number[]) {
    selectedRef.current = next
    setSelected(next)
  }
  const notesRef = useRef(notes)
  notesRef.current = notes
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [span, setSpan] = useState<{ start: number; duration: number } | null>(null)
  const [dragSpan, setDragSpan] = useState<{ start: number; duration: number } | null>(null)
  const highlight = dragSpan ?? (heldSpan !== undefined ? heldSpan : span)
  function showSpan(next: { start: number; duration: number } | null) {
    spanRef.current = next
    if (heldSpan !== undefined) setDragSpan(next)
    else setSpan(next)
  }
  const shown = draft ?? notes
  const origin = Math.max(0, Math.min(viewStart, Math.max(0, length)))
  const spanLength = Math.max(1, viewLength ?? length)
  const limit = Math.min(length, origin + spanLength)
  let pitchLow = low
  let pitchHigh = high
  for (const note of shown) {
    if (note.pitch < pitchLow) pitchLow = note.pitch
    if (note.pitch > pitchHigh) pitchHigh = note.pitch
  }
  const pitches: number[] = []
  for (let pitch = pitchHigh; pitch >= pitchLow; pitch -= 1) pitches.push(pitch)

  useEffect(() => {
    setSelected((current) => {
      const next = current.filter((index) => index < notes.length)
      selectedRef.current = next
      return next
    })
  }, [notes])

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
      const picked = selectedRef.current
      if (picked.length === 0) return
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      event.preventDefault()
      event.stopImmediatePropagation()
      const drop = new Set(picked)
      onChangeRef.current(notesRef.current.filter((_, index) => !drop.has(index)))
      pickNotes([])
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  function stepFromBeats(event: { clientX: number }) {
    const beats = beatsRef.current
    if (!beats) return 0
    const rect = beats.getBoundingClientRect()
    if (rect.width <= 0) return 0
    const x = Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left))
    return Math.min(limit - 1, origin + Math.floor((x / rect.width) * spanLength))
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
    const step = Math.min(limit - 1, origin + Math.floor((x / rect.width) * spanLength))
    const row = Math.min(pitches.length - 1, Math.floor((y / rect.height) * pitches.length))
    return { step, pitch: pitches[row] ?? pitchHigh, rect }
  }

  function applyDrag(drag: Drag, event: { clientX: number; clientY: number }) {
    const grid = gridRef.current
    if (!grid) return
    const rect = grid.getBoundingClientRect()
    const columnWidth = rect.width / spanLength
    const rowHeight = rect.height / pitches.length
    if (drag.kind === 'draw') {
      const cell = cellAt(event)
      if (!cell) return
      const duration = Math.max(1, Math.min(limit - drag.start, cell.step - drag.start + 1))
      drag.duration = duration
      showDraft([...notes, { pitch: drag.pitch, start: drag.start, duration, velocity: 0.9 }])
      return
    }
    if (drag.kind === 'resize') {
      const delta = Math.round((event.clientX - drag.originX) / columnWidth)
      const duration = Math.max(1, Math.min(limit - drag.start, drag.duration + delta))
      showDraft(notes.map((note, index) => (index === drag.index ? { ...note, duration } : note)))
      return
    }
    if (drag.kind !== 'move') return
    let stepDelta = Math.round((event.clientX - drag.originX) / columnWidth)
    let rowDelta = Math.round((event.clientY - drag.originY) / rowHeight)
    if (Math.abs(event.clientX - drag.originX) > 3 || Math.abs(event.clientY - drag.originY) > 3) drag.moved = true
    if (!drag.moved) return
    const moving = drag.indices.length > 0 ? drag.indices : [drag.index]
    for (const index of moving) {
      const note = notes[index]
      if (!note) continue
      stepDelta = Math.max(origin - note.start, Math.min(limit - note.duration - note.start, stepDelta))
      const row = pitches.indexOf(note.pitch)
      if (row < 0) continue
      rowDelta = Math.max(-row, Math.min(pitches.length - 1 - row, rowDelta))
    }
    const group = new Set(moving)
    showDraft(
      notes.map((note, index) => {
        if (!group.has(index)) return note
        const row = pitches.indexOf(note.pitch)
        const pitch = row < 0 ? note.pitch : (pitches[row + rowDelta] ?? note.pitch)
        return { ...note, pitch, start: note.start + stepDelta }
      }),
    )
  }

  function notesTouched(x0: number, y0: number, x1: number, y1: number) {
    const grid = gridRef.current
    if (!grid) return [] as number[]
    const left = Math.min(x0, x1)
    const right = Math.max(x0, x1)
    const top = Math.min(y0, y1)
    const bottom = Math.max(y0, y1)
    const hits: number[] = []
    for (const el of grid.querySelectorAll<HTMLElement>('[data-note]')) {
      const rect = el.getBoundingClientRect()
      if (rect.right >= left && rect.left <= right && rect.bottom >= top && rect.top <= bottom) {
        hits.push(Number(el.dataset.note))
      }
    }
    return hits
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
      const picked = selectedRef.current
      const indices = picked.includes(index) ? [...picked] : [index]
      if (!picked.includes(index)) pickNotes([index])
      dragRef.current = edge
        ? { kind: 'resize', index, start: note.start, duration: note.duration, originX: event.clientX }
        : {
            kind: 'move',
            index,
            indices,
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
    pickNotes([])
    dragRef.current = { kind: 'marquee', x0: event.clientX, y0: event.clientY, x1: event.clientX, y1: event.clientY, moved: false }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'marquee') {
      drag.x1 = event.clientX
      drag.y1 = event.clientY
      if (Math.abs(drag.x1 - drag.x0) > 4 || Math.abs(drag.y1 - drag.y0) > 4) drag.moved = true
      if (!drag.moved) return
      setMarquee({ x0: drag.x0, y0: drag.y0, x1: drag.x1, y1: drag.y1 })
      pickNotes(notesTouched(drag.x0, drag.y0, drag.x1, drag.y1))
      return
    }
    applyDrag(drag, event)
  }

  function onPointerUp() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.kind === 'marquee') {
      setMarquee(null)
      if (drag.moved) return
      const cell = cellAt({ clientX: drag.x0, clientY: drag.y0 })
      if (!cell) return
      onChange([...notes, { pitch: cell.pitch, start: cell.step, duration: 1, velocity: 0.9 }])
      pickNotes([notes.length])
      return
    }
    if (drag.kind === 'move' && !drag.moved) {
      showDraft(null)
      if (selected.length === 1 && selected[0] === drag.index) {
        onChange(notes.filter((_, index) => index !== drag.index))
        pickNotes([])
      } else {
        pickNotes([drag.index])
      }
      return
    }
    const next = draftRef.current
    if (next) onChange(next)
    if (drag.kind === 'draw') pickNotes([notes.length])
    else if (drag.kind === 'move') pickNotes(drag.indices)
    else pickNotes([drag.index])
    showDraft(null)
  }

  const bars = Math.floor(spanLength / groupSize)
  const gridRect = marquee ? gridRef.current?.getBoundingClientRect() : null
  const marqueeBox =
    marquee && gridRect
      ? {
          left: Math.min(marquee.x0, marquee.x1) - gridRect.left,
          top: Math.min(marquee.y0, marquee.y1) - gridRect.top,
          width: Math.abs(marquee.x1 - marquee.x0),
          height: Math.abs(marquee.y1 - marquee.y0),
        }
      : null

  return (
    <div
      className="roll"
      data-testid="piano-roll"
      data-note-selection={selected.length > 0 ? 'on' : 'off'}
      style={{ '--steps': spanLength, '--rows': pitches.length } as CSSProperties}
    >
      <div className="roll-scroll">
        <div className="roll-sheet">
          <div className="roll-corner" />
          <div
            ref={beatsRef}
            className={onSpan ? 'roll-beats is-chord' : 'roll-beats'}
            data-testid="roll-beats"
            onPointerDown={onBeatDown}
            onPointerMove={onBeatMove}
            onPointerUp={onBeatUp}
            onPointerCancel={onBeatUp}
          >
            {highlight && highlight.start < limit && highlight.start + highlight.duration > origin ? (
              <div
                className="roll-beat-span"
                style={{
                  left: `${((Math.max(highlight.start, origin) - origin) * 100) / spanLength}%`,
                  width: `${((Math.min(highlight.start + highlight.duration, limit) - Math.max(highlight.start, origin)) * 100) / spanLength}%`,
                }}
              />
            ) : null}
            {Array.from({ length: spanLength }, (_, index) => {
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
                <button
                  key={pitch}
                  type="button"
                  className={['roll-pitch', black ? 'is-black' : '', inKey ? 'is-scale' : ''].filter(Boolean).join(' ')}
                  onPointerDown={(event) => beginPadHold(onHear ? (down) => onHear(pitch, down) : undefined, event)}
                >
                  {midiName(pitch)}
                </button>
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
            {Array.from({ length: bars - (spanLength % groupSize === 0 ? 1 : 0) }, (_, index) => (
              <div key={index} className="roll-barline" style={{ left: `${((index + 1) * groupSize * 100) / spanLength}%` }} />
            ))}
            {highlight && highlight.start < limit && highlight.start + highlight.duration > origin ? (
              <div
                className="roll-span"
                style={{
                  left: `${((Math.max(highlight.start, origin) - origin) * 100) / spanLength}%`,
                  width: `${((Math.min(highlight.start + highlight.duration, limit) - Math.max(highlight.start, origin)) * 100) / spanLength}%`,
                }}
              />
            ) : null}
            {column >= origin && column < limit ? (
              <div className="roll-column" style={{ left: `${((column - origin) * 100) / spanLength}%`, width: `${100 / spanLength}%` }} />
            ) : null}
            {playhead >= origin && playhead < limit ? (
              <div className="roll-playhead" style={{ left: `${((playhead - origin) * 100) / spanLength}%` }} />
            ) : null}
            {marqueeBox ? (
              <div
                className="roll-marquee"
                data-testid="roll-marquee"
                style={{
                  left: `${marqueeBox.left}px`,
                  top: `${marqueeBox.top}px`,
                  width: `${marqueeBox.width}px`,
                  height: `${marqueeBox.height}px`,
                }}
              />
            ) : null}
            {shown.map((note, index) => {
              const row = pitches.indexOf(note.pitch)
              if (row < 0) return null
              const visStart = Math.max(note.start, origin)
              const visEnd = Math.min(note.start + note.duration, limit)
              if (visEnd <= visStart) return null
              return (
                <div
                  key={`${index}-${note.pitch}-${note.start}`}
                  data-note={index}
                  data-testid="roll-note"
                  className={selected.includes(index) ? 'roll-note is-selected' : 'roll-note'}
                  title={`${midiName(note.pitch)}, ${note.duration} step${note.duration === 1 ? '' : 's'}`}
                  style={{
                    top: `calc(${(row / pitches.length) * 100}% + 2px)`,
                    height: `calc(${100 / pitches.length}% - 4px)`,
                    left: `${((visStart - origin) * 100) / spanLength}%`,
                    width: `${((visEnd - visStart) * 100) / spanLength}%`,
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
