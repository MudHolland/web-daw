import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import {
  DRUM_KITS,
  catalogEntries,
  familiesForGroup,
  groupSlot,
  kitLabel,
  slotEnabled,
  type CatalogEntry,
  type CatalogId,
  type Instrument,
  type InstrumentGroup,
  type Project,
  type SoundFamily,
} from '../model/project.ts'
import { catalogColor, groupColor, instrumentColor, TRACK_COLORS } from './drums.ts'

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
  onRecordHold?: (instrumentId: string, down: boolean) => void
  recording?: boolean
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onMuteGroup: (groupId: string) => void
  onSoloGroup: (groupId: string) => void
  onAddGroup: (name: string) => void
  onAddTrack: (groupId: string | null, catalog: CatalogId) => void
  onPreviewCatalog: (catalog: CatalogId) => void
  onRenameGroup: (groupId: string, name: string) => void
  onRenameInstrument: (instrumentId: string, name: string) => void
  onPlace: (instrumentId: string, groupId: string, index: number) => void
  onPlaceGroup: (groupId: string, index: number) => void
  onDelete: (instrumentId: string) => void
  onDeleteGroup: (groupId: string) => void
  onColor: (instrumentId: string, color: string | null) => void
  onGroupColor: (groupId: string, color: string | null) => void
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
  onRecordHold,
  recording = false,
  onMute,
  onSolo,
  onMuteGroup,
  onSoloGroup,
  onAddGroup,
  onAddTrack,
  onPreviewCatalog,
  onRenameGroup,
  onRenameInstrument,
  onPlace,
  onPlaceGroup,
  onDelete,
  onDeleteGroup,
  onColor,
  onGroupColor,
  playing,
  activity,
}: GroupListProps) {
  const [menu, setMenu] = useState(false)
  const [colorPick, setColorPick] = useState<{ kind: 'track' | 'group'; id: string } | null>(null)
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
        {project.groups.map((group) => {
          const slot = groupSlot(project.sections.find((item) => item.id === sectionId), group.id)
          const remaining = project.groups.filter((item) => item.id !== (drag?.kind === 'group' ? drag.groupId : ''))
          const restIndex = remaining.findIndex((item) => item.id === group.id)
          const groupDrop = drag?.kind === 'group' && drag.over !== 'delete' ? drag.over : null
          const showGap = groupDrop != null && restIndex === groupDrop && group.id !== drag?.groupId
          return (
            <div key={group.id}>
              {showGap ? <div className="group-gap" data-group-drop={restIndex} /> : null}
              <GroupBlock
                group={group}
                project={project}
                open={openGroups[group.id] !== false}
                selected={selection.kind === 'group' && selection.groupId === group.id}
                selectedInstrumentId={selection.kind === 'instrument' ? selection.instrumentId : null}
                sectionId={sectionId}
                muted={!slot.enabled}
                solo={slot.solo}
                lifted={drag?.kind === 'group' && drag.groupId === group.id}
                onToggle={() => onToggleGroup(group.id)}
                onSelect={() => onSelectGroup(group.id)}
                onSelectInstrument={onSelectInstrument}
                onPreview={onPreview}
                recording={recording}
                onRecordHold={onRecordHold}
                onMute={onMute}
                onSolo={onSolo}
                onMuteGroup={() => onMuteGroup(group.id)}
                onSoloGroup={() => onSoloGroup(group.id)}
                onRename={(name) => onRenameGroup(group.id, name)}
                onRenameInstrument={onRenameInstrument}
                dragId={drag?.kind === 'track' ? drag.instrumentId : null}
                dropIndex={drag?.kind === 'track' && drag.over && drag.over !== 'delete' && drag.over.groupId === group.id ? drag.over.index : null}
                playing={playing}
                activity={activity}
                colorPick={colorPick}
                onGrip={(event, instrument) => beginDrag(event, instrument, group.id)}
                onGroupGrip={(event) => beginGroupDrag(event, group)}
                onColor={(instrumentId, color) => {
                  setColorPick(null)
                  onColor(instrumentId, color)
                }}
                onGroupColor={(color) => {
                  setColorPick(null)
                  onGroupColor(group.id, color)
                }}
                onClosePicker={() => setColorPick(null)}
              />
            </div>
          )
        })}
        {drag?.kind === 'group' && drag.over !== 'delete' && drag.over === project.groups.filter((item) => item.id !== drag.groupId).length ? (
          <div className="group-gap" data-group-drop={drag.over} />
        ) : null}
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
            onPreview={onPreviewCatalog}
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
    const originX = event.clientX
    const originY = event.clientY
    let lifted = false

    const lift = (pointer: PointerEvent) => {
      lifted = true
      setColorPick(null)
      setDrag({
        kind: 'track',
        instrumentId: instrument.id,
        groupId,
        name: instrument.name,
        color: instrumentColor(instrument),
        x: pointer.clientX,
        y: pointer.clientY,
        over: { groupId, index: indexInGroup(groupId, instrument.id) },
      })
    }

    const move = (pointer: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(pointer.clientX - originX, pointer.clientY - originY) < 8) return
        lift(pointer)
      }
      const over = dropTarget(pointer.clientX, pointer.clientY, instrument.id)
      setDrag((current) => (current && current.kind === 'track' ? { ...current, x: pointer.clientX, y: pointer.clientY, over } : current))
    }
    const finish = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (!lifted) {
        setColorPick((current) => (current?.kind === 'track' && current.id === instrument.id ? null : { kind: 'track', id: instrument.id }))
        return
      }
      const over = dropTarget(pointer.clientX, pointer.clientY, instrument.id)
      setDrag(null)
      if (over === 'delete') onDelete(instrument.id)
      else if (over) onPlace(instrument.id, over.groupId, over.index)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  function beginGroupDrag(event: ReactPointerEvent<HTMLElement>, group: InstrumentGroup) {
    event.preventDefault()
    event.stopPropagation()
    const originX = event.clientX
    const originY = event.clientY
    let lifted = false
    const voice = groupColor(group, project.instruments)

    const lift = (pointer: PointerEvent) => {
      lifted = true
      setColorPick(null)
      setDrag({
        kind: 'group',
        groupId: group.id,
        name: group.name,
        color: voice,
        x: pointer.clientX,
        y: pointer.clientY,
        over: project.groups.findIndex((item) => item.id === group.id),
      })
    }

    const move = (pointer: PointerEvent) => {
      if (!lifted) {
        if (Math.hypot(pointer.clientX - originX, pointer.clientY - originY) < 8) return
        lift(pointer)
      }
      const over = groupDropTarget(pointer.clientX, pointer.clientY, group.id)
      setDrag((current) => (current && current.kind === 'group' ? { ...current, x: pointer.clientX, y: pointer.clientY, over } : current))
    }
    const finish = (pointer: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      if (!lifted) {
        setColorPick((current) => (current?.kind === 'group' && current.id === group.id ? null : { kind: 'group', id: group.id }))
        return
      }
      const over = groupDropTarget(pointer.clientX, pointer.clientY, group.id)
      setDrag(null)
      if (over === 'delete') onDeleteGroup(group.id)
      else if (over != null) onPlaceGroup(group.id, over)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }
}

