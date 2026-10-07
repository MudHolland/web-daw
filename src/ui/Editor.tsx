import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { bassMidi, describeChord, midiName, noteName, spellIntervals, type ChordQuality } from '../model/harmony.ts'
import {
  DEFAULT_FX,
  flipOff,
  groupSizeForMeter,
  openRack,
  patternFor,
  rackFromInstrument,
  rollNotes,
  slotEnabled,
  type Envelope,
  type FxSettings,
  type InsertId,
  type Rack,
  type Wave,
  type Instrument,
  type NoteEvent,
  type Pattern,
  type Project,
  type SoundParams,
} from '../model/project.ts'
import { ChordBoard } from './ChordBoard.tsx'
import { instrumentColor } from './drums.ts'
import type { Selection } from './InstrumentList.tsx'
import { ChannelStrip } from './ChannelStrip.tsx'
import { MixerConsole } from './MixerConsole.tsx'
import { PianoRoll } from './PianoRoll.tsx'
import { AccentRow, StepLane } from './StepSequencer.tsx'
import type { RackScope } from '../model/project.ts'

type EditorProps = {
  project: Project
  selection: Selection
  playhead: number
  sectionId: string
  partName: string
  playing: boolean
  activity: Record<string, number>
  level: { left: number; right: number }
  onPaint: (instrumentId: string, stepIndex: number, on: boolean) => void
  onNudge: (instrumentId: string, stepIndex: number, delta: number) => void
  onPitch: (instrumentId: string, stepIndex: number, pitch: number) => void
  onTrackRack: (instrumentId: string, update: (rack: Rack) => Rack) => void
  onGroupRack: (update: (rack: Rack) => Rack) => void
  onSongRack: (update: (rack: Rack) => Rack) => void
  onAccent: (stepIndex: number, on: boolean) => void
  onSwing: (swing: number) => void
  onAccentAmount: (amount: number) => void
  onMaster: (master: number) => void
  onSound: (instrumentId: string, key: keyof SoundParams, value: number) => void
  onBass: (instrumentId: string, key: 'cutoff' | 'decay' | 'glide', value: number) => void
  onChord: (instrumentId: string, key: 'cutoff' | 'decay', value: number) => void
  onWave: (instrumentId: string, wave: Wave) => void
  onEnvelope: (instrumentId: string, key: keyof Envelope, value: number) => void
  onAddInsert: (instrumentId: string, insert: InsertId) => void
  onRemoveInsert: (instrumentId: string, insert: InsertId) => void
  onToggleInsert: (instrumentId: string, insert: InsertId) => void
  onPreview: (instrumentId: string) => void
  onNotes: (instrumentId: string, notes: NoteEvent[]) => void
  onSelectInstrument?: (instrumentId: string) => void
  onMute?: (instrumentId: string) => void
  onSolo?: (instrumentId: string) => void
  onSyncInsert?: (scope: RackScope, insert: InsertId) => void
  onSyncMix?: (scope: RackScope) => void
  onAddInsertAll?: (scope: RackScope, insert: InsertId) => void
}

