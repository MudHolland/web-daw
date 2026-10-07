import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  DRUM_KITS,
  catalogEntries,
  familiesForGroup,
  kitLabel,
  slotEnabled,
  type CatalogId,
  type Instrument,
  type InstrumentGroup,
  type Project,
  type SoundFamily,
} from '../model/project.ts'
import { instrumentColor } from './drums.ts'

export type Selection =
  | { kind: 'song' }
  | { kind: 'group'; groupId: string }
  | { kind: 'instrument'; instrumentId: string }

type GroupListProps = {
  project: Project
  selection: Selection
  openGroups: Record<string, boolean>
  sectionId: string
  onToggleGroup: (groupId: string) => void
  onSelectSong: () => void
  onSelectGroup: (groupId: string) => void
  onSelectInstrument: (instrumentId: string) => void
  onPreview: (instrumentId: string) => void
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onAddGroup: (name: string) => void
  onAddTrack: (groupId: string | null, catalog: CatalogId) => void
  onRenameGroup: (groupId: string, name: string) => void
  onRenameInstrument: (instrumentId: string, name: string) => void
  onPlace: (instrumentId: string, groupId: string, index: number) => void
  onDelete: (instrumentId: string) => void
  playing: boolean
  activity: Record<string, number>
}

export function GroupList({
  project,
  selection,
  openGroups,
  sectionId,
  onToggleGroup,
  onSelectSong,
  onSelectGroup,
  onSelectInstrument,
  onPreview,
  onMute,
  onSolo,
  onAddGroup,
  onAddTrack,
  onRenameGroup,
  onRenameInstrument,
  onPlace,
  onDelete,
  playing,
  activity,
}: GroupListProps) {
  const [menu, setMenu] = useState(false)
  const [drag, setDrag] = useState<TrackDrag | null>(null)
  const addingGroup =
    selection.kind === 'group'
      ? project.groups.find((item) => item.id === selection.groupId)
      : selection.kind === 'instrument'
        ? project.groups.find((item) => item.instrumentIds.includes(selection.instrumentId))
        : undefined

  return (
    <div className="track-pane">
      <div className="pane-title">
        <button type="button" className={selection.kind === 'song' ? 'pane-heading is-on' : 'pane-heading'} onClick={onSelectSong}>
          <h2>All Tracks</h2>
        </button>
      </div>
      <div className="group-list">
        {project.groups.map((group) => (
          <GroupBlock
            key={group.id}
            group={group}
            project={project}
            open={openGroups[group.id] !== false}
            selected={selection.kind === 'group' && selection.groupId === group.id}
            selectedInstrumentId={selection.kind === 'instrument' ? selection.instrumentId : null}
            sectionId={sectionId}
            onToggle={() => onToggleGroup(group.id)}
            onSelect={() => onSelectGroup(group.id)}
            onSelectInstrument={onSelectInstrument}
            onPreview={onPreview}
            onMute={onMute}
            onSolo={onSolo}
            onRename={(name) => onRenameGroup(group.id, name)}
            onRenameInstrument={onRenameInstrument}
            dragId={drag?.instrumentId ?? null}
            dropIndex={drag?.over && drag.over !== 'delete' && drag.over.groupId === group.id ? drag.over.index : null}
            playing={playing}
            activity={activity}
            onGrip={(event, instrument) => beginDrag(event, instrument, group.id)}
          />
        ))}
      </div>
      {drag ? (
        <div className="track-ghost" style={{ left: drag.x, top: drag.y, '--voice': drag.color } as CSSProperties}>
          <span />
          <b>{drag.name}</b>
        </div>
      ) : null}
      <div className="pane-add">
        {drag ? (
          <div className="song-delete" data-delete-tracks>
            Delete
          </div>
        ) : (
          <button
            type="button"
            className="song-add"
            data-testid="add-tracks"
            aria-label="Add track or group"
            aria-expanded={menu}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setMenu((current) => !current)}
          >
            +
          </button>
        )}
        {menu ? (
          <AddMenu
            includeGroup={!addingGroup}
            families={addingGroup ? familiesForGroup(addingGroup.name) : undefined}
            onClose={() => setMenu(false)}
            onGroup={() => {
              setMenu(false)
              onAddGroup('Group')
            }}
            onTrack={(catalog) => {
              setMenu(false)
              onAddTrack(addingGroup?.id ?? null, catalog)
            }}
          />
        ) : null}
      </div>
    </div>
  )

  function beginDrag(event: ReactPointerEvent<HTMLElement>, instrument: Instrument, groupId: string) {
    event.preventDefault()
    event.stopPropagation()
    const next: TrackDrag = {
      instrumentId: instrument.id,
      groupId,
      name: instrument.name,
      color: instrumentColor(instrument),
      x: event.clientX,
      y: event.clientY,
      over: { groupId, index: indexInGroup(groupId, instrument.id) },
    }
    setDrag(next)

    const move = (pointer: PointerEvent) => {
      const over = dropTarget(pointer.clientX, pointer.clientY, instrument.id)
      setDrag((current) => (current ? { ...current, x: pointer.clientX, y: pointer.clientY, over } : current))
    }
    const finish = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      const over = dropTarget(pointer.clientX, pointer.clientY, instrument.id)
      setDrag(null)
      if (over === 'delete') onDelete(instrument.id)
      else if (over) onPlace(instrument.id, over.groupId, over.index)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }
}

