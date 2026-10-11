import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  bassMidi,
  compactChordLabel,
  describeChord,
  diatonicDegree,
  KEYS,
  midiName,
  noteName,
  spellIntervals,
  type ChordQuality,
} from '../model/harmony.ts'
import {
  DEFAULT_FX,
  flipOff,
  groupSizeForMeter,
  matchingCatalog,
  loopSteps,
  openRack,
  patternFor,
  rackFromInstrument,
  relatedCatalogs,
  rollNotes,
  slotEnabled,
  stepsForMeter,
  type CatalogId,
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
import { AddMenu, type Selection } from './InstrumentList.tsx'
import { ChannelStrip } from './ChannelStrip.tsx'
import { MixerConsole } from './MixerConsole.tsx'
import { PianoRoll } from './PianoRoll.tsx'
import { AutomationPanel } from './AutomationPanel.tsx'
import {
  applyRackAutomation,
  automationTargets,
  heardMasterMix,
  readParam,
  setAutomationStep,
  songAutomationTargets,
  songReadBase,
  songReadSteps,
  songWriteStep,
} from '../model/automation.ts'
import { AccentRow, StepLane } from './StepSequencer.tsx'
import { BarPager } from './BarPager.tsx'
import type { RackScope } from '../model/project.ts'

type EditorProps = {
  project: Project
  selection: Selection
  playhead: number
  motionAt: number
  sectionId: string
  partName: string
  playing: boolean
  activity: Record<string, number>
  level: { left: number; right: number }
  onPaint: (instrumentId: string, stepIndex: number, on: boolean) => void
  onNudge: (instrumentId: string, stepIndex: number, delta: number) => void
  onPitch: (instrumentId: string, stepIndex: number, pitch: number) => void
  onTrackRack: (instrumentId: string, update: (rack: Rack) => Rack) => void
  onGroupRack: (groupId: string, update: (rack: Rack) => Rack) => void
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
  onSelectGroup?: (groupId: string) => void
  onMute?: (instrumentId: string) => void
  onSolo?: (instrumentId: string) => void
  onSyncInsert?: (scope: RackScope, insert: InsertId) => void
  onSyncMix?: (scope: RackScope) => void
  onAddInsertAll?: (scope: RackScope, insert: InsertId) => void
  onCopyBar: (instrumentIds: string[], fromBar: number, toBars: number[], copyAccent: boolean) => void
  onPreviewCatalog: (catalog: CatalogId) => void
  onRetune: (instrumentId: string, catalog: CatalogId) => void
  onLiveView?: (live: boolean) => void
  followLive?: boolean
  onFollowLive?: (follow: boolean) => void
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
  const barCount = section?.bars ?? 1
  const stepsPerBar = stepsForMeter(section?.meter ?? '4/4')
  const [barPage, setBarPage] = useState(0)
  const followLive = props.followLive ?? true
  const page = Math.min(barPage, Math.max(0, barCount - 1))
  const viewStart = page * stepsPerBar
  const playingBar = props.playhead >= 0 ? Math.floor(props.playhead / stepsPerBar) : -1
  const live = playing && playingBar >= 0 && (selection.kind === 'song' || playingBar === page)

  useEffect(() => {
    setBarPage(0)
  }, [sectionId])

  useEffect(() => {
    setBarPage((current) => Math.min(current, Math.max(0, barCount - 1)))
  }, [barCount])

  useEffect(() => {
    if (!followLive) return
    if (playingBar >= 0 && playingBar < barCount) setBarPage(playingBar)
  }, [followLive, playingBar, barCount])

  useLayoutEffect(() => {
    props.onLiveView?.(live)
    return () => props.onLiveView?.(false)
  }, [live, props.onLiveView])

  const autoLength = loopSteps(section?.meter ?? '4/4', section?.bars ?? 1)
  const motionAt = props.motionAt
  const shownRack = (rack: Rack) => (motionAt >= 0 ? applyRackAutomation(rack, motionAt) : rack)
  const groove = heardMasterMix(project, section, motionAt)
  const automation = (rack: Rack, onRack: (update: (rack: Rack) => Rack) => void, hideLevel = false) => (
    <AutomationPanel
      targets={automationTargets(rack, { hideLevel })}
      stepsOf={(id) => rack.automation?.[id] ?? []}
      baseOf={(id) => readParam(rack, id)}
      onWrite={(id, index, stored) => onRack((current) => setAutomationStep(current, id, index, stored, autoLength))}
      length={autoLength}
      playhead={props.playhead}
      groupSize={groupSize}
      viewStart={0}
      viewLength={autoLength}
      barLength={stepsPerBar}
    />
  )

  const pager = (instrumentIds: string[], copyAccent = false) => (
    <BarPager
      bars={barCount}
      page={page}
      playingBar={playingBar}
      onPage={(bar) => {
        props.onFollowLive?.(false)
        setBarPage(bar)
      }}
      onCopyTo={(targets) => props.onCopyBar(instrumentIds, page, targets, copyAccent)}
    />
  )

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
            motionAt={motionAt}
            onSelectInstrument={props.onSelectInstrument ?? (() => {})}
            onSelectGroup={props.onSelectGroup ?? (() => {})}
            onMute={props.onMute ?? (() => {})}
            onSolo={props.onSolo ?? (() => {})}
            onTrackRack={props.onTrackRack}
            onGroupRack={props.onGroupRack}
            onMaster={props.onMaster}
            onMasterPan={(pan) => props.onSongRack((rack) => ({ ...rack, pan }))}
            onPreview={props.onPreview}
          />
        </div>
        <ChannelStrip
          {...busStrip(
            busInstrument('song', partName, shownRack(section?.bus ?? openRack(1))),
            props.onSongRack,
            props,
            { kind: 'song' },
          )}
          masterGroove={{
            swing: groove.swing,
            accentAmount: groove.accentAmount,
            master: groove.master,
            onSwing: props.onSwing,
            onAccentAmount: props.onAccentAmount,
            onMaster: props.onMaster,
          }}
          {...effects}
        />
        <AutomationPanel
          targets={songAutomationTargets(project, section)}
          stepsOf={(id) => songReadSteps(project, section, id)}
          baseOf={(id) => songReadBase(project, section, id)}
          onWrite={(id, index, stored) => {
            if (!section) return
            songWriteStep(project, section, id, index, stored, autoLength, props.onTrackRack, props.onSongRack, props.onGroupRack)
          }}
          length={autoLength}
          playhead={props.playhead}
          groupSize={groupSize}
          viewStart={0}
          viewLength={autoLength}
          barLength={stepsPerBar}
        />
      </section>
    )
  }

  if (selection.kind === 'instrument') {
    const instrument = project.instruments.find((item) => item.id === selection.instrumentId)
    if (!instrument) return <section className="editor" />
    return (
      <section className="editor" style={accentStyle(instrument)}>
        <EditorTitle
          partName={partName}
          title={instrument.name}
          playing={playing}
          level={heard}
          picker={{
            entries: relatedCatalogs(instrument),
            currentId: matchingCatalog(instrument),
            onPreview: props.onPreviewCatalog,
            onPick: (catalog) => props.onRetune(instrument.id, catalog),
          }}
        />
        <div className="editor-stage">
        {instrument.voice.type === '808' ? (
          <>
            <div className="lane-list">
              <StepLane
                instrumentId={instrument.id}
                name={instrument.name}
                drum={instrument.voice.drum}
                color={instrumentColor(instrument)}
                pattern={patternFor(project, instrument.id, sectionId)}
                playhead={props.playhead}
                groupSize={groupSize}
                viewStart={viewStart}
                viewLength={stepsPerBar}
                solo
                onPaint={(stepIndex, on) => props.onPaint(instrument.id, stepIndex, on)}
              />
            </div>
            {pager([instrument.id])}
          </>
        ) : (
          <KeysRoll
            instrument={instrument}
            pattern={patternFor(project, instrument.id, sectionId)}
            notes={rollNotes(project, instrument.id, sectionId)}
            length={patternFor(project, instrument.id, sectionId)?.steps.length ?? 16}
            groupSize={groupSize}
            viewStart={viewStart}
            viewLength={stepsPerBar}
            songKey={songKey}
            sectionId={sectionId}
            playhead={props.playhead}
            column={chosenStep}
            onColumn={setChosenStep}
            onChange={(notes) => props.onNotes(instrument.id, notes)}
            onPitch={(stepIndex, pitch) => props.onPitch(instrument.id, stepIndex, pitch)}
            scale="major"
            low={instrument.voice.type === 'bass' ? 24 : 48}
            high={instrument.voice.type === 'bass' ? 60 : 84}
            pager={pager([instrument.id])}
          />
        )}
        </div>
        <ChannelStrip {...stripProps(withRack(instrument, shownRack(section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument))), props)} {...effects} />
        {automation(
          section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument),
          (update) => props.onTrackRack(instrument.id, update),
        )}
      </section>
    )
  }

  const group = project.groups.find((item) => item.id === selection.groupId)
  const editGroup = (update: (rack: Rack) => Rack) => props.onGroupRack(group?.id ?? 'group', update)
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
            instrument={activeMelodic}
            pattern={patternFor(project, activeMelodic.id, sectionId)}
            notes={rollNotes(project, activeMelodic.id, sectionId)}
            length={patternFor(project, activeMelodic.id, sectionId)?.steps.length ?? 16}
            groupSize={groupSize}
            viewStart={viewStart}
            viewLength={stepsPerBar}
            songKey={songKey}
            sectionId={sectionId}
            playhead={props.playhead}
            column={chosenStep}
            onColumn={setChosenStep}
            onChange={(notes) => props.onNotes(activeMelodic.id, notes)}
            onPitch={(stepIndex, pitch) => props.onPitch(activeMelodic.id, stepIndex, pitch)}
            scale="major"
            low={48}
            high={84}
            pager={pager([activeMelodic.id])}
          />
        </div>
        <ChannelStrip
          {...busStrip(
            busInstrument(group?.id ?? 'group', group?.name ?? 'Group', shownRack(section?.groups?.[group?.id ?? ''] ?? openRack(1))),
            editGroup,
            props,
            { kind: 'group', groupId: group?.id ?? 'group' },
          )}
          {...effects}
        />
        {automation(section?.groups?.[group?.id ?? ''] ?? openRack(1), editGroup)}
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
            busInstrument(group?.id ?? 'group', group?.name ?? 'Group', shownRack(section?.groups?.[group?.id ?? ''] ?? openRack(1))),
            editGroup,
            props,
            { kind: 'group', groupId: group?.id ?? 'group' },
          )}
          {...effects}
        />
        {automation(section?.groups?.[group?.id ?? ''] ?? openRack(1), editGroup)}
      </section>
    )
  }

  return (
    <section className="editor">
      <EditorTitle partName={partName} title={group?.name ?? 'Tracks'} playing={playing} level={heard} />
      <div className="editor-stage">
      <div className="lane-list">
        {drums ? (
          <AccentRow
            accent={section?.accent ?? []}
            playhead={props.playhead}
            groupSize={groupSize}
            viewStart={viewStart}
            viewLength={stepsPerBar}
            onAccent={props.onAccent}
          />
        ) : null}
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
              viewStart={viewStart}
              viewLength={stepsPerBar}
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
      {pager(instruments.map((instrument) => instrument.id), drums)}
      </div>
      <ChannelStrip
        {...busStrip(
          busInstrument(group?.id ?? 'group', group?.name ?? 'Group', shownRack(section?.groups?.[group?.id ?? ''] ?? openRack(1))),
          editGroup,
          props,
          { kind: 'group', groupId: group?.id ?? 'group' },
        )}
        {...effects}
      />
      {automation(section?.groups?.[group?.id ?? ''] ?? openRack(1), editGroup)}
    </section>
  )
}