type TrackDrag =
  | {
      kind: 'track'
      instrumentId: string
      groupId: string
      name: string
      color: string
      x: number
      y: number
      over: { groupId: string; index: number } | 'delete' | null
    }
  | {
      kind: 'group'
      groupId: string
      name: string
      color: string
      x: number
      y: number
      over: number | 'delete' | null
    }

function indexInGroup(groupId: string, instrumentId: string): number {
  const rows = document.querySelectorAll(`[data-group-id="${groupId}"] [data-track-id]`)
  return Math.max(0, [...rows].findIndex((row) => (row as HTMLElement).dataset.trackId === instrumentId))
}

function dropTarget(x: number, y: number, draggingId: string): Extract<TrackDrag, { kind: 'track' }>['over'] {
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

function groupDropTarget(x: number, y: number, draggingId: string): number | 'delete' | null {
  const stack = document.elementsFromPoint(x, y)
  if (stack.some((node) => node instanceof Element && node.closest('[data-delete-tracks]'))) return 'delete'
  const blocks = [...document.querySelectorAll<HTMLElement>('.group-list [data-group-id]')].filter(
    (item) => item.dataset.groupId !== draggingId,
  )
  for (let i = 0; i < blocks.length; i++) {
    const rect = blocks[i]!.getBoundingClientRect()
    if (y < rect.top + rect.height / 2) return i
  }
  return blocks.length
}

export function AddMenu({
  includeGroup,
  families,
  entries,
  currentId,
  onClose,
  onGroup,
  onPreview,
  onTrack,
}: {
  includeGroup: boolean
  families?: SoundFamily[]
  entries?: CatalogEntry[]
  currentId?: CatalogId | null
  onClose: () => void
  onGroup?: () => void
  onPreview: (catalog: CatalogId) => void
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

  const source = (entries ?? catalogEntries()).filter((item) => !families || families.includes(item.family))
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
        const items = source.filter((item) => item.family === section.family)
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
                  {kitItems.map((item) => {
                    const label = kit ? item.label.replace(new RegExp(`^${kitLabel(kit)} `, 'i'), '') : item.label
                    const color = catalogColor(item.id)
                    const current = item.id === currentId
                    return (
                      <div
                        key={item.id}
                        className={current ? 'add-menu-item is-on' : 'add-menu-item'}
                        style={{ '--voice': color } as CSSProperties}
                      >
                        <button
                          type="button"
                          className="add-menu-listen"
                          data-testid={`preview-${item.id.replace(':', '-')}`}
                          aria-label={`Preview ${item.label}`}
                          style={{ background: color }}
                          onClick={(event) => {
                            event.stopPropagation()
                            onPreview(item.id)
                          }}
                        />
                        <button
                          type="button"
                          className="add-menu-pick"
                          role="menuitem"
                          data-testid={`add-${item.id.replace(':', '-')}`}
                          aria-current={current ? 'true' : undefined}
                          onClick={() => onTrack(item.id)}
                        >
                          {label}
                        </button>
                      </div>
                    )
                  })}
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
  muted: boolean
  solo: boolean
  lifted: boolean
  onToggle: () => void
  onSelect: () => void
  onSelectInstrument: (instrumentId: string) => void
  onPreview: (instrumentId: string) => void
  recording: boolean
  onRecordHold?: (instrumentId: string, down: boolean) => void
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onMuteGroup: () => void
  onSoloGroup: () => void
  onRename: (name: string) => void
  onRenameInstrument: (instrumentId: string, name: string) => void
  dragId: string | null
  dropIndex: number | null
  playing: boolean
  activity: Record<string, number>
  colorPick: { kind: 'track' | 'group'; id: string } | null
  onGrip: (event: ReactPointerEvent<HTMLElement>, instrument: Instrument) => void
  onGroupGrip: (event: ReactPointerEvent<HTMLElement>) => void
  onColor: (instrumentId: string, color: string | null) => void
  onGroupColor: (color: string | null) => void
  onClosePicker: () => void
}

function GroupBlock({
  group,
  project,
  open,
  selected,
  selectedInstrumentId,
  sectionId,
  muted,
  solo,
  lifted,
  onToggle,
  onSelect,
  onSelectInstrument,
  onPreview,
  recording,
  onRecordHold,
  onMute,
  onSolo,
  onMuteGroup,
  onSoloGroup,
  onRename,
  onRenameInstrument,
  playing,
  activity,
  dragId,
  dropIndex,
  colorPick,
  onGrip,
  onGroupGrip,
  onColor,
  onGroupColor,
  onClosePicker,
}: GroupBlockProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group.name)
  const headRef = useRef<HTMLDivElement>(null)
  const instruments = group.instrumentIds
    .map((id) => project.instruments.find((item) => item.id === id))
    .filter((item): item is Instrument => item !== undefined)
  const color = groupColor(group, project.instruments)
  const picking = colorPick?.kind === 'group' && colorPick.id === group.id

  useEffect(() => {
    if (!picking) return
    const close = (event: PointerEvent) => {
      if (!headRef.current?.contains(event.target as Node)) onClosePicker()
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [picking, onClosePicker])

  function commit() {
    setEditing(false)
    onRename(draft)
  }

  const resting = instruments.filter((instrument) => instrument.id !== dragId)
  let place = 0

  return (
    <section
      className={[selected ? 'group is-selected' : 'group', muted ? 'is-muted' : '', solo ? 'is-solo' : '', lifted ? 'is-lifted' : '']
        .filter(Boolean)
        .join(' ')}
      data-group-id={group.id}
    >
      <div ref={headRef} className="group-head" style={{ '--voice': color } as CSSProperties}>
        <button
          type="button"
          className="group-grip"
          aria-label={`Move or recolor ${group.name}`}
          aria-haspopup="dialog"
          aria-expanded={picking}
          style={activityStyle(playing, activity[group.id] ?? instruments.reduce((peak, item) => Math.max(peak, activity[item.id] ?? 0), 0))}
          onPointerDown={onGroupGrip}
        />
        {picking ? (
          <div className="color-picker" role="dialog" aria-label={`Color for ${group.name}`}>
            {TRACK_COLORS.map((swatch) => {
              const current = swatch === color
              return (
                <button
                  key={swatch}
                  type="button"
                  className={current ? 'color-swatch is-on' : 'color-swatch'}
                  style={{ background: swatch }}
                  aria-label={swatch}
                  aria-pressed={current}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onGroupColor(group.color === swatch ? null : swatch)}
                />
              )
            })}
          </div>
        ) : null}
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
        <span className={['group-tools', muted || solo ? 'is-on' : ''].filter(Boolean).join(' ')}>
          <button
            type="button"
            className={muted ? 'mute is-on' : 'mute'}
            data-testid={`group-mute-${group.id}`}
            aria-pressed={muted}
            aria-label={muted ? `Unmute ${group.name}` : `Mute ${group.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onMuteGroup()
            }}
          >
            M
          </button>
          <button
            type="button"
            className={solo ? 'solo is-on' : 'solo'}
            data-testid={`group-solo-${group.id}`}
            aria-pressed={solo}
            aria-label={`Solo ${group.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onSoloGroup()
            }}
          >
            S
          </button>
        </span>
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
                recording={recording}
                onRecordHold={(down) => onRecordHold?.(instrument.id, down)}
                onMute={() => onMute(instrument.id)}
                onSolo={() => onSolo(instrument.id)}
                playing={playing}
                level={activity[instrument.id] ?? 0}
                picking={colorPick?.kind === 'track' && colorPick.id === instrument.id}
                onGrip={(event) => onGrip(event, instrument)}
                onRename={(name) => onRenameInstrument(instrument.id, name)}
                onColor={(color) => onColor(instrument.id, color)}
                onClosePicker={onClosePicker}
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
  recording,
  onRecordHold,
  onMute,
  onSolo,
  playing,
  level,
  picking,
  onGrip,
  onRename,
  onColor,
  onClosePicker,
}: {
  instrument: Instrument
  active: boolean
  muted: boolean
  solo: boolean
  lifted: boolean
  gap: number | null
  playing: boolean
  level: number
  picking: boolean
  onSelect: () => void
  onPreview: () => void
  recording: boolean
  onRecordHold?: (down: boolean) => void
  onMute: () => void
  onSolo: () => void
  onGrip: (event: ReactPointerEvent<HTMLElement>) => void
  onRename: (name: string) => void
  onColor: (color: string | null) => void
  onClosePicker: () => void
}) {
  const color = instrumentColor(instrument)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(instrument.name)
  const rowRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!picking) return
    const close = (event: PointerEvent) => {
      if (!rowRef.current?.contains(event.target as Node)) onClosePicker()
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [picking, onClosePicker])

  function commit() {
    setEditing(false)
    onRename(draft)
  }

  return (
    <>
    {gap !== null ? <li className="track-gap" data-drop-index={gap} /> : null}
    <li
      ref={rowRef}
      data-track-id={instrument.id}
      className={[active ? 'is-selected' : '', muted ? 'is-muted' : '', solo ? 'is-solo' : '', lifted ? 'is-lifted' : '']
        .filter(Boolean)
        .join(' ')}
      style={{ '--voice': color } as CSSProperties}
    >
      <button
        type="button"
        className="track-grip"
        aria-label={`Move or recolor ${instrument.name}`}
        aria-haspopup="dialog"
        aria-expanded={picking}
        style={activityStyle(playing, level)}
        onPointerDown={onGrip}
      />
      {picking ? (
        <div className="color-picker" role="dialog" aria-label={`Color for ${instrument.name}`}>
          {TRACK_COLORS.map((swatch) => {
            const current = swatch === color
            return (
              <button
                key={swatch}
                type="button"
                className={current ? 'color-swatch is-on' : 'color-swatch'}
                style={{ background: swatch }}
                aria-label={swatch}
                aria-pressed={current}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => onColor(instrument.color === swatch ? null : swatch)}
              />
            )
          })}
        </div>
      ) : null}
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
        <span className={['track-tools', muted || solo ? 'is-on' : ''].filter(Boolean).join(' ')}>
          <button
            type="button"
            className={muted ? 'mute is-on' : 'mute'}
            data-testid={`mute-${instrument.id}`}
            aria-pressed={muted}
            aria-label={muted ? `Unmute ${instrument.name}` : `Mute ${instrument.name}`}
            onClick={onMute}
          >
            M
          </button>
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
          data-testid={`pad-${instrument.id}`}
          aria-label={`Play ${instrument.name}`}
          onPointerDown={(event) => {
            if (recording) beginPadHold(onRecordHold, event)
          }}
          onClick={() => {
            if (!recording) onPreview()
          }}
        />
      </span>
    </li>
    </>
  )
}

function activityStyle(playing: boolean, level: number): CSSProperties | undefined {
  if (!playing) return undefined
  const pulse = Math.min(1, Math.pow(Math.max(0, level), 0.38) * 1.35)
  return {
    opacity: 0.42 + 0.58 * pulse,
    filter: `brightness(${1 + pulse * 1.55})`,
    boxShadow: pulse > 0.06 ? `0 0 ${8 + pulse * 18}px color-mix(in srgb, var(--voice) ${Math.round(40 + pulse * 60)}%, transparent)` : undefined,
  }
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