type TrackDrag = {
  instrumentId: string
  groupId: string
  name: string
  color: string
  x: number
  y: number
  over: { groupId: string; index: number } | 'delete' | null
}

function indexInGroup(groupId: string, instrumentId: string): number {
  const rows = document.querySelectorAll(`[data-group-id="${groupId}"] [data-track-id]`)
  return Math.max(0, [...rows].findIndex((row) => (row as HTMLElement).dataset.trackId === instrumentId))
}

function dropTarget(x: number, y: number, draggingId: string): TrackDrag['over'] {
  const stack = document.elementsFromPoint(x, y)
  if (stack.some((node) => node instanceof Element && node.closest('[data-delete-tracks]'))) return 'delete'
  const hole = stack.find((node) => node instanceof Element && node.closest('[data-drop-index]'))
  if (hole instanceof Element) {
    const mark = hole.closest<HTMLElement>('[data-drop-index]')
    const groupEl = mark?.closest<HTMLElement>('[data-group-id]')
    const index = Number(mark?.dataset.dropIndex)
    if (groupEl?.dataset.groupId && Number.isInteger(index)) return { groupId: groupEl.dataset.groupId, index }
  }
  const row = stack.find((node) => node instanceof Element && node.closest('[data-track-id]'))
  const rowEl = row instanceof Element ? row.closest<HTMLElement>('[data-track-id]') : null
  if (rowEl && rowEl.dataset.trackId !== draggingId) {
    const groupEl = rowEl.closest<HTMLElement>('[data-group-id]')
    if (!groupEl?.dataset.groupId) return null
    const rows = [...groupEl.querySelectorAll<HTMLElement>('[data-track-id]')].filter((item) => item.dataset.trackId !== draggingId)
    const rect = rowEl.getBoundingClientRect()
    let index = rows.findIndex((item) => item.dataset.trackId === rowEl.dataset.trackId)
    if (y >= rect.top + rect.height / 2) index += 1
    return { groupId: groupEl.dataset.groupId, index: Math.max(0, index) }
  }
  const groupHit = stack.find((node) => node instanceof Element && node.closest('[data-group-id]'))
  const groupEl = groupHit instanceof Element ? groupHit.closest<HTMLElement>('[data-group-id]') : null
  if (!groupEl?.dataset.groupId) return null
  const rows = [...groupEl.querySelectorAll<HTMLElement>('[data-track-id]')].filter((item) => item.dataset.trackId !== draggingId)
  return { groupId: groupEl.dataset.groupId, index: rows.length }
}

