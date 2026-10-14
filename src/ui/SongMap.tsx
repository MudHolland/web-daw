import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { KEYS } from '../model/harmony.ts'
import { LOOP_BARS, METERS, songOrder, type LoopBars, type Meter, type Project } from '../model/project.ts'
import type { CueMode } from '../audio/scheduler.ts'
import { Fader } from './Fader.tsx'

type SongMapProps = {
  project: Project
  activeNodeId: string | null
  queuedNodeId: string | null
  cueMode: CueMode | null
  editNodeId: string
  onSelect: (nodeId: string) => void
  onJump: (nodeId: string) => void
  onRename: (sectionId: string, name: string) => void
  onRepeat: (nodeId: string, repeat: number) => void
  onNext: (nodeId: string, nextId: string | null) => void
  onAdd: () => void
  onDelete: (nodeId: string) => void
  onReorder: (nodeId: string, toIndex: number) => void
  onBpm: (sectionId: string, bpm: number) => void
  onKey: (sectionId: string, key: string) => void
  onMeter: (sectionId: string, meter: Meter) => void
  onBars: (sectionId: string, bars: LoopBars) => void
  onAdhere?: (sectionId: string) => void
}

export function SongMap({
  project,
  activeNodeId,
  queuedNodeId,
  cueMode,
  editNodeId,
  onSelect,
  onJump,
  onRename,
  onRepeat,
  onNext,
  onAdd,
  onDelete,
  onReorder,
  onBpm,
  onKey,
  onMeter,
  onBars,
  onAdhere,
}: SongMapProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [drag, setDrag] = useState<PartDrag | null>(null)
  const [expandedTimingNodeId, setExpandedTimingNodeId] = useState<string | null>(null)
  const cancelRename = useRef(false)
  const order = songOrder(project)
  const firstId = order[0]?.id ?? ''

  function nameOf(sectionId: string) {
    return project.sections.find((item) => item.id === sectionId)?.name ?? 'Part'
  }

  const shown = drag ? order.filter((node) => node.id !== drag.nodeId) : order
  const gapIndex = drag ? Math.min(shown.length, Math.max(0, drag.index)) : -1

  function startPartDrag(event: ReactPointerEvent<HTMLElement>, nodeId: string, name: string, meta: string, fromIndex: number) {
    if ((event.target as HTMLElement).closest('.part-settings, button, input, select')) return
    const startX = event.clientX
    const startY = event.clientY
    let dragging = false
    let index = fromIndex
    const move = (pointer: PointerEvent) => {
      if (!dragging) {
        if (Math.hypot(pointer.clientX - startX, pointer.clientY - startY) < 5) return
        dragging = true
      }
      index = partDropIndex(pointer.clientX, pointer.clientY, nodeId, index)
      setDrag({ nodeId, name, meta, x: pointer.clientX, y: pointer.clientY, index })
    }
    const finish = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (!dragging) return
      const drop = partDropIndex(pointer.clientX, pointer.clientY, nodeId, index)
      const removing = document.elementsFromPoint(pointer.clientX, pointer.clientY).some((node) => node instanceof Element && node.closest('[data-delete-part]'))
      setDrag(null)
      if (removing) onDelete(nodeId)
      else onReorder(nodeId, drop)
      const eat = (click: MouseEvent) => {
        click.preventDefault()
        click.stopPropagation()
        window.removeEventListener('click', eat, true)
      }
      window.addEventListener('click', eat, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  return (
    <section className="song-bar" data-testid="arrangement" aria-label="Song">
      <div className="song-parts">
        {shown.map((node, index) => {
          const section = project.sections.find((item) => item.id === node.sectionId)
          const name = nameOf(node.sectionId)
          const meta = `${node.repeat}× · ${loopLabel(section?.bars)}`
          const selected = node.id === editNodeId
          const current = node.id === activeNodeId
          const queued = node.id === queuedNodeId
          const queuedBar = queued && cueMode === 'bar'
          const following = shown[index + 1]
          const continues = Boolean(following && node.nextId === following.id)
          const loops = node.nextId != null && node.nextId === firstId && !continues
          return (
            <div key={node.id} className="song-entry">
              {index === gapIndex ? <div className="part-gap" data-part-gap={gapIndex} /> : null}
              <div className="song-slot" data-part-id={node.id}>
              <div
                className={['song-block', current ? 'is-current' : '', queued ? 'is-queued' : '', queuedBar ? 'is-queued-bar' : '', selected ? 'is-selected' : '']
                  .filter(Boolean)
                  .join(' ')}
                data-testid="song-block"
                onPointerDown={(event) => startPartDrag(event, node.id, name, meta, order.findIndex((item) => item.id === node.id))}
                onClick={() => onSelect(node.id)}
                aria-pressed={selected}
                aria-label={`${name}, ${meta}`}
              >
                <div className="song-block-head">
                  <span className="song-block-name">
                    <button
                      type="button"
                      className={['song-led', current ? 'is-lit' : '', queued ? 'is-queued' : '', queuedBar ? 'is-queued-bar' : ''].filter(Boolean).join(' ')}
                      aria-label={
                        !activeNodeId
                          ? `Play from ${name}`
                          : queuedBar
                            ? `Cancel cue for ${name}`
                            : queued
                              ? `Cue ${name} after this bar`
                              : `Cue ${name} after this repeat`
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        onJump(node.id)
                      }}
                    />
                    {editingId === node.sectionId ? (
                      <input
                        className="song-rename"
                        value={draft}
                        aria-label={`Rename ${name}`}
                        autoFocus
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={(event) => {
                          const cancelled = cancelRename.current
                          cancelRename.current = false
                          const value = event.currentTarget.value
                          setEditingId(null)
                          if (!cancelled) onRename(node.sectionId, value)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur()
                          if (event.key === 'Escape') {
                            cancelRename.current = true
                            setEditingId(null)
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="song-name"
                        onClick={(event) => {
                          event.stopPropagation()
                          onSelect(node.id)
                          setDraft(name)
                          setEditingId(node.sectionId)
                        }}
                      >
                        {name}
                      </button>
                    )}
                  </span>
                  <span className="song-block-meta">
                    <span className="song-timing">{meta}</span>
                    <button
                      type="button"
                      className={['song-part-toggle', expandedTimingNodeId === node.id && selected ? 'is-open' : ''].filter(Boolean).join(' ')}
                      data-testid="part-settings-toggle"
                      aria-expanded={expandedTimingNodeId === node.id && selected}
                      aria-label={expandedTimingNodeId === node.id && selected ? 'Hide part settings' : 'Show part settings'}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!selected) {
                          onSelect(node.id)
                          setExpandedTimingNodeId(node.id)
                        } else {
                          setExpandedTimingNodeId((currentId) => (currentId === node.id ? null : node.id))
                        }
                      }}
                    >
                      <svg className="chevron-icon" viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </button>
                  </span>
                </div>
                {selected && section ? (
                  <div
                    className="part-settings"
                    aria-label={`${name} timing`}
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <label className="transport-select">
                      <span>Bars</span>
                      <select
                        aria-label="Bars"
                        data-testid="bars"
                        value={section.bars}
                        onChange={(event) => onBars(section.id, Number(event.target.value) as LoopBars)}
                      >
                        {LOOP_BARS.map((item) => (
                          <option key={item} value={item}>
                            {item} {item === 1 ? 'bar' : 'bars'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="part-repeat">
                      <span>Repeat</span>
                      <div className="part-repeat-controls">
                        <button
                          type="button"
                          className="song-nudge"
                          aria-label="Fewer repeats"
                          onClick={() => onRepeat(node.id, node.repeat - 1)}
                        >
                          −
                        </button>
                        <b>{node.repeat}×</b>
                        <button
                          type="button"
                          className="song-nudge"
                          aria-label="More repeats"
                          onClick={() => onRepeat(node.id, node.repeat + 1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <label className="transport-select">
                      <span>Next</span>
                      <select
                        aria-label="Next part"
                        value={node.nextId ?? ''}
                        onChange={(event) => onNext(node.id, event.target.value === '' ? null : event.target.value)}
                      >
                        <option value="">Stop</option>
                        {order.map((item) => (
                          <option key={item.id} value={item.id}>
                            {nameOf(item.sectionId)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {expandedTimingNodeId === node.id ? (
                      <div className="part-timing-settings">
                        <label className="part-bpm">
                          <span className="part-bpm-label">
                            BPM
                            {section.customBpm ? <em className="part-custom-tag">custom</em> : null}
                          </span>
                          <div className="part-bpm-controls">
                            <b>{section.bpm}</b>
                            <Fader min={40} max={200} step={1} value={section.bpm} reset={project.bpm} testId="bpm" onChange={(val) => onBpm(section.id, val)} />
                          </div>
                        </label>
                        <label className="transport-select">
                          <span>
                            Key
                            {section.customKey ? <em className="part-custom-tag">custom</em> : null}
                          </span>
                          <select
                            aria-label="Key"
                            data-testid="key"
                            value={KEYS.includes(section.key as (typeof KEYS)[number]) ? section.key : 'C'}
                            onChange={(event) => onKey(section.id, event.target.value)}
                          >
                            {KEYS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="transport-select">
                          <span>
                            Meter
                            {section.customMeter ? <em className="part-custom-tag">custom</em> : null}
                          </span>
                          <select
                            aria-label="Time signature"
                            data-testid="meter"
                            value={section.meter}
                            onChange={(event) => onMeter(section.id, event.target.value as Meter)}
                          >
                            {METERS.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>
                        {section.customBpm || section.customKey || section.customMeter ? (
                          <button
                            type="button"
                            className="part-adhere-btn"
                            data-testid="part-adhere-btn"
                            onClick={() => onAdhere?.(section.id)}
                            title="Reset to song BPM, Key, and Meter"
                          >
                            Adhere to song ({project.bpm} · {project.key} · {project.meter})
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {continues ? (
                <span className="song-arrow" aria-hidden>
                  <svg width="12" height="18" viewBox="0 0 12 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 1 L6 15 M2 11 L6 15 L10 11" />
                  </svg>
                </span>
              ) : null}
              {loops ? (
                <span className="song-arrow is-loop" aria-hidden>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 7 A5 5 0 1 0 11 12" />
                    <path d="M13 3 L13 7 L9 7" />
                  </svg>
                </span>
              ) : null}
              {!continues && following ? <span className="song-gap" /> : null}
              </div>
            </div>
          )
        })}
        {gapIndex === shown.length ? <div className="part-gap" data-part-gap={gapIndex} /> : null}
      </div>
      {drag ? (
        <div className="part-ghost" style={{ left: drag.x, top: drag.y }}>
          <b>{drag.name}</b>
          <span>{drag.meta}</span>
        </div>
      ) : null}
      <div className="song-dock">
        {drag ? (
          <div className="song-delete" data-delete-part>
            Delete
          </div>
        ) : (
          <button type="button" className="song-add" data-testid="add-part" aria-label="Add part" onClick={onAdd}>
            +
          </button>
        )}
      </div>
    </section>
  )
}

type PartDrag = {
  nodeId: string
  name: string
  meta: string
  x: number
  y: number
  index: number
}

function loopLabel(bars: number | undefined): string {
  const count = bars ?? 1
  return `${count} ${count === 1 ? 'bar' : 'bars'}`
}

function partDropIndex(x: number, y: number, draggingId: string, fallback: number): number {
  const stack = document.elementsFromPoint(x, y)
  const gapHit = stack.find((node) => node instanceof Element && node.closest('[data-part-gap]'))
  if (gapHit instanceof Element) {
    const mark = gapHit.closest<HTMLElement>('[data-part-gap]')
    const value = Number(mark?.dataset.partGap)
    if (Number.isInteger(value)) return value
  }
  const slots = [...document.querySelectorAll<HTMLElement>('[data-part-id]')].filter((item) => item.dataset.partId !== draggingId)
  const rowHit = stack.find((node) => node instanceof Element && node.closest('[data-part-id]'))
  const row = rowHit instanceof Element ? rowHit.closest<HTMLElement>('[data-part-id]') : null
  if (row?.dataset.partId && row.dataset.partId !== draggingId) {
    const rect = row.getBoundingClientRect()
    let index = slots.findIndex((item) => item.dataset.partId === row.dataset.partId)
    if (index < 0) return fallback
    if (y >= rect.top + rect.height / 2) index += 1
    return index
  }
  const bar = document.querySelector('.song-parts')
  if (bar) {
    const rect = bar.getBoundingClientRect()
    if (x >= rect.left && x <= rect.right) {
      if (y >= rect.bottom) return slots.length
      if (y <= rect.top) return 0
    }
  }
  return fallback
}