export function Editor(props: EditorProps) {
  const { project, selection, sectionId, partName, playing, activity, level } = props
  const heard = channelLevel(project, selection, activity, level)
  const [chosenStep, setChosenStep] = useState(0)
  const [groupMelodicId, setGroupMelodicId] = useState<string | null>(null)
  const [effectsOpen, setEffectsOpen] = useState(true)
  const effects = { collapsed: !effectsOpen, onToggleCollapsed: () => setEffectsOpen((open) => !open) }
  const section = project.sections.find((item) => item.id === sectionId)
  const groupSize = groupSizeForMeter(section?.meter ?? '4/4')
  const songKey = section?.key ?? project.key

  if (selection.kind === 'song') {
    return (
      <section className="editor">
        <EditorTitle partName={partName} title="Tracks" playing={playing} level={heard} />
        <div className="editor-stage">
          <MixerConsole
            project={project}
            sectionId={sectionId}
            partName={partName}
            activity={activity}
            level={level}
            onSelectInstrument={props.onSelectInstrument ?? (() => {})}
            onMute={props.onMute ?? (() => {})}
            onSolo={props.onSolo ?? (() => {})}
            onTrackRack={props.onTrackRack}
            onMaster={props.onMaster}
          />
        </div>
        <ChannelStrip
          {...busStrip(
            busInstrument('song', partName, section?.bus ?? openRack(1)),
            props.onSongRack,
            props,
            { kind: 'song' },
          )}
          masterGroove={{
            swing: project.swing,
            accentAmount: project.accentAmount,
            master: project.master,
            onSwing: props.onSwing,
            onAccentAmount: props.onAccentAmount,
            onMaster: props.onMaster,
          }}
          {...effects}
        />
      </section>
    )
  }

  if (selection.kind === 'instrument') {
    const instrument = project.instruments.find((item) => item.id === selection.instrumentId)
    if (!instrument) return <section className="editor" />
    return (
      <section className="editor" style={accentStyle(instrument)}>
        <EditorTitle partName={partName} title={instrument.name} playing={playing} level={heard} />
        <div className="editor-stage">
        {instrument.voice.type === '808' || instrument.voice.type === 'bass' ? (
          <div className="lane-list">
            <StepLane
              instrumentId={instrument.id}
              name={instrument.name}
              drum={instrument.voice.type === '808' ? instrument.voice.drum : null}
              color={instrumentColor(instrument)}
              pattern={patternFor(project, instrument.id, sectionId)}
              playhead={props.playhead}
              groupSize={groupSize}
              solo
              face={faceFor(songKey, instrument, false)}
              onPaint={(stepIndex, on) => props.onPaint(instrument.id, stepIndex, on)}
              onPitch={instrument.voice.type === 'bass' ? (stepIndex, pitch) => props.onPitch(instrument.id, stepIndex, pitch) : undefined}
              originFor={instrument.voice.type === 'bass' ? (stepIndex) => patternFor(project, instrument.id, sectionId)?.steps[stepIndex]?.pitch ?? bassMidi(songKey, patternFor(project, instrument.id, sectionId)?.steps[stepIndex]?.degree ?? 0) : undefined}
              scaleKey={instrument.voice.type === 'bass' ? songKey : undefined}
            />
          </div>
        ) : (
          <KeysRoll
            notes={rollNotes(project, instrument.id, sectionId)}
            length={patternFor(project, instrument.id, sectionId)?.steps.length ?? 16}
            groupSize={groupSize}
            songKey={songKey}
            sectionId={sectionId}
            playhead={props.playhead}
            column={chosenStep}
            onColumn={setChosenStep}
            onChange={(notes) => props.onNotes(instrument.id, notes)}
            scale="major"
            low={48}
            high={84}
          />
        )}
        </div>
        <ChannelStrip {...stripProps(withRack(instrument, section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument)), props)} {...effects} />
      </section>
    )
  }

  const group = project.groups.find((item) => item.id === selection.groupId)
  const instruments = (group?.instrumentIds ?? [])
    .map((id) => project.instruments.find((item) => item.id === id))
    .filter((item): item is Instrument => item !== undefined)
  const drums = instruments.some((instrument) => instrument.voice.type === '808')
  const melodicInstruments = instruments.filter((instrument) => instrument.voice.type !== '808' && instrument.voice.type !== 'bass')

  if (melodicInstruments.length > 0) {
    const activeMelodic = melodicInstruments.find((item) => item.id === groupMelodicId) ?? melodicInstruments[0]!
    return (
      <section className="editor">
        <EditorTitle partName={partName} title={group?.name ?? 'Melodic'} playing={playing} level={heard} />
        <div className="editor-stage">
          {melodicInstruments.length > 1 ? (
            <div className="view-switch" style={{ marginBottom: 12 }}>
              {melodicInstruments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === activeMelodic.id ? 'is-on' : ''}
                  onClick={() => setGroupMelodicId(item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          ) : null}
          <KeysRoll
            notes={rollNotes(project, activeMelodic.id, sectionId)}
            length={patternFor(project, activeMelodic.id, sectionId)?.steps.length ?? 16}
            groupSize={groupSize}
            songKey={songKey}
            sectionId={sectionId}
            playhead={props.playhead}
            column={chosenStep}
            onColumn={setChosenStep}
            onChange={(notes) => props.onNotes(activeMelodic.id, notes)}
            scale="major"
            low={48}
            high={84}
          />
        </div>
        <ChannelStrip
          {...busStrip(
            busInstrument(group?.id ?? 'group', group?.name ?? 'Group', section?.groups?.[group?.id ?? ''] ?? openRack(1)),
            props.onGroupRack,
            props,
            { kind: 'group', groupId: group?.id ?? 'group' },
          )}
          {...effects}
        />
      </section>
    )
  }

  if (instruments.length === 0 && (group?.id === 'group-melodic' || group?.name.toLowerCase().includes('melodic'))) {
    return (
      <section className="editor">
        <EditorTitle partName={partName} title={group?.name ?? 'Melodic'} playing={playing} level={heard} />
        <div className="editor-stage">
          <p style={{ color: 'var(--muted)', textAlign: 'center', marginTop: 48, fontSize: 14, letterSpacing: '0.08em' }}>
            Add a melodic track in the Tracks drawer to compose on the piano roll
          </p>
        </div>
        <ChannelStrip
          {...busStrip(
            busInstrument(group?.id ?? 'group', group?.name ?? 'Group', section?.groups?.[group?.id ?? ''] ?? openRack(1)),
            props.onGroupRack,
            props,
            { kind: 'group', groupId: group?.id ?? 'group' },
          )}
          {...effects}
        />
      </section>
    )
  }

  return (
    <section className="editor">
      <EditorTitle partName={partName} title={group?.name ?? 'Tracks'} playing={playing} level={heard} />
      <div className="editor-stage">
      <div className="lane-list">
        {drums ? <AccentRow accent={section?.accent ?? []} playhead={props.playhead} groupSize={groupSize} onAccent={props.onAccent} /> : null}
        {instruments.map((instrument) => {
          const pattern = patternFor(project, instrument.id, sectionId)
          const written = instrument.voice.type !== '808' && instrument.voice.type !== 'bass' && (pattern?.notes.length ?? 0) > 0
          const isMelodic = instrument.voice.type !== '808'
          return (
            <StepLane
              key={instrument.id}
              instrumentId={instrument.id}
              name={instrument.name}
              drum={instrument.voice.type === '808' ? instrument.voice.drum : null}
              color={instrumentColor(instrument)}
              pattern={written && pattern ? overlayNotes(pattern) : pattern}
              playhead={props.playhead}
              groupSize={groupSize}
              muted={!slotEnabled(project, instrument.id, sectionId)}
              face={written && pattern ? noteFace(pattern) : faceFor(songKey, instrument, false)}
              onPaint={(stepIndex, on) => props.onPaint(instrument.id, stepIndex, on)}
              onPitch={isMelodic ? (stepIndex, pitch) => props.onPitch(instrument.id, stepIndex, pitch) : undefined}
              originFor={isMelodic ? (stepIndex) => {
                const step = pattern?.steps[stepIndex]
                if (step?.pitch != null) return step.pitch
                const note = pattern?.notes.find((n) => Math.round(n.start) === stepIndex)
                if (note?.pitch != null) return note.pitch
                if (instrument.voice.type === 'bass') return bassMidi(songKey, step?.degree ?? 0)
                if (instrument.voice.type === 'lead') return bassMidi(songKey, step?.degree ?? 0) + 12
                return 60
              } : undefined}
              scaleKey={isMelodic ? songKey : undefined}
            />
          )
        })}
      </div>
      </div>
      <ChannelStrip
        {...busStrip(
          busInstrument(group?.id ?? 'group', group?.name ?? 'Group', section?.groups?.[group?.id ?? ''] ?? openRack(1)),
          props.onGroupRack,
          props,
          { kind: 'group', groupId: group?.id ?? 'group' },
        )}
        {...effects}
      />
    </section>
  )
}

function EditorTitle({ partName, title, playing, level }: { partName: string; title: string; playing: boolean; level: number }) {
  return (
    <header className="editor-head">
      <p className="part-kicker">{partName}</p>
      <h2>
        {title}
        <span className="editor-light" aria-hidden style={playing ? { opacity: 0.2 + 0.8 * Math.min(1, level) } : undefined} />
      </h2>
    </header>
  )
}

function channelLevel(
  project: Project,
  selection: Selection,
  activity: Record<string, number>,
  level: { left: number; right: number },
): number {
  if (selection.kind === 'instrument') return activity[selection.instrumentId] ?? 0
  if (selection.kind === 'group') {
    const group = project.groups.find((item) => item.id === selection.groupId)
    return Math.max(0, ...(group?.instrumentIds ?? []).map((id) => activity[id] ?? 0))
  }
  return Math.max(level.left, level.right)
}

function KeysRoll({
  notes,
  length,
  groupSize,
  songKey,
  sectionId,
  playhead,
  column,
  onColumn,
  onChange,
  scale,
  low,
  high,
}: {
  notes: NoteEvent[]
  length: number
  groupSize: number
  songKey: string
  sectionId: string
  playhead: number
  column: number
  onColumn: (step: number) => void
  onChange: (notes: NoteEvent[]) => void
  scale: 'major' | 'minor'
  low: number
  high: number
}) {
  const [root, setRoot] = useState(songKey)
  const [tones, setTones] = useState<number[]>([4, 7])
  const [span, setSpan] = useState<{ start: number; duration: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const stampedRef = useRef<{ start: number; duration: number } | null>(null)
  const notesRef = useRef(notes)
  const tonesRef = useRef(tones)
  const rootRef = useRef(root)
  const editingRef = useRef(editing)
  notesRef.current = notes
  tonesRef.current = tones
  rootRef.current = root
  editingRef.current = editing

  useEffect(() => {
    setRoot(songKey)
  }, [songKey])

  useEffect(() => {
    setEditing(false)
    editingRef.current = false
    setSpan(null)
    stampedRef.current = null
  }, [sectionId])

  function pitches(nextRoot = rootRef.current, nextTones = tonesRef.current) {
    return spellIntervals(nextRoot, [0, ...nextTones])
  }

  function write(next: { start: number; duration: number }, previous: { start: number; duration: number } | null) {
    onChange(retargetChord(notesRef.current, previous, next, pitches()))
    stampedRef.current = next
    setSpan(next)
    setEditing(true)
    editingRef.current = true
  }

  return (
    <>
      <PianoRoll
        notes={notes}
        length={length}
        groupSize={groupSize}
        songKey={songKey}
        scale={scale}
        low={low}
        high={high}
        playhead={playhead}
        column={column}
        onColumn={onColumn}
        onChange={onChange}
        heldSpan={span}
        onSpan={(next) => write(next, editingRef.current ? stampedRef.current : null)}
      />
      <ChordBoard
        root={root}
        tones={tones}
        editing={editing}
        onRoot={(next) => {
          setRoot(next)
          rootRef.current = next
          const current = stampedRef.current
          if (editingRef.current && current) write(current, current)
        }}
        onToggle={(semi) => {
          const nextTones = tonesRef.current.includes(semi)
            ? tonesRef.current.filter((tone) => tone !== semi)
            : [...tonesRef.current, semi]
          setTones(nextTones)
          tonesRef.current = nextTones
          const current = stampedRef.current
          if (editingRef.current && current) write(current, current)
        }}
        onNext={() => {
          setEditing(false)
          editingRef.current = false
          setSpan(null)
          stampedRef.current = null
        }}
      />
    </>
  )
}

function overlaps(note: NoteEvent, span: { start: number; duration: number }) {
  return note.start < span.start + span.duration && note.start + note.duration > span.start
}

function retargetChord(
  notes: NoteEvent[],
  previous: { start: number; duration: number } | null,
  span: { start: number; duration: number },
  pitches: number[],
): NoteEvent[] {
  return [
    ...notes.filter((note) => !overlaps(note, span) && !(previous && overlaps(note, previous))),
    ...pitches.map((pitch) => ({ pitch, start: span.start, duration: span.duration, velocity: 0.9 })),
  ]
}

function withRack(instrument: Instrument, rack: Rack): Instrument {
  return {
    ...instrument,
    mix: { level: rack.level, pan: rack.pan, eq: { ...rack.eq } },
    fx: rack.fx,
    inserts: [...instrument.inserts.filter((item) => item === 'adsr' || item === 'processing'), ...rack.inserts],
    off: [...(instrument.off ?? []).filter((item) => item === 'adsr' || item === 'processing'), ...(rack.off ?? [])],
  }
}

function busInstrument(id: string, name: string, rack: Rack): Instrument {
  return {
    id,
    name,
    kind: 'melodic',
    voice: { type: 'chord', sound: { cutoff: 0.5, decay: 0.4, wave: 'triangle' } },
    patterns: [],
    mix: { level: rack.level, pan: rack.pan, eq: { ...rack.eq } },
    effects: [],
    fx: rack.fx,
    inserts: rack.inserts.slice(),
    off: rack.off?.slice(),
    envelope: { attack: 0.02, decay: 0.35, sustain: 0.45, release: 0.28 },
  }
}

function stripProps(instrument: Instrument, props: EditorProps) {
  const edit = (change: (rack: Rack) => Rack) => props.onTrackRack(instrument.id, change)
  return deckProps(instrument, edit, props, false, { kind: 'track', instrumentId: instrument.id })
}

function busStrip(
  instrument: Instrument,
  update: (change: (rack: Rack) => Rack) => void,
  props: EditorProps,
  scope: RackScope,
) {
  return { ...deckProps(instrument, update, props, true, scope), bus: true }
}

function deckProps(
  instrument: Instrument,
  edit: (change: (rack: Rack) => Rack) => void,
  props: EditorProps,
  bus: boolean,
  scope: RackScope,
) {
  return {
    instrument,
    layout: 'full' as const,
    bus,
    onLevel: (level: number) => edit((rack) => ({ ...rack, level })),
    onPan: (pan: number) => edit((rack) => ({ ...rack, pan })),
    onEq: (band: 'low' | 'mid' | 'high', value: number) => edit((rack) => ({ ...rack, eq: { ...rack.eq, [band]: value } })),
    onSound: (key: keyof SoundParams, value: number) => props.onSound(instrument.id, key, value),
    onBass: (key: 'cutoff' | 'decay' | 'glide', value: number) => props.onBass(instrument.id, key, value),
    onChord: (key: 'cutoff' | 'decay', value: number) => props.onChord(instrument.id, key, value),
    onWave: (wave: Wave) => props.onWave(instrument.id, wave),
    onFx: (effect: keyof FxSettings, key: string, value: number) =>
      edit((rack) => ({
        ...rack,
        fx: { ...rack.fx, [effect]: { ...rack.fx[effect], [key]: value } },
      })),
    onEnvelope: (key: keyof Envelope, value: number) => props.onEnvelope(instrument.id, key, value),
    onSyncInsert: props.onSyncInsert ? (insert: InsertId) => props.onSyncInsert!(scope, insert) : undefined,
    onSyncMix: props.onSyncMix ? () => props.onSyncMix!(scope) : undefined,
    onAddInsert: (insert: InsertId, allParts?: boolean) => {
      if (allParts && props.onAddInsertAll) {
        props.onAddInsertAll(scope, insert)
        return
      }
      if (!bus && (insert === 'adsr' || insert === 'processing')) props.onAddInsert(instrument.id, insert)
      else if (insert === 'eq' || insert === 'adsr' || insert === 'processing') {
        edit((rack) => (rack.inserts.includes(insert) ? rack : { ...rack, inserts: [...rack.inserts, insert] }))
      } else {
        const effect = insert
        edit((rack) =>
          rack.inserts.includes(effect) ? rack : { ...rack, inserts: [...rack.inserts, effect], fx: { ...rack.fx, [effect]: { ...DEFAULT_FX[effect] } } },
        )
      }
    },
    onRemoveInsert: (insert: InsertId) => {
      if (!bus && (insert === 'adsr' || insert === 'processing')) props.onRemoveInsert(instrument.id, insert)
      else edit((rack) => ({ ...rack, inserts: rack.inserts.filter((item) => item !== insert), off: rack.off?.filter((item) => item !== insert) }))
    },
    onToggleInsert: (insert: InsertId) => {
      if (!bus && (insert === 'adsr' || insert === 'processing')) props.onToggleInsert(instrument.id, insert)
      else edit((rack) => ({ ...rack, off: flipOff(rack.off, insert) }))
    },
    onPreview: () => props.onPreview(instrument.id),
  }
}

function overlayNotes(pattern: Pattern): Pattern {
  return {
    ...pattern,
    steps: pattern.steps.map((step, index) => {
      const matchingNote = pattern.notes.find((note) => Math.round(note.start) === index)
      const on = pattern.notes.some((note) => note.start <= index && index < note.start + note.duration)
      return {
        ...step,
        on: on || step.on,
        pitch: step.pitch ?? matchingNote?.pitch,
      }
    }),
  }
}

function noteFace(pattern: Pattern) {
  return (index: number, on: boolean) => {
    if (!on) return String(index + 1)
    const starting = pattern.notes.filter((note) => Math.round(note.start) === index)
    if (starting.length === 0) return '·'
    return starting
      .slice(0, 2)
      .map((note) => midiName(note.pitch))
      .join(' ')
  }
}

function faceFor(key: string, instrument: Instrument, rich: boolean) {
  if (instrument.voice.type === '808') return undefined
  return (index: number, on: boolean, degree: number, quality: ChordQuality | null) => {
    if (!on) return String(index + 1)
    if (instrument.voice.type === 'bass' || instrument.voice.type === 'lead') return noteName(key, degree)
    const described = describeChord(key, degree, quality)
    if (!rich || described.roman === described.symbol) return described.symbol
    return `${described.roman}\n${described.symbol}`
  }
}

function accentStyle(instrument: Instrument): CSSProperties {
  const color = instrumentColor(instrument)
  return { '--step-on': color, '--voice': color } as CSSProperties
}