function AddMenu({
  includeGroup,
  families,
  onClose,
  onGroup,
  onTrack,
}: {
  includeGroup: boolean
  families?: SoundFamily[]
  onClose: () => void
  onGroup?: () => void
  onTrack: (catalog: CatalogId) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [onClose])

  const entries = catalogEntries().filter((item) => !families || families.includes(item.family))
  const sections: { family: SoundFamily; label: string }[] = [
    { family: 'drums', label: 'Drums' },
    { family: 'bass', label: 'Bass' },
    { family: 'melodic', label: 'Melodic' },
  ]
  return (
    <div className="add-menu" role="menu" ref={ref}>
      {includeGroup ? (
        <button type="button" role="menuitem" data-testid="add-group" onClick={onGroup}>
          Group
        </button>
      ) : null}
      {sections.map((section) => {
        const items = entries.filter((item) => item.family === section.family)
        if (items.length === 0) return null
        const kits = section.family === 'drums' ? DRUM_KITS : [undefined]
        return (
          <div key={section.family} className="add-menu-section">
            {families?.length === 1 ? null : <p className="add-menu-label">{section.label}</p>}
            {kits.map((kit) => {
              const kitItems = kit ? items.filter((item) => item.kit === kit) : items
              if (kitItems.length === 0) return null
              return (
                <div key={kit ?? section.family}>
                  {kit ? <p className="add-menu-kit">{kitLabel(kit)}</p> : null}
                  {kitItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      data-testid={`add-${item.id.replace(':', '-')}`}
                      onClick={() => onTrack(item.id)}
                    >
                      {kit ? item.label.replace(new RegExp(`^${kitLabel(kit)} `, 'i'), '') : item.label}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

type GroupBlockProps = {
  group: InstrumentGroup
  project: Project
  open: boolean
  selected: boolean
  selectedInstrumentId: string | null
  sectionId: string
  onToggle: () => void
  onSelect: () => void
  onSelectInstrument: (instrumentId: string) => void
  onPreview: (instrumentId: string) => void
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onRename: (name: string) => void
  onRenameInstrument: (instrumentId: string, name: string) => void
  dragId: string | null
  dropIndex: number | null
  playing: boolean
  activity: Record<string, number>
  onGrip: (event: ReactPointerEvent<HTMLElement>, instrument: Instrument) => void
}

function GroupBlock({
  group,
  project,
  open,
  selected,
  selectedInstrumentId,
  sectionId,
  onToggle,
  onSelect,
  onSelectInstrument,
  onPreview,
  onMute,
  onSolo,
  onRename,
  onRenameInstrument,
  playing,
  activity,
  dragId,
  dropIndex,
  onGrip,
}: GroupBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const instruments = group.instrumentIds
    .map((id) => project.instruments.find((item) => item.id === id))
    .filter((item): item is Instrument => item !== undefined)

  function commit() {
    setEditing(false)
    onRename(draft)
  }

  const resting = instruments.filter((instrument) => instrument.id !== dragId)
  let place = 0

  return (
    <section className={selected ? 'group is-selected' : 'group'} data-group-id={group.id}>
      <div className="group-head">
        <button
          type="button"
          className={open ? 'chevron is-open' : 'chevron'}
          data-testid={`group-toggle-${group.id}`}
          aria-expanded={open}
          aria-label={open ? `Collapse ${group.name}` : `Expand ${group.name}`}
          onClick={onToggle}
        >
          <svg className="chevron-icon" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
        {editing ? (
          <input
            className="rename"
            value={draft}
            aria-label={`Rename ${group.name}`}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') setEditing(false)
            }}
          />
        ) : (
          <button
            type="button"
            className="group-select"
            data-testid={`group-${group.id}`}
            aria-pressed={selected}
            onClick={onSelect}
            onDoubleClick={() => {
              setDraft(group.name)
              setEditing(true)
            }}
          >
            {group.name}
          </button>
        )}
      </div>
      {open ? (
        <ul>
          {instruments.map((instrument) => {
            const slot = place
            if (instrument.id !== dragId) place += 1
            const openGap = dropIndex === slot && instrument.id !== dragId
            return (
              <TrackRow
                key={instrument.id}
                instrument={instrument}
                active={instrument.id === selectedInstrumentId}
                muted={!slotEnabled(project, instrument.id, sectionId)}
                solo={project.sections.find((item) => item.id === sectionId)?.slots[instrument.id]?.solo === true}
                lifted={instrument.id === dragId}
                gap={openGap ? slot : null}
                onSelect={() => onSelectInstrument(instrument.id)}
                onPreview={() => onPreview(instrument.id)}
                onMute={() => onMute(instrument.id)}
                onSolo={() => onSolo(instrument.id)}
                playing={playing}
                level={activity[instrument.id] ?? 0}
                onGrip={(event) => onGrip(event, instrument)}
                onRename={(name) => onRenameInstrument(instrument.id, name)}
              />
            )
          })}
          {dropIndex === resting.length ? <li className="track-gap" data-drop-index={resting.length} /> : null}
        </ul>
      ) : null}
    </section>
  )
}

function TrackRow({
  instrument,
  active,
  muted,
  solo,
  lifted,
  gap,
  onSelect,
  onPreview,
  onMute,
  onSolo,
  playing,
  level,
  onGrip,
  onRename,
}: {
  instrument: Instrument
  active: boolean
  muted: boolean
  solo: boolean
  lifted: boolean
  gap: number | null
  playing: boolean
  level: number
  onSelect: () => void
  onPreview: () => void
  onMute: () => void
  onSolo: () => void
  onGrip: (event: ReactPointerEvent<HTMLElement>) => void
  onRename: (name: string) => void
}) {
  const color = instrumentColor(instrument)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(instrument.name)

  function commit() {
    setEditing(false)
    onRename(draft)
  }

  return (
    <>
    {gap !== null ? <li className="track-gap" data-drop-index={gap} /> : null}
    <li
      data-track-id={instrument.id}
      className={[active ? 'is-selected' : '', muted ? 'is-muted' : '', solo ? 'is-solo' : '', lifted ? 'is-lifted' : '']
        .filter(Boolean)
        .join(' ')}
      style={{ '--voice': color } as CSSProperties}
    >
      <button
        type="button"
        className="track-grip"
        aria-label={`Move ${instrument.name}`}
        style={playing ? { opacity: 0.2 + 0.8 * Math.min(1, level) } : undefined}
        onPointerDown={onGrip}
      />
      {editing ? (
        <input
          className="rename"
          value={draft}
          aria-label={`Rename ${instrument.name}`}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <button
          type="button"
          className="instrument-select"
          data-testid={`instrument-${instrument.id}`}
          aria-pressed={active}
          onClick={onSelect}
          onDoubleClick={() => {
            setDraft(instrument.name)
            setEditing(true)
          }}
        >
          {instrument.name}
        </button>
      )}
      <span className="track-side">
        <span className="track-tools">
          <button type="button" className="pad" data-testid={`pad-${instrument.id}`} style={{ background: color }} aria-label={`Play ${instrument.name}`} onClick={onPreview} />
          <button
            type="button"
            className={solo ? 'solo is-on' : 'solo'}
            data-testid={`solo-${instrument.id}`}
            aria-pressed={solo}
            aria-label={`Solo ${instrument.name}`}
            onClick={onSolo}
          >
            S
          </button>
        </span>
        <button
          type="button"
          className={muted ? 'track-light is-off' : 'track-light'}
          style={muted ? undefined : { background: color }}
          aria-pressed={!muted}
          aria-label={muted ? `Unmute ${instrument.name}` : `Mute ${instrument.name}`}
          onClick={onMute}
        />
      </span>
    </li>
    </>
  )
}