function EditorTitle({
  partName,
  title,
  playing,
  level,
  picker,
}: {
  partName: string
  title: string
  playing: boolean
  level: number
  picker?: {
    entries: ReturnType<typeof relatedCatalogs>
    currentId: CatalogId | null
    onPreview: (catalog: CatalogId) => void
    onPick: (catalog: CatalogId) => void
  }
}) {
  const [open, setOpen] = useState(false)
  const sounds = picker && picker.entries.length > 0 ? picker : null
  const families = sounds ? [...new Set(sounds.entries.map((item) => item.family))] : undefined
  return (
    <header className="editor-head">
      <p className="part-kicker">{partName}</p>
      <h2>
        {sounds ? (
          <button
            type="button"
            className="editor-sound"
            data-testid="sound-picker"
            aria-haspopup="menu"
            aria-expanded={open}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setOpen((current) => !current)}
          >
            {title}
          </button>
        ) : (
          title
        )}
        <span className="editor-light" aria-hidden style={playing ? { opacity: 0.2 + 0.8 * Math.min(1, level) } : undefined} />
        {sounds && open ? (
          <AddMenu
            includeGroup={false}
            families={families}
            entries={sounds.entries}
            currentId={sounds.currentId}
            onClose={() => setOpen(false)}
            onPreview={sounds.onPreview}
            onTrack={(catalog) => {
              setOpen(false)
              sounds.onPick(catalog)
            }}
          />
        ) : null}
      </h2>
    </header>
  )
}

function PanelFold({
  label,
  open,
  onToggle,
  testId,
}: {
  label: string
  open: boolean
  onToggle: () => void
  testId?: string
}) {
  return (
    <button
      type="button"
      className="strip-fold"
      aria-expanded={open}
      aria-label={open ? `Minimize ${label}` : `Show ${label}`}
      data-testid={testId}
      onClick={onToggle}
    >
      <span>{label}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
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
  instrument,
  pattern,
  notes,
  length,
  groupSize,
  viewStart,
  viewLength,
  songKey,
  sectionId,
  playhead,
  column,
  onColumn,
  onChange,
  onPitch,
  scale,
  low,
  high,
  pager,
}: {
  instrument: Instrument
  pattern: Pattern | null
  notes: NoteEvent[]
  length: number
  groupSize: number
  viewStart: number
  viewLength: number
  songKey: string
  sectionId: string
  playhead: number
  column: number
  onColumn: (step: number) => void
  onChange: (notes: NoteEvent[]) => void
  onPitch?: (stepIndex: number, pitch: number) => void
  scale: 'major' | 'minor'
  low: number
  high: number
  pager: ReactNode
}) {
  const [root, setRoot] = useState(songKey)
  const [tones, setTones] = useState<number[]>([4, 7])
  const [overwrite, setOverwrite] = useState(true)
  const [stepsOpen, setStepsOpen] = useState(true)
  const [rollOpen, setRollOpen] = useState(true)
  const [chordsOpen, setChordsOpen] = useState(true)
  const [span, setSpan] = useState<{ start: number; duration: number } | null>(null)
  const stampedRef = useRef<{ start: number; duration: number } | null>(null)
  const notesRef = useRef(notes)
  const tonesRef = useRef(tones)
  const rootRef = useRef(root)
  const overwriteRef = useRef(overwrite)
  notesRef.current = notes
  tonesRef.current = tones
  rootRef.current = root
  overwriteRef.current = overwrite

  useEffect(() => {
    setRoot(songKey)
    rootRef.current = songKey
  }, [songKey])

  useEffect(() => {
    release()
  }, [sectionId, instrument.id])

  function brushPitches(nextRoot = rootRef.current, nextTones = tonesRef.current) {
    const voiced = spellIntervals(nextRoot, [0, ...nextTones])
    if (instrument.voice.type === 'bass') return [voiced[0]! - 24]
    if (instrument.voice.type === 'lead') return [voiced[0]!]
    return voiced
  }

  function applyTones(nextTones: number[]) {
    setTones(nextTones)
    tonesRef.current = nextTones
  }

  function applyRoot(next: string) {
    setRoot(next)
    rootRef.current = next
  }

  function applyDegree(degree: number) {
    const next = diatonicDegree(songKey, degree, scale)
    setRoot(next.root)
    rootRef.current = next.root
    setTones(next.tones)
    tonesRef.current = next.tones
  }

  function write(next: { start: number; duration: number }) {
    const pitches = brushPitches()
    if (!overwriteRef.current) {
      if (notesRef.current.some((note) => overlaps(note, next))) return
      onChange([
        ...notesRef.current,
        ...pitches.map((pitch) => ({ pitch, start: next.start, duration: next.duration, velocity: 0.9 })),
      ])
      stampedRef.current = next
      setSpan(next)
      return
    }
    onChange(retargetChord(notesRef.current, null, next, pitches))
    stampedRef.current = next
    setSpan(next)
  }

  function release() {
    stampedRef.current = null
    setSpan(null)
  }

  function paintStep(stepIndex: number, on: boolean) {
    onColumn(stepIndex)
    if (!overwriteRef.current && !on) {
      onChange(notesRef.current.filter((note) => Math.round(note.start) !== stepIndex))
      if (stampedRef.current?.start === stepIndex) release()
      return
    }
    write({ start: stepIndex, duration: 1 })
  }

  const written = notes.length > 0
  const shown = written && pattern ? overlayNotes(pattern) : pattern
  const originFor = (stepIndex: number) => {
    const step = pattern?.steps[stepIndex]
    if (step?.pitch != null) return step.pitch
    const note = notes.find((item) => Math.round(item.start) === stepIndex)
    if (note) return note.pitch
    if (instrument.voice.type === 'bass') return bassMidi(songKey, step?.degree ?? 0)
    if (instrument.voice.type === 'lead') return bassMidi(songKey, step?.degree ?? 0) + 12
    return 60
  }

  return (
    <div className="keys-roll">
      <div className={['seq-stack', stepsOpen ? '' : 'is-collapsed'].filter(Boolean).join(' ')}>
        <PanelFold label="Steps" open={stepsOpen} testId="steps-toggle" onToggle={() => setStepsOpen((open) => !open)} />
        {stepsOpen ? (
          <div className="lane-list">
            <StepLane
              instrumentId={instrument.id}
              name={instrument.name}
              drum={null}
              color={instrumentColor(instrument)}
              pattern={shown}
              playhead={playhead}
              groupSize={groupSize}
              viewStart={viewStart}
              viewLength={viewLength}
              solo
              face={written && pattern ? noteFace(pattern) : faceFor(songKey, instrument, false)}
              onPaint={paintStep}
              onPitch={onPitch}
              originFor={originFor}
              scaleKey={songKey}
            />
          </div>
        ) : null}
      </div>
      <div className={['roll-stack', rollOpen ? '' : 'is-collapsed'].filter(Boolean).join(' ')}>
        <PanelFold label="Piano roll" open={rollOpen} testId="piano-roll-toggle" onToggle={() => setRollOpen((open) => !open)} />
        {rollOpen ? (
          <PianoRoll
            notes={notes}
            length={length}
            groupSize={groupSize}
            viewStart={viewStart}
            viewLength={viewLength}
            songKey={songKey}
            scale={scale}
            low={low}
            high={high}
            playhead={playhead}
            column={column}
            onColumn={onColumn}
            onChange={onChange}
            heldSpan={span}
            onSpan={(next) => write(next)}
          />
        ) : null}
      </div>
      <div className={['chord-stack', chordsOpen ? '' : 'is-collapsed'].filter(Boolean).join(' ')}>
        <PanelFold
          label="Chord builder"
          open={chordsOpen}
          testId="chord-toggle"
          onToggle={() => setChordsOpen((open) => !open)}
        />
        {chordsOpen ? (
          <ChordBoard
            songKey={songKey}
            scale={scale}
            root={root}
            tones={tones}
            overwrite={overwrite}
            onRoot={applyRoot}
            onToggle={(semi) => {
              const nextTones = tonesRef.current.includes(semi)
                ? tonesRef.current.filter((tone) => tone !== semi)
                : [...tonesRef.current, semi]
              applyTones(nextTones)
            }}
            onDegree={applyDegree}
            onOverwrite={(next) => {
              setOverwrite(next)
              overwriteRef.current = next
            }}
          />
        ) : null}
      </div>
      {pager}
    </div>
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
    if (starting.length === 0) return '-'
    if (starting.length === 1) return midiName(starting[0]!.pitch)
    const rootMidi = Math.min(...starting.map((note) => note.pitch))
    const root = KEYS[(((rootMidi % 12) + 12) % 12)] ?? 'C'
    return compactChordLabel(
      root,
      starting.map((note) => note.pitch - rootMidi),
    )
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
