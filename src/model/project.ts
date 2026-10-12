import { bassMidi, chordMidis, type ChordQuality } from './harmony.ts'
import { clampGain } from './gain.ts'

export const DRUM_IDS = [
  'kick',
  'snare',
  'clap',
  'hatClosed',
  'hatOpen',
  'tom',
  'lowTom',
  'conga',
  'rim',
  'cowbell',
  'clave',
  'shaker',
  'cymbal',
] as const

export type DrumId = (typeof DRUM_IDS)[number]

export type Step = {
  on: boolean
  velocity: number
  degree: number
  quality: ChordQuality | null
  pitch?: number | null
}

export type NoteEvent = {
  pitch: number
  start: number
  duration: number
  velocity: number
}

export type Pattern = {
  id: string
  length: number
  steps: Step[]
  notes: NoteEvent[]
}

export type Mix = {
  level: number
  pan: number
  eq: {
    low: number
    mid: number
    high: number
  }
}

export type EffectType = 'delay' | 'chorus' | 'reverb' | 'flanger'

export type EffectSlot = {
  id: string
  type: EffectType
  params: Record<string, number>
}

export type SoundParams = {
  decay: number
  tone: number
  snap: number
}

export const DEFAULT_SOUND: SoundParams = {
  decay: 0.5,
  tone: 0.5,
  snap: 0.5,
}

export type Wave = 'sine' | 'triangle' | 'saw' | 'square'

export const WAVES: Wave[] = ['sine', 'triangle', 'saw', 'square']

export function isWave(value: unknown): value is Wave {
  return value === 'sine' || value === 'triangle' || value === 'saw' || value === 'square'
}

export type BassSound = {
  cutoff: number
  decay: number
  glide: number
  wave: Wave
}

export type ChordSound = {
  cutoff: number
  decay: number
  wave: Wave
}

export const DEFAULT_BASS: BassSound = { cutoff: 0.45, decay: 0.45, glide: 0.15, wave: 'saw' }
export const DEFAULT_LEAD: BassSound = { cutoff: 0.82, decay: 0.22, glide: 0.08, wave: 'saw' }
export const DEFAULT_CHORD: ChordSound = { cutoff: 0.55, decay: 0.4, wave: 'triangle' }
export const DEFAULT_PAD: ChordSound = { cutoff: 0.32, decay: 0.85, wave: 'saw' }

export const DRUM_KITS = ['808', '909', 'rock'] as const

export type DrumKit = (typeof DRUM_KITS)[number]

export const NINE_OH_NINE: readonly DrumId[] = ['kick', 'snare', 'clap', 'hatClosed', 'hatOpen', 'tom', 'lowTom', 'rim', 'cymbal']

export const ROCK_PIECES: readonly DrumId[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'tom', 'lowTom', 'rim', 'cymbal']

export function kitLabel(kit: DrumKit): string {
  if (kit === 'rock') return 'Rock'
  return kit
}

export type VoiceParams =
  | { type: '808'; kit: DrumKit; drum: DrumId; sound: SoundParams }
  | { type: 'bass'; sound: BassSound }
  | { type: 'lead'; sound: BassSound }
  | { type: 'chord'; sound: ChordSound }

export type InstrumentGroup = {
  id: string
  name: string
  instrumentIds: string[]
}

export type Instrument = {
  id: string
  name: string
  kind: 'drum' | 'melodic'
  voice: VoiceParams
  color?: string
  patterns: Pattern[]
  mix: Mix
  effects: EffectSlot[]
  fx: FxSettings
  inserts: InsertId[]
  off?: InsertId[]
  envelope: Envelope
}

export type Meter = '3/4' | '6/8' | '4/4' | '5/4'

export const METERS: Meter[] = ['3/4', '6/8', '4/4', '5/4']

export function stepsForMeter(meter: Meter): number {
  if (meter === '3/4' || meter === '6/8') return 12
  if (meter === '5/4') return 20
  return 16
}

export function groupSizeForMeter(meter: Meter): number {
  return meter === '6/8' ? 6 : 4
}

export type InsertId =
  | 'adsr'
  | 'eq'
  | 'processing'
  | 'delay'
  | 'echo'
  | 'chorus'
  | 'flanger'
  | 'mover'
  | 'tremolo'
  | 'distortion'
  | 'shifter'
  | 'cutoff'
  | 'reverb'
  | 'tape'
  | 'stutter'

export const INSERT_IDS: InsertId[] = [
  'adsr',
  'eq',
  'processing',
  'delay',
  'echo',
  'chorus',
  'flanger',
  'mover',
  'tremolo',
  'distortion',
  'shifter',
  'cutoff',
  'reverb',
  'tape',
  'stutter',
]

export function liveInserts(item: { inserts: InsertId[]; off?: InsertId[] }): InsertId[] {
  const off = item.off
  return off && off.length > 0 ? item.inserts.filter((insert) => !off.includes(insert)) : item.inserts
}

export function insertOn(item: { inserts: InsertId[]; off?: InsertId[] }, insert: InsertId): boolean {
  return item.inserts.includes(insert) && !item.off?.includes(insert)
}

export function flipOff(off: InsertId[] | undefined, insert: InsertId): InsertId[] {
  const current = off ?? []
  return current.includes(insert) ? current.filter((item) => item !== insert) : [...current, insert]
}

export type DelayFx = { time: number; feedback: number; mix: number }
export type ChorusFx = { rate: number; depth: number; mix: number }
export type FlangerFx = { rate: number; depth: number; feedback: number; mix: number }
export type MoverFx = { rate: number; depth: number }
export type TremoloFx = { rate: number; depth: number }
export type DistortionFx = { drive: number; tone: number; mix: number }
export type ShifterFx = { semi: number; mix: number }
export type CutoffFx = { low: number; high: number }
export type ReverbFx = { size: number; mix: number }
export type TapeFx = { time: number }
export type StutterFx = { rate: number }

export type FxSettings = {
  delay: DelayFx
  echo: DelayFx
  chorus: ChorusFx
  flanger: FlangerFx
  mover: MoverFx
  tremolo: TremoloFx
  distortion: DistortionFx
  shifter: ShifterFx
  cutoff: CutoffFx
  reverb: ReverbFx
  tape: TapeFx
  stutter: StutterFx
}

export const STUTTER_RATES = [
  { label: '1/32', beats: 0.125 },
  { label: '1/16', beats: 0.25 },
  { label: '1/8', beats: 0.5 },
  { label: '1/8.', beats: 0.75 },
  { label: '1 beat', beats: 1 },
  { label: '2 beats', beats: 2 },
  { label: '1 bar', beats: 4 },
] as const

export function stutterIndex(rate: number): number {
  const last = STUTTER_RATES.length - 1
  if (!Number.isFinite(rate)) return 0
  return Math.max(0, Math.min(last, Math.round(Math.max(0, Math.min(1, rate)) * last)))
}

export function stutterValue(index: number): number {
  const last = STUTTER_RATES.length - 1
  return Math.max(0, Math.min(last, Math.round(index))) / last
}

export function stutterBeats(rate: number): number {
  return STUTTER_RATES[stutterIndex(rate)]?.beats ?? 0
}

export function tapeSeconds(time: number, bpm = 120): number {
  return Math.min(1.2, syncSeconds(time, bpm))
}

export function reverbSeconds(size: number): number {
  return 0.4 + Math.max(0, Math.min(1, size)) * 3.6
}

export function bassCutoffHz(cutoff: number): number {
  return 140 + Math.max(0, Math.min(1, cutoff)) * 2200
}

export function chordCutoffHz(cutoff: number): number {
  return 400 + Math.max(0, Math.min(1, cutoff)) * 2800
}

export function fxLowCutHz(low: number): number {
  return 20 * 200 ** Math.max(0, Math.min(1, low))
}

export function fxHighCutHz(high: number): number {
  return 200 * 90 ** Math.max(0, Math.min(1, high))
}

export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return '—'
  if (hz >= 10000) return `${Math.round(hz / 1000)} kHz`
  if (hz >= 1000) return `${(hz / 1000).toFixed(1)} kHz`
  return `${Math.round(hz)} Hz`
}

export const SYNC_RATES = [
  { label: '1/16', beats: 0.25 },
  { label: '1/16.', beats: 0.375 },
  { label: '1/8', beats: 0.5 },
  { label: '1/8.', beats: 0.75 },
  { label: '1/4', beats: 1 },
  { label: '1/4.', beats: 1.5 },
  { label: '2 beats', beats: 2 },
  { label: '1/2.', beats: 3 },
  { label: '4 beats', beats: 4 },
  { label: '8 beats', beats: 8 },
] as const

export function syncIndex(rate: number): number {
  const last = SYNC_RATES.length - 1
  if (!Number.isFinite(rate)) return 0
  return Math.max(0, Math.min(last, Math.round(Math.max(0, Math.min(1, rate)) * last)))
}

export function syncValue(index: number): number {
  const last = SYNC_RATES.length - 1
  return Math.max(0, Math.min(last, Math.round(index))) / last
}

export function syncHz(rate: number, bpm: number): number {
  const beats = SYNC_RATES[syncIndex(rate)]?.beats ?? 1
  return Math.max(20, bpm) / 60 / beats
}

export function syncSeconds(rate: number, bpm: number): number {
  const beats = SYNC_RATES[syncIndex(rate)]?.beats ?? 1
  return beats * (60 / Math.max(20, bpm))
}

export function syncRateKey(effect: keyof FxSettings, key: string): boolean {
  return key === 'rate' && (effect === 'mover' || effect === 'tremolo' || effect === 'chorus' || effect === 'flanger')
}

export function syncTimeKey(effect: keyof FxSettings, key: string): boolean {
  return key === 'time' && (effect === 'delay' || effect === 'echo' || effect === 'tape')
}

export const DEFAULT_FX: FxSettings = {
  delay: { time: syncValue(4), feedback: 0.45, mix: 0.35 },
  echo: { time: syncValue(2), feedback: 0.3, mix: 0.4 },
  chorus: { rate: syncValue(2), depth: 0.55, mix: 0.4 },
  flanger: { rate: syncValue(3), depth: 0.6, feedback: 0.5, mix: 0.35 },
  mover: { rate: syncValue(6), depth: 0 },
  tremolo: { rate: syncValue(2), depth: 0 },
  distortion: { drive: 0, tone: 0.6, mix: 1 },
  shifter: { semi: 0.5, mix: 1 },
  cutoff: { low: 0, high: 1 },
  reverb: { size: 0, mix: 0.3 },
  tape: { time: syncValue(4) },
  stutter: { rate: stutterValue(6) },
}

export function copyFx(fx: FxSettings = DEFAULT_FX): FxSettings {
  return {
    delay: { ...fx.delay },
    echo: { ...fx.echo },
    chorus: { ...fx.chorus },
    flanger: { ...fx.flanger },
    mover: { ...fx.mover },
    tremolo: { ...fx.tremolo },
    distortion: { ...fx.distortion },
    shifter: { ...fx.shifter },
    cutoff: { ...fx.cutoff },
    reverb: { ...(fx.reverb ?? DEFAULT_FX.reverb) },
    tape: { ...(fx.tape ?? DEFAULT_FX.tape) },
    stutter: { ...(fx.stutter ?? DEFAULT_FX.stutter) },
  }
}

export type Rack = {
  level: number
  pan: number
  eq: { low: number; mid: number; high: number }
  fx: FxSettings
  inserts: InsertId[]
  off?: InsertId[]
  automation?: Record<string, (number | null)[]>
}

export function openRack(level = 1): Rack {
  return { level, pan: 0, eq: { low: 0, mid: 0, high: 0 }, fx: copyFx(), inserts: [] }
}

export function tuneRack(rack: Rack, effect: keyof FxSettings, key: string, value: number): Rack {
  if (!Number.isFinite(value)) return rack
  const current = rack.fx[effect] as Record<string, number>
  if (!(key in current)) return rack
  return { ...rack, fx: { ...rack.fx, [effect]: { ...current, [key]: clamp(value, 0, 1) } } }
}

export function copyRack(rack: Rack): Rack {
  return {
    level: rack.level,
    pan: rack.pan,
    eq: { ...rack.eq },
    fx: copyFx(rack.fx),
    inserts: rack.inserts.slice(),
    off: rack.off?.slice(),
    automation: copyAutomationMap(rack.automation),
  }
}

function copyAutomationMap(
  map: Record<string, (number | null)[]> | undefined,
): Record<string, (number | null)[]> | undefined {
  if (!map) return undefined
  return Object.fromEntries(Object.entries(map).map(([id, steps]) => [id, steps.slice()]))
}

function parseAutomationMap(value: unknown): Record<string, (number | null)[]> | undefined {
  if (!isRecord(value)) return undefined
  const next: Record<string, (number | null)[]> = {}
  for (const [id, steps] of Object.entries(value)) {
    if (!Array.isArray(steps)) continue
    next[id] = steps.map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : null))
  }
  return Object.keys(next).length > 0 ? next : undefined
}

function resizeAutomationMap(
  map: Record<string, (number | null)[]> | undefined,
  length: number,
): Record<string, (number | null)[]> | undefined {
  if (!map) return undefined
  const next: Record<string, (number | null)[]> = {}
  for (const [id, steps] of Object.entries(map)) {
    next[id] = Array.from({ length }, (_, index) => steps[index] ?? null)
  }
  return next
}

function copyAutomationBar(
  map: Record<string, (number | null)[]> | undefined,
  fromStart: number,
  targets: number[],
  count: number,
  length: number,
): Record<string, (number | null)[]> | undefined {
  if (!map) return undefined
  const next: Record<string, (number | null)[]> = {}
  for (const [id, steps] of Object.entries(map)) {
    const list = Array.from({ length }, (_, index) => steps[index] ?? null)
    const source = list.slice(fromStart, fromStart + count)
    for (const toStart of targets) {
      for (let index = 0; index < source.length; index += 1) {
        if (toStart + index < list.length) list[toStart + index] = source[index] ?? null
      }
    }
    next[id] = list
  }
  return next
}

function withResizedAutomation(rack: Rack | undefined, length: number): Rack | undefined {
  if (!rack) return rack
  return { ...rack, automation: resizeAutomationMap(rack.automation, length) }
}

export function rackFromInstrument(instrument: Instrument): Rack {
  const inserts = instrument.inserts.filter((insert) => insert !== 'adsr' && insert !== 'processing')
  return {
    level: instrument.mix.level,
    pan: instrument.mix.pan,
    eq: { ...instrument.mix.eq },
    fx: copyFx(instrument.fx),
    inserts,
    off: instrument.off?.filter((insert) => insert !== 'adsr' && insert !== 'processing'),
  }
}

export type LoopBars = 1 | 2 | 4 | 8

export const LOOP_BARS: LoopBars[] = [1, 2, 4, 8]

export function isLoopBars(value: unknown): value is LoopBars {
  return value === 1 || value === 2 || value === 4 || value === 8
}

export function loopSteps(meter: Meter, bars: LoopBars): number {
  return stepsForMeter(meter) * bars
}

export type Envelope = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export const DEFAULT_ENVELOPE: Envelope = { attack: 0.02, decay: 0.35, sustain: 0.45, release: 0.28 }

export type SectionSlot = {
  enabled: boolean
  patternId: string
  solo: boolean
  rack?: Rack
}

export type Section = {
  id: string
  name: string
  bpm: number
  key: string
  meter: Meter
  bars: LoopBars
  accent: boolean[]
  slots: Record<string, SectionSlot>
  bus?: Rack
  groups?: Record<string, Rack>
  customBpm?: boolean
  customKey?: boolean
  customMeter?: boolean
}

export type ArrangementNode = {
  id: string
  sectionId: string
  repeat: number
  nextId: string | null
}

export type Project = {
  version: 1
  name: string
  bpm: number
  swing: number
  accent: boolean[]
  accentAmount: number
  key: string
  meter: Meter
  master: number
  instruments: Instrument[]
  groups: InstrumentGroup[]
  sections: Section[]
  arrangement: ArrangementNode[]
  startNodeId: string
}

const DRUM_NAMES: Record<DrumId, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  hatClosed: 'Closed Hat',
  hatOpen: 'Open Hat',
  tom: 'Tom',
  lowTom: 'Low Tom',
  conga: 'Conga',
  rim: 'Rim',
  cowbell: 'Cowbell',
  clave: 'Clave',
  shaker: 'Shaker',
  cymbal: 'Cymbal',
}

const DRUM_LEVELS: Record<DrumId, number> = {
  kick: 0.9,
  snare: 0.62,
  clap: 0.55,
  hatClosed: 0.32,
  hatOpen: 0.34,
  tom: 0.7,
  lowTom: 0.72,
  conga: 0.5,
  rim: 0.45,
  cowbell: 0.4,
  clave: 0.42,
  shaker: 0.34,
  cymbal: 0.36,
}

const DEFAULT_HITS: Record<DrumId, number[]> = {
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  clap: [],
  hatClosed: [0, 2, 4, 6, 8, 10, 12],
  hatOpen: [14],
  tom: [],
  lowTom: [],
  conga: [],
  rim: [],
  cowbell: [],
  clave: [],
  shaker: [],
  cymbal: [],
}

const STEPS = 16

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isDrumId(value: string): value is DrumId {
  return (DRUM_IDS as readonly string[]).includes(value)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function stepsFromHits(hits: number[]): Step[] {
  return Array.from({ length: STEPS }, (_, index) => ({
    on: hits.includes(index),
    velocity: 0.9,
    degree: 0,
    quality: null,
  }))
}

function stepsFromDegrees(hits: { index: number; degree: number }[], velocity = 0.85): Step[] {
  return Array.from({ length: STEPS }, (_, index) => {
    const hit = hits.find((item) => item.index === index)
    return { on: hit !== undefined, velocity, degree: hit?.degree ?? 0, quality: null }
  })
}

const PARTS = ['intro', 'verse', 'drop'] as const

const BASS_LINE = [
  { index: 0, degree: 0 },
  { index: 4, degree: 0 },
  { index: 7, degree: 4 },
  { index: 8, degree: 0 },
  { index: 12, degree: 3 },
  { index: 14, degree: 0 },
]

const CHORD_LINE = [
  { index: 4, degree: 0 },
  { index: 6, degree: 1 },
  { index: 12, degree: 0 },
  { index: 14, degree: 3 },
]

function pattern(id: string, steps: Step[]): Pattern {
  return { id, length: STEPS, steps, notes: [] }
}

export function createDefaultProject(): Project {
  const drums: Instrument[] = DRUM_IDS.map((drum) => ({
    id: drum,
    name: DRUM_NAMES[drum],
    kind: 'drum',
    voice: { type: '808', kit: '808', drum, sound: { ...DEFAULT_SOUND } },
    patterns: PARTS.map((part) => pattern(`${drum}-${part}`, stepsFromHits(DEFAULT_HITS[drum]))),
    mix: {
      level: DRUM_LEVELS[drum],
      pan: 0,
      eq: { low: 0, mid: 0, high: 0 },
    },
    effects: [],
    fx: copyFx(),
    inserts: ['eq', 'processing'],
    envelope: { ...DEFAULT_ENVELOPE },
  }))
  const bass = createBassInstrument(PARTS.map((part) => (part === 'intro' ? [] : BASS_LINE)))
  const keys = createKeysInstrument(PARTS.map((part) => (part === 'drop' ? CHORD_LINE : [])))
  const instruments = [...drums, bass, keys]

  const sections: Section[] = PARTS.map((part, index) => ({
    id: `section-${part}`,
    name: index === 0 ? 'Part A' : index === 1 ? 'Part B' : 'Part C',
    bpm: 120,
    key: 'C',
    meter: '4/4',
    bars: 1,
    accent: Array.from({ length: STEPS }, () => false),
    slots: Object.fromEntries(
      instruments.map((instrument) => {
        const item = instrument.patterns[index]
        const enabled = instrument.id === 'bass' ? part !== 'intro' : instrument.id === 'keys' ? part === 'drop' : true
        return [instrument.id, { enabled, solo: false, patternId: item?.id ?? '' }]
      }),
    ),
  }))

  return {
    version: 1,
    name: 'Song',
    bpm: 120,
    swing: 0,
    accent: Array.from({ length: STEPS }, () => false),
    accentAmount: 0.7,
    key: 'C',
    meter: '4/4',
    master: 0.85,
    instruments,
    groups: [
      { id: 'drums', name: 'Drums', instrumentIds: drums.map((instrument) => instrument.id) },
      { id: 'bass', name: 'Bass', instrumentIds: ['bass'] },
      { id: 'keys', name: 'Melodic', instrumentIds: ['keys'] },
    ],
    sections,
    arrangement: [
      { id: 'node-intro', sectionId: 'section-intro', repeat: 2, nextId: 'node-verse' },
      { id: 'node-verse', sectionId: 'section-verse', repeat: 2, nextId: 'node-drop' },
      { id: 'node-drop', sectionId: 'section-drop', repeat: 4, nextId: 'node-intro' },
    ],
    startNodeId: 'node-intro',
  }
}

export function createBlankProject(): Project {
  const sectionId = 'section-start'
  const nodeId = 'node-start'
  const accent = Array.from({ length: STEPS }, () => false)
  return {
    version: 1,
    name: 'Song',
    bpm: 120,
    swing: 0,
    accent: accent.slice(),
    accentAmount: 0,
    key: 'C',
    meter: '4/4',
    master: 0.85,
    instruments: [],
    groups: [
      { id: 'group-drums', name: 'Drums', instrumentIds: [] },
      { id: 'group-bass', name: 'Bass', instrumentIds: [] },
      { id: 'group-melodic', name: 'Melodic', instrumentIds: [] },
    ],
    sections: [
      {
        id: sectionId,
        name: 'Part A',
        bpm: 120,
        key: 'C',
        meter: '4/4',
        bars: 1,
        accent,
        slots: {},
      },
    ],
    arrangement: [{ id: nodeId, sectionId, repeat: 1, nextId: nodeId }],
    startNodeId: nodeId,
  }
}

function createBassInstrument(lines: { index: number; degree: number }[][]): Instrument {
  return {
    id: 'bass',
    name: 'Bass',
    kind: 'melodic',
    voice: { type: 'bass', sound: { ...DEFAULT_BASS } },
    patterns: PARTS.map((part, index) => pattern(`bass-${part}`, stepsFromDegrees(lines[index] ?? []))),
    mix: { level: 0.55, pan: 0, eq: { low: 2, mid: 0, high: -2 } },
    effects: [],
    fx: copyFx(),
    inserts: ['eq', 'processing'],
    envelope: { ...DEFAULT_ENVELOPE },
  }
}

function createKeysInstrument(lines: { index: number; degree: number }[][]): Instrument {
  return {
    id: 'keys',
    name: 'Keys',
    kind: 'melodic',
    voice: { type: 'chord', sound: { ...DEFAULT_CHORD } },
    patterns: PARTS.map((part, index) => pattern(`keys-${part}`, stepsFromDegrees(lines[index] ?? [], 0.8))),
    mix: { level: 0.42, pan: 0, eq: { low: -2, mid: 1, high: 2 } },
    effects: [],
    fx: copyFx(),
    inserts: ['eq', 'processing'],
    envelope: { ...DEFAULT_ENVELOPE },
  }
}

export function startingSection(project: Project): Section | null {
  const node =
    project.arrangement.find((item) => item.id === project.startNodeId) ??
    project.arrangement[0]
  if (!node) return project.sections[0] ?? null
  return project.sections.find((item) => item.id === node.sectionId) ?? null
}

export function sectionById(project: Project, sectionId: string): Section | null {
  return project.sections.find((item) => item.id === sectionId) ?? startingSection(project)
}

export function rollNotes(project: Project, instrumentId: string, sectionId?: string): NoteEvent[] {
  const instrument = project.instruments.find((item) => item.id === instrumentId)
  const pattern = patternFor(project, instrumentId, sectionId)
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  if (!instrument || !pattern || !section) return []
  if (pattern.notes.length > 0) return pattern.notes
  if (instrument.voice.type === 'bass' || instrument.voice.type === 'lead') {
    return pattern.steps.flatMap((step, index) =>
      step.on
        ? [{ pitch: step.pitch ?? (bassMidi(section.key, step.degree) + (instrument.voice.type === 'lead' ? 12 : 0)), start: index, duration: 1, velocity: step.velocity }]
        : [],
    )
  }
  if (instrument.voice.type === 'chord') {
    return pattern.steps.flatMap((step, index) =>
      step.on
        ? (step.pitch != null ? [step.pitch] : chordMidis(section.key, step.degree, step.quality)).map((pitch) => ({
            pitch,
            start: index,
            duration: 1,
            velocity: step.velocity,
          }))
        : [],
    )
  }
  return []
}

export function setRollNotes(
  project: Project,
  instrumentId: string,
  notes: NoteEvent[],
  sectionId?: string,
): Project {
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  const patternId = section?.slots[instrumentId]?.patternId
  if (!section || !patternId) return project
  const length = patternFor(project, instrumentId, section.id)?.steps.length ?? 16
  const cleaned = notes
    .map((note) => ({
      pitch: clamp(Math.round(note.pitch), 0, 127),
      start: clamp(Math.round(note.start), 0, Math.max(0, length - 1)),
      duration: Math.max(1, Math.round(note.duration)),
      velocity: clamp(note.velocity, 0, 1.35),
    }))
    .map((note) => ({ ...note, duration: Math.min(note.duration, length - note.start) }))
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    patterns: instrument.patterns.map((item) =>
      item.id === patternId
        ? { ...item, notes: cleaned, steps: item.steps.map((step) => ({ ...step, on: false })) }
        : item,
    ),
  }))
}

export function patternFor(project: Project, instrumentId: string, sectionId?: string): Pattern | null {
  const instrument = project.instruments.find((item) => item.id === instrumentId)
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  if (!instrument || !section) return null
  const patternId = section.slots[instrumentId]?.patternId
  return (
    instrument.patterns.find((item) => item.id === patternId) ??
    instrument.patterns[0] ??
    null
  )
}

function mapInstrument(
  project: Project,
  instrumentId: string,
  update: (instrument: Instrument) => Instrument,
): Project {
  return {
    ...project,
    instruments: project.instruments.map((instrument) =>
      instrument.id === instrumentId ? update(instrument) : instrument,
    ),
  }
}

export function setStepPitch(
  project: Project,
  instrumentId: string,
  stepIndex: number,
  pitch: number,
  sectionId?: string,
): Project {
  if (!Number.isFinite(pitch)) return project
  const pattern = patternFor(project, instrumentId, sectionId)
  if (!pattern || !pattern.steps[stepIndex]) return project
  const midi = clamp(Math.round(pitch), 24, 96)
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    patterns: instrument.patterns.map((item) => {
      if (item.id !== pattern.id) return item
      const notes = item.notes.filter((n) => Math.round(n.start) !== stepIndex)
      const newNotes = item.notes.length > 0 ? [...notes, { pitch: midi, start: stepIndex, duration: 1, velocity: 0.9 }] : item.notes
      return {
        ...item,
        notes: newNotes,
        steps: item.steps.map((step, index) => (index === stepIndex ? { ...step, on: true, pitch: midi } : step)),
      }
    }),
  }))
}

export function setStep(
  project: Project,
  instrumentId: string,
  stepIndex: number,
  on: boolean,
  sectionId?: string,
): Project {
  const pattern = patternFor(project, instrumentId, sectionId)
  const current = pattern?.steps[stepIndex]
  if (!pattern || !current || current.on === on) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    patterns: instrument.patterns.map((item) => {
      if (item.id !== pattern.id) return item
      const notes = !on && item.notes.length > 0 ? item.notes.filter((n) => Math.round(n.start) !== stepIndex) : item.notes
      return {
        ...item,
        notes,
        steps: item.steps.map((step, index) => (index === stepIndex ? { ...step, on } : step)),
      }
    }),
  }))
}

export function setDegree(
  project: Project,
  instrumentId: string,
  stepIndex: number,
  degree: number,
  sectionId?: string,
): Project {
  const pattern = patternFor(project, instrumentId, sectionId)
  const current = pattern?.steps[stepIndex]
  if (!pattern || !current || !Number.isFinite(degree)) return project
  const next = clamp(Math.round(degree), 0, 11)
  if (current.degree === next) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    patterns: instrument.patterns.map((item) => {
      if (item.id !== pattern.id) return item
      return {
        ...item,
        steps: item.steps.map((step, index) => (index === stepIndex ? { ...step, degree: next } : step)),
      }
    }),
  }))
}

export function setChord(
  project: Project,
  instrumentId: string,
  stepIndex: number,
  degree: number,
  quality: ChordQuality,
  sectionId?: string,
): Project {
  const pattern = patternFor(project, instrumentId, sectionId)
  const current = pattern?.steps[stepIndex]
  if (!pattern || !current) return project
  const nextDegree = clamp(Math.round(degree), 0, 6)
  if (current.on && current.degree === nextDegree && current.quality === quality) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    patterns: instrument.patterns.map((item) => {
      if (item.id !== pattern.id) return item
      return {
        ...item,
        steps: item.steps.map((step, index) =>
          index === stepIndex ? { ...step, on: true, degree: nextDegree, quality } : step,
        ),
      }
    }),
  }))
}

export type RackScope = { kind: 'song' } | { kind: 'group'; groupId: string } | { kind: 'track'; instrumentId: string }

export function updateRack(project: Project, sectionId: string, scope: RackScope, update: (rack: Rack) => Rack): Project {
  const section = project.sections.find((item) => item.id === sectionId)
  if (!section) return project
  if (scope.kind === 'song') {
    return replaceSection(project, { ...section, bus: update(section.bus ?? openRack(1)) })
  }
  if (scope.kind === 'group') {
    const groups = section.groups ?? {}
    return replaceSection(project, {
      ...section,
      groups: { ...groups, [scope.groupId]: update(groups[scope.groupId] ?? openRack(1)) },
    })
  }
  const slot = section.slots[scope.instrumentId]
  if (!slot) return project
  const instrument = project.instruments.find((item) => item.id === scope.instrumentId)
  const current = slot.rack ?? (instrument ? rackFromInstrument(instrument) : openRack(0.75))
  return replaceSection(project, {
    ...section,
    slots: { ...section.slots, [scope.instrumentId]: { ...slot, rack: update(current) } },
  })
}

function replaceSection(project: Project, section: Section): Project {
  return { ...project, sections: project.sections.map((item) => (item.id === section.id ? section : item)) }
}

export function syncInsertToAllParts(
  project: Project,
  sourceSectionId: string,
  scope: RackScope,
  insert: InsertId,
): Project {
  const sourceSection = project.sections.find((item) => item.id === sourceSectionId)
  if (!sourceSection) return project

  const getRack = (section: Section): Rack => {
    if (scope.kind === 'song') return section.bus ?? openRack(1)
    if (scope.kind === 'group') return section.groups?.[scope.groupId] ?? openRack(1)
    const slot = section.slots[scope.instrumentId]
    const instrument = project.instruments.find((item) => item.id === scope.instrumentId)
    return slot?.rack ?? (instrument ? rackFromInstrument(instrument) : openRack(0.75))
  }

  const sourceRack = getRack(sourceSection)
  const isOff = sourceRack.off?.includes(insert) === true
  const fxSettings = sourceRack.fx[insert as keyof FxSettings]
  const eqSettings = sourceRack.eq

  return {
    ...project,
    sections: project.sections.map((section) => {
      const current = getRack(section)
      const hasInsert = current.inserts.includes(insert)
      const nextInserts = hasInsert ? current.inserts : [...current.inserts, insert]
      const nextOff = isOff
        ? (current.off?.includes(insert) ? current.off : [...(current.off ?? []), insert])
        : (current.off ?? []).filter((item) => item !== insert)

      let nextRack: Rack = {
        ...current,
        inserts: nextInserts,
        off: nextOff,
      }
      if (insert === 'eq') {
        nextRack = { ...nextRack, eq: { ...eqSettings } }
      } else if (fxSettings) {
        nextRack = {
          ...nextRack,
          fx: {
            ...nextRack.fx,
            [insert]: { ...fxSettings },
          },
        }
      }

      if (scope.kind === 'song') {
        return { ...section, bus: nextRack }
      }
      if (scope.kind === 'group') {
        return {
          ...section,
          groups: { ...(section.groups ?? {}), [scope.groupId]: nextRack },
        }
      }
      const slot = section.slots[scope.instrumentId]
      if (!slot) return section
      return {
        ...section,
        slots: {
          ...section.slots,
          [scope.instrumentId]: { ...slot, rack: nextRack },
        },
      }
    }),
  }
}

export function syncMixToAllParts(
  project: Project,
  sourceSectionId: string,
  scope: RackScope,
): Project {
  const sourceSection = project.sections.find((item) => item.id === sourceSectionId)
  if (!sourceSection) return project

  const getRack = (section: Section): Rack => {
    if (scope.kind === 'song') return section.bus ?? openRack(1)
    if (scope.kind === 'group') return section.groups?.[scope.groupId] ?? openRack(1)
    const slot = section.slots[scope.instrumentId]
    const instrument = project.instruments.find((item) => item.id === scope.instrumentId)
    return slot?.rack ?? (instrument ? rackFromInstrument(instrument) : openRack(0.75))
  }

  const sourceRack = getRack(sourceSection)
  const { level, pan } = sourceRack

  return {
    ...project,
    instruments:
      scope.kind === 'track'
        ? project.instruments.map((item) =>
            item.id === scope.instrumentId ? { ...item, mix: { ...item.mix, level, pan } } : item,
          )
        : project.instruments,
    sections: project.sections.map((section) => {
      const current = getRack(section)
      const nextRack: Rack = { ...current, level, pan }
      if (scope.kind === 'song') {
        return { ...section, bus: nextRack }
      }
      if (scope.kind === 'group') {
        return {
          ...section,
          groups: { ...(section.groups ?? {}), [scope.groupId]: nextRack },
        }
      }
      const slot = section.slots[scope.instrumentId]
      if (!slot) return section
      return {
        ...section,
        slots: {
          ...section.slots,
          [scope.instrumentId]: { ...slot, rack: nextRack },
        },
      }
    }),
  }
}

export function addInsertToAllParts(
  project: Project,
  sourceSectionId: string,
  scope: RackScope,
  insert: InsertId,
): Project {
  const withSource = updateRack(project, sourceSectionId, scope, (rack) => {
    if (rack.inserts.includes(insert)) return rack
    if (insert === 'eq' || insert === 'adsr' || insert === 'processing') {
      return { ...rack, inserts: [...rack.inserts, insert] }
    }
    const effect = insert
    return {
      ...rack,
      inserts: [...rack.inserts, effect],
      fx: { ...rack.fx, [effect]: { ...DEFAULT_FX[effect] } },
    }
  })
  return syncInsertToAllParts(withSource, sourceSectionId, scope, insert)
}

export function setLevel(project: Project, instrumentId: string, level: number): Project {
  if (!Number.isFinite(level)) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    mix: { ...instrument.mix, level: clampGain(level) },
  }))
}

export function setPan(project: Project, instrumentId: string, pan: number): Project {
  if (!Number.isFinite(pan)) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    mix: { ...instrument.mix, pan: clamp(pan, -1, 1) },
  }))
}

export function setEq(
  project: Project,
  instrumentId: string,
  band: 'low' | 'mid' | 'high',
  value: number,
): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    mix: {
      ...instrument.mix,
      eq: { ...instrument.mix.eq, [band]: clamp(value, -24, 24) },
    },
  }))
}

export function setSound(
  project: Project,
  instrumentId: string,
  key: keyof SoundParams,
  value: number,
): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.voice.type !== '808') return instrument
    return {
      ...instrument,
      voice: {
        ...instrument.voice,
        sound: { ...instrument.voice.sound, [key]: clamp(value, 0, 1) },
      },
    }
  })
}

export function setBassSound(
  project: Project,
  instrumentId: string,
  key: 'cutoff' | 'decay' | 'glide',
  value: number,
): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.voice.type !== 'bass' && instrument.voice.type !== 'lead') return instrument
    return {
      ...instrument,
      voice: { type: instrument.voice.type, sound: { ...instrument.voice.sound, [key]: clamp(value, 0, 1) } },
    }
  })
}

export function setWave(project: Project, instrumentId: string, wave: Wave): Project {
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.voice.type === 'bass' || instrument.voice.type === 'lead') {
      return { ...instrument, voice: { type: instrument.voice.type, sound: { ...instrument.voice.sound, wave } } }
    }
    if (instrument.voice.type === 'chord') {
      return { ...instrument, voice: { type: 'chord', sound: { ...instrument.voice.sound, wave } } }
    }
    return instrument
  })
}

export function setFx(
  project: Project,
  instrumentId: string,
  effect: keyof FxSettings,
  key: string,
  value: number,
): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => {
    const current = instrument.fx[effect]
    if (!(key in current)) return instrument
    return {
      ...instrument,
      fx: { ...instrument.fx, [effect]: { ...current, [key]: clamp(value, 0, 1) } },
    }
  })
}

export function setChordSound(project: Project, instrumentId: string, key: 'cutoff' | 'decay', value: number): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.voice.type !== 'chord') return instrument
    return { ...instrument, voice: { type: 'chord', sound: { ...instrument.voice.sound, [key]: clamp(value, 0, 1) } } }
  })
}

export function setProjectBpm(project: Project, bpm: number): Project {
  if (!Number.isFinite(bpm)) return project
  const next = clamp(Math.round(bpm), 40, 200)
  return {
    ...project,
    bpm: next,
    sections: project.sections.map((section) =>
      section.customBpm ? section : { ...section, bpm: next },
    ),
  }
}

export const setBpm = setProjectBpm

export function setSwing(project: Project, swing: number): Project {
  if (!Number.isFinite(swing)) return project
  const next = clamp(swing, 0, 1)
  if (next === project.swing) return project
  return { ...project, swing: next }
}

export function setAccentStep(project: Project, stepIndex: number, on: boolean, sectionId?: string): Project {
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  if (!section || stepIndex < 0 || stepIndex >= section.accent.length || section.accent[stepIndex] === on) return project
  const accent = section.accent.slice()
  accent[stepIndex] = on
  return {
    ...project,
    sections: project.sections.map((item) => (item.id === section.id ? { ...item, accent } : item)),
  }
}

export function setAccentAmount(project: Project, amount: number): Project {
  if (!Number.isFinite(amount)) return project
  const next = clamp(amount, 0, 1)
  if (next === project.accentAmount) return project
  return { ...project, accentAmount: next }
}

export function slotEnabled(project: Project, instrumentId: string, sectionId?: string): boolean {
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  return section?.slots[instrumentId]?.enabled !== false
}

export function setMuted(project: Project, instrumentId: string, muted: boolean, sectionId?: string): Project {
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  const slot = section?.slots[instrumentId]
  if (!section || !slot || slot.enabled === !muted) return project
  return {
    ...project,
    sections: project.sections.map((item) => {
      if (item.id !== section.id) return item
      return {
        ...item,
        slots: { ...item.slots, [instrumentId]: { ...slot, enabled: !muted } },
      }
    }),
  }
}

function parseStep(value: unknown): Step | null {
  if (!isRecord(value) || typeof value.on !== 'boolean' || typeof value.velocity !== 'number') {
    return null
  }
  if (!Number.isFinite(value.velocity)) return null
  const degree = typeof value.degree === 'number' && Number.isFinite(value.degree) ? clamp(Math.round(value.degree), 0, 11) : 0
  const quality = value.quality === 'triad' || value.quality === '6' || value.quality === '7' || value.quality === 'maj7' ? value.quality : null
  const pitch = typeof value.pitch === 'number' && Number.isFinite(value.pitch) ? clamp(Math.round(value.pitch), 0, 127) : null
  return { on: value.on, velocity: clamp(value.velocity, 0, 1), degree, quality, pitch }
}

function parseNote(value: unknown): NoteEvent | null {
  if (!isRecord(value)) return null
  const { pitch, start, duration, velocity } = value
  if (
    typeof pitch !== 'number' ||
    typeof start !== 'number' ||
    typeof duration !== 'number' ||
    typeof velocity !== 'number'
  ) {
    return null
  }
  if (![pitch, start, duration, velocity].every(Number.isFinite)) return null
  return {
    pitch: Math.round(pitch),
    start,
    duration: Math.max(0, duration),
    velocity: clamp(velocity, 0, 1),
  }
}

function parsePattern(value: unknown): Pattern | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !Array.isArray(value.steps)) return null
  if (value.steps.length < 1 || value.steps.length > 160) return null
  const steps = value.steps.map(parseStep)
  if (steps.some((step) => step === null)) return null
  const notes = Array.isArray(value.notes) ? value.notes.map(parseNote) : null
  if (!notes || notes.some((note) => note === null)) return null
  return {
    id: value.id,
    length: steps.length,
    steps: steps as Step[],
    notes: notes as NoteEvent[],
  }
}

function parseMix(value: unknown): Mix | null {
  if (!isRecord(value) || !isRecord(value.eq)) return null
  const { level, pan } = value
  const { low, mid, high } = value.eq
  if ([level, pan, low, mid, high].some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    return null
  }
  return {
    level: clampGain(level as number),
    pan: clamp(pan as number, -1, 1),
    eq: {
      low: clamp(low as number, -24, 24),
      mid: clamp(mid as number, -24, 24),
      high: clamp(high as number, -24, 24),
    },
  }
}

function parseEffect(value: unknown): EffectSlot | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null
  if (value.type !== 'delay' && value.type !== 'chorus' && value.type !== 'reverb' && value.type !== 'flanger') {
    return null
  }
  if (!isRecord(value.params)) return null
  const params: Record<string, number> = {}
  for (const [key, param] of Object.entries(value.params)) {
    if (typeof param !== 'number' || !Number.isFinite(param)) return null
    params[key] = param
  }
  return { id: value.id, type: value.type, params }
}

function parseVoice(value: unknown): VoiceParams | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  if (value.type === 'bass') return { type: 'bass', sound: parseBass(value.sound) }
  if (value.type === 'lead') return { type: 'lead', sound: parseBass(value.sound, DEFAULT_LEAD) }
  if (value.type === 'chord') return { type: 'chord', sound: parseChord(value.sound) }
  if (value.type !== '808' || typeof value.drum !== 'string' || !isDrumId(value.drum)) return null
  const kit: DrumKit = value.kit === '909' || value.kit === 'rock' ? value.kit : '808'
  return { type: '808', kit, drum: value.drum, sound: parseSound(value.sound) }
}

function unit(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : fallback
}

function parseBass(value: unknown, fallback: BassSound = DEFAULT_BASS): BassSound {
  if (!isRecord(value)) return { ...fallback }
  return {
    cutoff: unit(value.cutoff, fallback.cutoff),
    decay: unit(value.decay, fallback.decay),
    glide: unit(value.glide, fallback.glide),
    wave: isWave(value.wave) ? value.wave : fallback.wave,
  }
}

function parseChord(value: unknown, fallback: ChordSound = DEFAULT_CHORD): ChordSound {
  if (!isRecord(value)) return { ...fallback }
  return {
    cutoff: unit(value.cutoff, fallback.cutoff),
    decay: unit(value.decay, fallback.decay),
    wave: isWave(value.wave) ? value.wave : fallback.wave,
  }
}

function parseFx(value: unknown): FxSettings {
  const base = copyFx()
  if (!isRecord(value)) return base
  const delay = isRecord(value.delay) ? value.delay : {}
  const echo = isRecord(value.echo) ? value.echo : {}
  const chorus = isRecord(value.chorus) ? value.chorus : {}
  const flanger = isRecord(value.flanger) ? value.flanger : {}
  return {
    delay: {
      time: unit(delay.time, base.delay.time),
      feedback: unit(delay.feedback, base.delay.feedback),
      mix: unit(delay.mix, base.delay.mix),
    },
    echo: {
      time: unit(echo.time, base.echo.time),
      feedback: unit(echo.feedback, base.echo.feedback),
      mix: unit(echo.mix, base.echo.mix),
    },
    chorus: {
      rate: unit(chorus.rate, base.chorus.rate),
      depth: unit(chorus.depth, base.chorus.depth),
      mix: unit(chorus.mix, base.chorus.mix),
    },
    flanger: {
      rate: unit(flanger.rate, base.flanger.rate),
      depth: unit(flanger.depth, base.flanger.depth),
      feedback: unit(flanger.feedback, base.flanger.feedback),
      mix: unit(flanger.mix, base.flanger.mix),
    },
    mover: readPair(value.mover, base.mover),
    tremolo: readPair(value.tremolo, base.tremolo),
    distortion: {
      drive: unit(isRecord(value.distortion) ? value.distortion.drive : undefined, base.distortion.drive),
      tone: unit(isRecord(value.distortion) ? value.distortion.tone : undefined, base.distortion.tone),
      mix: unit(isRecord(value.distortion) ? value.distortion.mix : undefined, base.distortion.mix),
    },
    shifter: {
      semi: unit(isRecord(value.shifter) ? value.shifter.semi : undefined, base.shifter.semi),
      mix: unit(isRecord(value.shifter) ? value.shifter.mix : undefined, base.shifter.mix),
    },
    cutoff: {
      low: unit(isRecord(value.cutoff) ? value.cutoff.low : undefined, base.cutoff.low),
      high: unit(isRecord(value.cutoff) ? value.cutoff.high : undefined, base.cutoff.high),
    },
    reverb: {
      size: unit(isRecord(value.reverb) ? value.reverb.size : undefined, base.reverb.size),
      mix: unit(isRecord(value.reverb) ? value.reverb.mix : undefined, base.reverb.mix),
    },
    tape: { time: unit(isRecord(value.tape) ? value.tape.time : undefined, base.tape.time) },
    stutter: { rate: unit(isRecord(value.stutter) ? value.stutter.rate : undefined, base.stutter.rate) },
  }
}

function readPair(value: unknown, fallback: { rate: number; depth: number }): { rate: number; depth: number } {
  if (!isRecord(value)) return { ...fallback }
  return { rate: unit(value.rate, fallback.rate), depth: unit(value.depth, fallback.depth) }
}

function parseInstrument(value: unknown): Instrument | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (value.kind !== 'drum' && value.kind !== 'melodic') return null
  const voice = parseVoice(value.voice)
  if (!voice) return null
  if (!Array.isArray(value.patterns) || value.patterns.length === 0) return null
  const patterns = value.patterns.map(parsePattern)
  if (patterns.some((item) => item === null)) return null
  const mix = parseMix(value.mix)
  if (!mix) return null
  const effects = Array.isArray(value.effects) ? value.effects.map(parseEffect) : null
  if (!effects || effects.some((effect) => effect === null)) return null
  const color = parseColor(value.color)
  return {
    id: value.id,
    name: value.name,
    kind: value.kind,
    voice,
    ...(color ? { color } : {}),
    patterns: patterns as Pattern[],
    mix,
    effects: effects as EffectSlot[],
    fx: parseFx(value.fx),
    inserts: parseInserts(value.inserts),
    off: parseOff(value.off),
    envelope: parseEnvelope(value.envelope),
  }
}

function parseColor(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const hex = value.trim().toLowerCase()
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : undefined
}

function parseInserts(value: unknown): InsertId[] {
  if (!Array.isArray(value)) return ['eq', 'processing']
  const next: InsertId[] = []
  for (const item of value) {
    if (INSERT_IDS.includes(item) && !next.includes(item)) next.push(item)
  }
  return next
}

function parseOff(value: unknown): InsertId[] | undefined {
  if (!Array.isArray(value)) return undefined
  const next = value.filter((item): item is InsertId => INSERT_IDS.includes(item))
  return next.length > 0 ? next : undefined
}

function parseEnvelope(value: unknown): Envelope {
  if (!isRecord(value)) return { ...DEFAULT_ENVELOPE }
  const read = (key: keyof Envelope) => {
    const item = value[key]
    return typeof item === 'number' && Number.isFinite(item) ? clamp(item, 0, 1) : DEFAULT_ENVELOPE[key]
  }
  return { attack: read('attack'), decay: read('decay'), sustain: read('sustain'), release: read('release') }
}

function isMeter(value: unknown): value is Meter {
  return value === '3/4' || value === '6/8' || value === '4/4' || value === '5/4'
}

function resizeFlags(source: boolean[], length: number): boolean[] {
  return Array.from({ length }, (_, index) => source[index] === true)
}

function parseSection(value: unknown, bpm: number, key: string, songMeter: Meter, accent: boolean[]): Section | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (!isRecord(value.slots)) return null
  const slots: Record<string, SectionSlot> = {}
  for (const [instrumentId, slot] of Object.entries(value.slots)) {
    if (!isRecord(slot) || typeof slot.enabled !== 'boolean' || typeof slot.patternId !== 'string') return null
    slots[instrumentId] = {
      enabled: slot.enabled,
      patternId: slot.patternId,
      solo: slot.solo === true,
      rack: isRecord(slot.rack) ? parseRack(slot.rack) : undefined,
    }
  }
  const meter = isMeter(value.meter) ? value.meter : songMeter
  const bars = isLoopBars(value.bars) ? value.bars : 1
  const sectionBpm = typeof value.bpm === 'number' && Number.isFinite(value.bpm) ? clamp(Math.round(value.bpm), 40, 200) : bpm
  const sectionKey = typeof value.key === 'string' && value.key.length > 0 ? value.key : key
  const sectionAccent = Array.isArray(value.accent) ? value.accent.map((item) => item === true) : accent
  const customBpm = value.customBpm === true || (value.customBpm === undefined && typeof value.bpm === 'number' && sectionBpm !== bpm)
  const customKey = value.customKey === true || (value.customKey === undefined && typeof value.key === 'string' && sectionKey !== key)
  const customMeter = value.customMeter === true || (value.customMeter === undefined && isMeter(value.meter) && meter !== songMeter)
  return {
    id: value.id,
    name: value.name,
    bpm: sectionBpm,
    key: sectionKey,
    meter,
    bars,
    accent: resizeFlags(sectionAccent, loopSteps(meter, bars)),
    slots,
    bus: isRecord(value.bus) ? parseRack(value.bus) : undefined,
    groups: parseGroupRacks(value.groups),
    customBpm,
    customKey,
    customMeter,
  }
}

function parseRack(value: Record<string, unknown>): Rack {
  const base = openRack(1)
  const eq = isRecord(value.eq) ? value.eq : {}
  return {
    level: typeof value.level === 'number' && Number.isFinite(value.level) ? clampGain(value.level) : base.level,
    pan: typeof value.pan === 'number' && Number.isFinite(value.pan) ? clamp(value.pan, -1, 1) : 0,
    eq: {
      low: typeof eq.low === 'number' ? clamp(eq.low, -24, 24) : 0,
      mid: typeof eq.mid === 'number' ? clamp(eq.mid, -24, 24) : 0,
      high: typeof eq.high === 'number' ? clamp(eq.high, -24, 24) : 0,
    },
    fx: parseFx(value.fx),
    inserts: parseInserts(value.inserts).filter((insert) => insert !== 'adsr' && insert !== 'processing'),
    off: parseOff(value.off),
    automation: parseAutomationMap(value.automation),
  }
}

function parseGroupRacks(value: unknown): Record<string, Rack> | undefined {
  if (!isRecord(value)) return undefined
  const groups: Record<string, Rack> = {}
  for (const [id, rack] of Object.entries(value)) {
    if (isRecord(rack)) groups[id] = parseRack(rack)
  }
  return groups
}

function parseNode(value: unknown): ArrangementNode | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.sectionId !== 'string') return null
  if (typeof value.repeat !== 'number' || !Number.isFinite(value.repeat)) return null
  if (value.nextId !== null && typeof value.nextId !== 'string') return null
  return {
    id: value.id,
    sectionId: value.sectionId,
    repeat: Math.max(1, Math.round(value.repeat)),
    nextId: value.nextId,
  }
}

function parseSound(value: unknown): SoundParams {
  if (!isRecord(value)) return { ...DEFAULT_SOUND }
  const read = (key: keyof SoundParams) => {
    const item = value[key]
    return typeof item === 'number' && Number.isFinite(item) ? clamp(item, 0, 1) : DEFAULT_SOUND[key]
  }
  return { decay: read('decay'), tone: read('tone'), snap: read('snap') }
}

function parseAccent(value: unknown): boolean[] {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: STEPS }, (_, index) => source[index] === true)
}

function parseAccentAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : 0.7
}

function drumsGroup(instruments: Instrument[]): InstrumentGroup {
  return {
    id: 'drums',
    name: 'Drums',
    instrumentIds: instruments.filter((instrument) => instrument.kind === 'drum').map((instrument) => instrument.id),
  }
}

function parseGroup(value: unknown, instruments: Instrument[]): InstrumentGroup | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return null
  if (!Array.isArray(value.instrumentIds)) return null
  const known = new Set(instruments.map((instrument) => instrument.id))
  const instrumentIds = value.instrumentIds.filter((id): id is string => typeof id === 'string' && known.has(id))
  return { id: value.id, name: value.name, instrumentIds }
}

function parseGroups(value: unknown, instruments: Instrument[]): InstrumentGroup[] {
  if (!Array.isArray(value) || value.length === 0) {
    return ensureHomeGroups(instruments.length === 0 ? [] : [drumsGroup(instruments)])
  }
  const groups = value.map((item) => parseGroup(item, instruments)).filter((item) => item !== null)
  return ensureHomeGroups(groups.length > 0 ? groups : [drumsGroup(instruments)])
}

const HOME_GROUPS = ['Drums', 'Bass', 'Melodic'] as const

function ensureHomeGroups(groups: InstrumentGroup[]): InstrumentGroup[] {
  const next = groups.slice()
  for (const name of HOME_GROUPS) {
    if (next.some((group) => group.name.toLowerCase() === name.toLowerCase())) continue
    const baseId = `group-${name.toLowerCase()}`
    const id = next.some((group) => group.id === baseId) ? `${baseId}-${stamp()}` : baseId
    next.push({ id, name, instrumentIds: [] })
  }
  return next
    .map((group, index) => ({ group, index }))
    .sort((a, b) => homeRank(a.group.name) - homeRank(b.group.name) || a.index - b.index)
    .map((item) => item.group)
}

function homeRank(name: string): number {
  const index = HOME_GROUPS.findIndex((item) => item.toLowerCase() === name.toLowerCase())
  return index === -1 ? HOME_GROUPS.length : index
}

export function parseProject(value: unknown): Project | null {
  if (!isRecord(value) || value.version !== 1) return null
  if (typeof value.bpm !== 'number' || typeof value.swing !== 'number' || typeof value.key !== 'string') return null
  if (!Number.isFinite(value.bpm) || !Number.isFinite(value.swing)) return null
  if (!Array.isArray(value.instruments) || !Array.isArray(value.sections) || !Array.isArray(value.arrangement)) {
    return null
  }
  if (typeof value.startNodeId !== 'string') return null
  const instruments = value.instruments.map(parseInstrument)
  const accent = parseAccent(value.accent)
  const bpm = clamp(value.bpm, 40, 200)
  if (typeof value.key !== 'string') return null
  const songKey = value.key
  const meter: Meter = isMeter(value.meter)
    ? value.meter
    : Array.isArray(value.sections) && isRecord(value.sections[0]) && isMeter(value.sections[0].meter)
      ? value.sections[0].meter
      : '4/4'
  const sections = value.sections.map((item) => parseSection(item, bpm, songKey, meter, accent))
  const arrangement = value.arrangement.map(parseNode)
  if (instruments.some((item) => item === null)) return null
  const parsedInstruments = instruments as Instrument[]
  if (
    sections.length === 0 ||
    arrangement.length === 0 ||
    sections.some((item) => item === null) ||
    arrangement.some((item) => item === null)
  ) {
    return null
  }
  return ensureRacks(ensureMusic({
    version: 1,
    name: songName(value.name),
    bpm,
    swing: clamp(value.swing, 0, 1),
    accent,
    accentAmount: parseAccentAmount(value.accentAmount),
    key: value.key,
    meter,
    master: typeof value.master === 'number' && Number.isFinite(value.master) ? clampGain(value.master) : 0.85,
    instruments: parsedInstruments,
    groups: parseGroups(value.groups, parsedInstruments),
    sections: sections as Section[],
    arrangement: arrangement as ArrangementNode[],
    startNodeId: value.startNodeId,
  }))
}

function ensureRacks(project: Project): Project {
  return {
    ...project,
    sections: project.sections.map((section) => ({
      ...section,
      bus: section.bus ? copyRack(section.bus) : openRack(1),
      groups: Object.fromEntries(Object.entries(section.groups ?? {}).map(([id, rack]) => [id, copyRack(rack)])),
      slots: Object.fromEntries(
        Object.entries(section.slots).map(([id, slot]) => {
          if (slot.rack) return [id, { ...slot, rack: copyRack(slot.rack) }]
          const instrument = project.instruments.find((item) => item.id === id)
          return [id, { ...slot, rack: instrument ? rackFromInstrument(instrument) : openRack(0.75) }]
        }),
      ),
    })),
  }
}

function ensureMusic(project: Project): Project {
  if (project.instruments.length === 0) return project
  return expandSingleLoop(project)
}

function expandSingleLoop(project: Project): Project {
  const node = project.arrangement[0]
  if (!node || project.arrangement.length !== 1 || node.nextId !== node.id) return project
  const intro = project.sections.find((item) => item.id === node.sectionId)
  if (!intro) return project
  const instruments = project.instruments.map((instrument) => {
    const currentId = intro.slots[instrument.id]?.patternId
    const current = instrument.patterns.find((item) => item.id === currentId) ?? instrument.patterns[0]
    const base = current ? current.steps.map((step) => ({ ...step })) : stepsFromHits([])
    const verseSteps = instrument.id === 'bass' ? stepsFromDegrees(BASS_LINE) : instrument.id === 'keys' ? stepsFromDegrees([]) : base
    const dropSteps = instrument.id === 'bass' ? stepsFromDegrees(BASS_LINE) : instrument.id === 'keys' ? stepsFromDegrees(CHORD_LINE) : base.map((step) => ({ ...step }))
    return {
      ...instrument,
      patterns: [
        ...instrument.patterns,
        pattern(`${instrument.id}-verse`, verseSteps),
        pattern(`${instrument.id}-drop`, dropSteps),
      ],
    }
  })
  const slotsFor = (part: 'verse' | 'drop'): Section['slots'] =>
    Object.fromEntries(
      instruments.map((instrument) => [
        instrument.id,
        {
          enabled: instrument.id === 'keys' ? part === 'drop' : instrument.id === 'bass' ? true : intro.slots[instrument.id]?.enabled !== false,
          solo: false,
          patternId: `${instrument.id}-${part}`,
        },
      ]),
    )
  const introSlots = { ...intro.slots }
  if (introSlots.bass) introSlots.bass = { ...introSlots.bass, enabled: false }
  if (introSlots.keys) introSlots.keys = { ...introSlots.keys, enabled: false }
  return {
    ...project,
    instruments,
    sections: [
      { ...intro, slots: introSlots },
      { id: 'section-verse', name: 'Verse', bpm: intro.bpm, key: intro.key, meter: intro.meter, bars: intro.bars, accent: intro.accent.slice(), slots: slotsFor('verse') },
      { id: 'section-drop', name: 'Drop', bpm: intro.bpm, key: intro.key, meter: intro.meter, bars: intro.bars, accent: intro.accent.slice(), slots: slotsFor('drop') },
    ],
    arrangement: [
      { ...node, repeat: Math.max(node.repeat, 1), nextId: 'node-verse' },
      { id: 'node-verse', sectionId: 'section-verse', repeat: 2, nextId: 'node-drop' },
      { id: 'node-drop', sectionId: 'section-drop', repeat: 4, nextId: node.id },
    ],
  }
}

export function songOrder(project: Project): ArrangementNode[] {
  const byId = new Map(project.arrangement.map((node) => [node.id, node]))
  const order: ArrangementNode[] = []
  const seen = new Set<string>()
  let id: string | null = project.startNodeId
  while (id && !seen.has(id)) {
    const node = byId.get(id)
    if (!node) break
    seen.add(node.id)
    order.push(node)
    id = node.nextId
  }
  for (const node of project.arrangement) {
    if (!seen.has(node.id)) order.push(node)
  }
  return order
}

function chainStops(project: Project): boolean {
  const seen = new Set<string>()
  let id: string | null = project.startNodeId
  let last: ArrangementNode | null = null
  const byId = new Map(project.arrangement.map((node) => [node.id, node]))
  while (id && !seen.has(id)) {
    const node = byId.get(id)
    if (!node) break
    seen.add(node.id)
    last = node
    id = node.nextId
  }
  return last?.nextId == null
}

function linkSong(project: Project, order: ArrangementNode[], stopAtEnd: boolean): Project {
  if (order.length === 0) return project
  const arrangement = order.map((node, index) => {
    const last = index === order.length - 1
    const nextId = last ? (stopAtEnd ? null : order[0].id) : order[index + 1].id
    return { ...node, nextId }
  })
  return { ...project, arrangement, startNodeId: arrangement[0].id }
}

export function removePart(project: Project, nodeId: string): Project {
  const order = songOrder(project)
  if (order.length <= 1) return project
  const node = order.find((item) => item.id === nodeId)
  if (!node) return project
  const remaining = order.filter((item) => item.id !== nodeId)
  const removed = linkSong(
    { ...project, arrangement: project.arrangement.filter((item) => item.id !== nodeId) },
    remaining,
    chainStops(project),
  )
  if (remaining.some((item) => item.sectionId === node.sectionId)) return removed
  const section = project.sections.find((item) => item.id === node.sectionId)
  const patternIds = new Set(Object.values(section?.slots ?? {}).map((slot) => slot.patternId))
  return {
    ...removed,
    sections: removed.sections.filter((item) => item.id !== node.sectionId),
    instruments: removed.instruments.map((instrument) => ({
      ...instrument,
      patterns: instrument.patterns.filter((item) => !patternIds.has(item.id)),
    })),
  }
}

export function reorderPart(project: Project, nodeId: string, toIndex: number): Project {
  const order = songOrder(project)
  const fromIndex = order.findIndex((node) => node.id === nodeId)
  if (fromIndex < 0) return project
  const target = clamp(Math.round(toIndex), 0, order.length - 1)
  if (fromIndex === target) return project
  const next = order.slice()
  const [moved] = next.splice(fromIndex, 1)
  if (!moved) return project
  next.splice(target, 0, moved)
  return linkSong(project, next, chainStops(project))
}

export function addPartInSong(project: Project, afterNodeId: string): { project: Project; nodeId: string } {
  const added = addPart(project, afterNodeId)
  const created = added.project.arrangement.find((node) => node.id === added.nodeId)
  if (!created) return added
  const order = songOrder(added.project).filter((node) => node.id !== created.id)
  const afterIndex = order.findIndex((node) => node.id === afterNodeId)
  const insertAt = afterIndex < 0 ? order.length : afterIndex + 1
  order.splice(insertAt, 0, created)
  return { nodeId: added.nodeId, project: linkSong(added.project, order, chainStops(project)) }
}

export function setRepeat(project: Project, nodeId: string, repeat: number): Project {
  if (!Number.isFinite(repeat)) return project
  const next = clamp(Math.round(repeat), 1, 64)
  return {
    ...project,
    arrangement: project.arrangement.map((node) => (node.id === nodeId ? { ...node, repeat: next } : node)),
  }
}

export function setNext(project: Project, nodeId: string, nextId: string | null): Project {
  if (nextId !== null && !project.arrangement.some((node) => node.id === nextId)) return project
  return {
    ...project,
    arrangement: project.arrangement.map((node) => (node.id === nodeId ? { ...node, nextId } : node)),
  }
}

export function nextPartName(project: Project): string {
  const names = project.sections.map((s) => s.name.trim())
  const hasPartPrefix = names.some((n) => /^Part\s+[A-Z]$/i.test(n))
  const hasSingleLetter = names.some((n) => /^[A-Z]$/i.test(n))
  const prefix = hasSingleLetter && !hasPartPrefix ? '' : 'Part '

  let maxCode = -1
  for (const name of names) {
    const match = name.match(/^(?:Part\s+)?([A-Z])$/i)
    if (match) {
      const code = match[1].toUpperCase().charCodeAt(0) - 65
      if (code > maxCode) maxCode = code
    }
  }

  if (maxCode >= 0 && maxCode < 25) {
    return `${prefix}${String.fromCharCode(65 + maxCode + 1)}`
  }
  if (maxCode < 0) {
    return `${prefix}A`
  }
  return `${prefix}${project.sections.length + 1}`
}

export function addPart(project: Project, sourceNodeId: string): { project: Project; nodeId: string } {
  const source = project.arrangement.find((node) => node.id === sourceNodeId) ?? project.arrangement[0]
  const sourceSection = source ? project.sections.find((item) => item.id === source.sectionId) : project.sections[0]
  const stamp = Math.random().toString(36).slice(2, 8)
  const sectionId = `section-${stamp}`
  const nodeId = `node-${stamp}`
  const slots: Section['slots'] = {}
  const instruments = project.instruments.map((instrument) => {
    const currentId = sourceSection?.slots[instrument.id]?.patternId
    const current = instrument.patterns.find((item) => item.id === currentId) ?? instrument.patterns[0]
    const steps = current ? current.steps.map((step) => ({ ...step })) : stepsFromHits([])
    const copy: Pattern = {
      ...pattern(`${instrument.id}-${stamp}`, steps),
      length: steps.length,
      notes: (current?.notes ?? []).map((note) => ({ ...note })),
    }
    const sourceSlot = sourceSection?.slots[instrument.id]
    slots[instrument.id] = {
      enabled: sourceSlot?.enabled !== false,
      solo: sourceSlot?.solo === true,
      patternId: copy.id,
      rack: sourceSlot?.rack ? copyRack(sourceSlot.rack) : openRack(instrument.mix.level),
    }
    return { ...instrument, patterns: [...instrument.patterns, copy] }
  })
  return {
    nodeId,
    project: {
      ...project,
      instruments,
      sections: [
        ...project.sections,
        {
          id: sectionId,
          name: nextPartName(project),
          bpm: sourceSection?.bpm ?? project.bpm,
          key: sourceSection?.key ?? project.key,
          meter: sourceSection?.meter ?? project.meter,
          bars: sourceSection?.bars ?? 1,
          accent: (sourceSection?.accent ?? project.accent).slice(),
          slots,
          bus: sourceSection?.bus ? copyRack(sourceSection.bus) : openRack(1),
          groups: Object.fromEntries(Object.entries(sourceSection?.groups ?? {}).map(([id, rack]) => [id, copyRack(rack)])),
          customBpm: sourceSection?.customBpm,
          customKey: sourceSection?.customKey,
          customMeter: sourceSection?.customMeter,
        },
      ],
      arrangement: [...project.arrangement, { id: nodeId, sectionId, repeat: source?.repeat ?? 1, nextId: nodeId }],
    },
  }
}

function stamp(): string {
  return Math.random().toString(36).slice(2, 8)
}

function blankSteps(length: number): Step[] {
  return Array.from({ length }, () => ({ on: false, velocity: 0.9, degree: 0, quality: null }))
}

function resizeSteps(steps: Step[], length: number): Step[] {
  if (steps.length === length) return steps
  if (steps.length > length) return steps.slice(0, length)
  return [...steps, ...blankSteps(length - steps.length)]
}

export type SoundFamily = 'drums' | 'bass' | 'melodic'

export type CatalogId =
  | `${DrumKit}:${DrumId}`
  | 'bass'
  | 'sub'
  | 'lead'
  | 'pluck'
  | 'brass'
  | 'bell'
  | 'keys'
  | 'organ'
  | 'stab'
  | 'strings'
  | 'pad'

export type CatalogEntry = {
  id: CatalogId
  label: string
  family: SoundFamily
  kit?: DrumKit
}

function kitPieces(kit: DrumKit): readonly DrumId[] {
  if (kit === '909') return NINE_OH_NINE
  if (kit === 'rock') return ROCK_PIECES
  return DRUM_IDS
}

function kitPieceName(kit: DrumKit, drum: DrumId): string {
  if (kit === 'rock' && drum === 'lowTom') return 'Floor'
  if (kit === 'rock' && drum === 'cymbal') return 'Crash'
  if (kit === 'rock' && drum === 'rim') return 'Stick'
  return DRUM_NAMES[drum]
}

export function catalogEntries(): CatalogEntry[] {
  const drums: CatalogEntry[] = []
  for (const kit of DRUM_KITS) {
    for (const drum of kitPieces(kit)) {
      drums.push({ id: `${kit}:${drum}`, label: `${kitLabel(kit)} ${kitPieceName(kit, drum)}`, family: 'drums', kit })
    }
  }
  return [
    ...drums,
    { id: 'bass', label: 'Bass', family: 'bass' },
    { id: 'sub', label: 'Sub', family: 'bass' },
    { id: 'lead', label: 'Lead', family: 'melodic' },
    { id: 'pluck', label: 'Pluck', family: 'melodic' },
    { id: 'brass', label: 'Brass', family: 'melodic' },
    { id: 'bell', label: 'Bell', family: 'melodic' },
    { id: 'keys', label: 'Keys', family: 'melodic' },
    { id: 'organ', label: 'Organ', family: 'melodic' },
    { id: 'stab', label: 'Stab', family: 'melodic' },
    { id: 'strings', label: 'Strings', family: 'melodic' },
    { id: 'pad', label: 'Pad', family: 'melodic' },
  ]
}

export function familyFor(catalog: CatalogId): SoundFamily {
  if (catalog === 'bass' || catalog === 'sub') return 'bass'
  if (catalog === 'lead' || catalog === 'pluck' || catalog === 'brass' || catalog === 'bell') return 'melodic'
  if (catalog === 'keys' || catalog === 'organ' || catalog === 'stab' || catalog === 'strings' || catalog === 'pad') return 'melodic'
  return 'drums'
}

export function familiesForGroup(name: string): SoundFamily[] | undefined {
  const label = name.toLowerCase()
  if (label === 'drums') return ['drums']
  if (label === 'bass') return ['bass']
  if (label === 'melodic' || label === 'keys' || label === 'lead' || label === 'pad') return ['melodic']
  return undefined
}

export function groupForFamily(project: Project, family: SoundFamily): { project: Project; groupId: string } {
  const name = family === 'drums' ? 'Drums' : family === 'bass' ? 'Bass' : 'Melodic'
  const existing = project.groups.find((group) => group.name.toLowerCase() === name.toLowerCase())
  if (existing) return { project, groupId: existing.id }
  return addGroup(project, name)
}

export function catalogVoice(catalog: CatalogId): VoiceParams {
  if (catalog === 'bass') return { type: 'bass', sound: { ...DEFAULT_BASS } }
  if (catalog === 'sub') return { type: 'bass', sound: { cutoff: 0.2, decay: 0.72, glide: 0.24, wave: 'sine' } }
  if (catalog === 'lead') return { type: 'lead', sound: { ...DEFAULT_LEAD } }
  if (catalog === 'pluck') return { type: 'lead', sound: { cutoff: 0.74, decay: 0.1, glide: 0, wave: 'square' } }
  if (catalog === 'brass') return { type: 'lead', sound: { cutoff: 0.46, decay: 0.58, glide: 0.28, wave: 'saw' } }
  if (catalog === 'bell') return { type: 'lead', sound: { cutoff: 0.92, decay: 0.4, glide: 0, wave: 'sine' } }
  if (catalog === 'keys') return { type: 'chord', sound: { ...DEFAULT_CHORD } }
  if (catalog === 'organ') return { type: 'chord', sound: { cutoff: 0.72, decay: 0.95, wave: 'square' } }
  if (catalog === 'stab') return { type: 'chord', sound: { cutoff: 0.66, decay: 0.14, wave: 'saw' } }
  if (catalog === 'strings') return { type: 'chord', sound: { cutoff: 0.38, decay: 0.94, wave: 'saw' } }
  if (catalog === 'pad') return { type: 'chord', sound: { ...DEFAULT_PAD } }
  const [kit, drum] = catalog.split(':')
  return {
    type: '808',
    kit: kit === '909' || kit === 'rock' ? kit : '808',
    drum: isDrumId(drum) ? drum : 'kick',
    sound: { ...DEFAULT_SOUND },
  }
}

function catalogLabel(catalog: CatalogId): string {
  return catalogEntries().find((item) => item.id === catalog)?.label ?? catalog
}

const LEAD_IDS: CatalogId[] = ['lead', 'pluck', 'brass', 'bell']
const CHORD_IDS: CatalogId[] = ['keys', 'organ', 'stab', 'strings', 'pad']

export function relatedCatalogs(instrument: Instrument): CatalogEntry[] {
  const entries = catalogEntries()
  if (instrument.voice.type === '808') {
    const drum = instrument.voice.drum
    return entries.filter((item) => item.id.endsWith(`:${drum}`))
  }
  if (instrument.voice.type === 'bass') return entries.filter((item) => item.family === 'bass')
  if (instrument.voice.type === 'lead') return entries.filter((item) => LEAD_IDS.includes(item.id))
  if (instrument.voice.type === 'chord') return entries.filter((item) => CHORD_IDS.includes(item.id))
  return []
}

export function matchingCatalog(instrument: Instrument): CatalogId | null {
  if (instrument.voice.type === '808') return `${instrument.voice.kit}:${instrument.voice.drum}`
  const related = relatedCatalogs(instrument)
  const named = related.find((item) => item.label.toLowerCase() === instrument.name.toLowerCase())
  return named?.id ?? related[0]?.id ?? null
}

export function retuneInstrument(project: Project, instrumentId: string, catalog: CatalogId): Project {
  const instrument = project.instruments.find((item) => item.id === instrumentId)
  if (!instrument) return project
  if (!relatedCatalogs(instrument).some((item) => item.id === catalog)) return project
  const voice = catalogVoice(catalog)
  const kind: Instrument['kind'] = voice.type === '808' ? 'drum' : 'melodic'
  if (instrument.kind !== kind) return project
  return mapInstrument(project, instrumentId, (item) => ({
    ...item,
    name: catalogLabel(catalog),
    kind,
    voice,
  }))
}

export function addGroup(project: Project, name: string): { project: Project; groupId: string } {
  const groupId = `group-${stamp()}`
  const label = name.trim() || 'Group'
  return {
    groupId,
    project: { ...project, groups: [...project.groups, { id: groupId, name: label, instrumentIds: [] }] },
  }
}

export function addTrack(project: Project, groupId: string, catalog: CatalogId): { project: Project; instrumentId: string } | null {
  if (!project.groups.some((group) => group.id === groupId)) return null
  const instrumentId = `${catalog.replace(':', '-')}-${stamp()}`
  const patterns = project.sections.map((section) =>
    pattern(`${instrumentId}-${section.id}`, blankSteps(loopSteps(section.meter, section.bars))),
  )
  const voice = catalogVoice(catalog)
  const melodic = voice.type !== '808'
  const drum = voice.type === '808' ? voice.drum : null
  const instrument: Instrument = {
    id: instrumentId,
    name: catalogLabel(catalog),
    kind: melodic ? 'melodic' : 'drum',
    voice,
    patterns,
    mix: {
      level: melodic ? 0.55 : (drum ? DRUM_LEVELS[drum] : 0.7),
      pan: 0,
      eq: { low: 0, mid: 0, high: 0 },
    },
    effects: [],
    fx: copyFx(),
    inserts: [],
    envelope: { ...DEFAULT_ENVELOPE },
  }
  return {
    instrumentId,
    project: {
      ...project,
      instruments: [...project.instruments, instrument],
      groups: project.groups.map((group) =>
        group.id === groupId ? { ...group, instrumentIds: [...group.instrumentIds, instrumentId] } : group,
      ),
      sections: project.sections.map((section) => ({
        ...section,
        slots: {
          ...section.slots,
          [instrumentId]: { enabled: true, solo: false, patternId: `${instrumentId}-${section.id}`, rack: openRack(instrument.mix.level) },
        },
      })),
    },
  }
}

export function songName(value: unknown): string {
  if (typeof value !== 'string') return 'Song'
  const label = value.trim().slice(0, 48)
  return label || 'Song'
}

export function renameSong(project: Project, name: string): Project {
  const label = songName(name)
  if (label === project.name) return project
  return { ...project, name: label }
}

export function renameSection(project: Project, sectionId: string, name: string): Project {
  const label = name.trim()
  if (!label) return project
  return {
    ...project,
    sections: project.sections.map((section) =>
      section.id === sectionId ? { ...section, name: label.slice(0, 32) } : section,
    ),
  }
}

export function renameInstrument(project: Project, instrumentId: string, name: string): Project {
  const label = name.trim()
  if (!label) return project
  return mapInstrument(project, instrumentId, (instrument) => ({ ...instrument, name: label.slice(0, 32) }))
}

export function setInstrumentColor(project: Project, instrumentId: string, color: string | null): Project {
  const hex = color ? parseColor(color) : undefined
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.color === hex) return instrument
    if (!hex) {
      const { color: _removed, ...rest } = instrument
      return rest
    }
    return { ...instrument, color: hex }
  })
}

export function renameGroup(project: Project, groupId: string, name: string): Project {
  const label = name.trim()
  if (!label) return project
  return {
    ...project,
    groups: project.groups.map((group) => (group.id === groupId ? { ...group, name: label.slice(0, 32) } : group)),
  }
}

export function moveTrack(project: Project, instrumentId: string, groupId: string): Project {
  const group = project.groups.find((item) => item.id === groupId)
  if (!group) return project
  return placeTrack(project, instrumentId, groupId, group.instrumentIds.filter((id) => id !== instrumentId).length)
}

export function placeTrack(project: Project, instrumentId: string, groupId: string, index: number): Project {
  if (!project.groups.some((group) => group.id === groupId)) return project
  if (!project.instruments.some((instrument) => instrument.id === instrumentId)) return project
  const cleared = project.groups.map((group) => ({
    ...group,
    instrumentIds: group.instrumentIds.filter((id) => id !== instrumentId),
  }))
  return {
    ...project,
    groups: cleared.map((group) => {
      if (group.id !== groupId) return group
      const instrumentIds = group.instrumentIds.slice()
      const at = Math.max(0, Math.min(Math.round(index), instrumentIds.length))
      instrumentIds.splice(at, 0, instrumentId)
      return { ...group, instrumentIds }
    }),
  }
}

export function removeInstrument(project: Project, instrumentId: string): Project {
  if (!project.instruments.some((instrument) => instrument.id === instrumentId)) return project
  return {
    ...project,
    instruments: project.instruments.filter((instrument) => instrument.id !== instrumentId),
    groups: project.groups.map((group) => ({
      ...group,
      instrumentIds: group.instrumentIds.filter((id) => id !== instrumentId),
    })),
    sections: project.sections.map((section) => {
      if (!section.slots[instrumentId]) return section
      const slots = { ...section.slots }
      delete slots[instrumentId]
      return { ...section, slots }
    }),
  }
}

export function setSolo(project: Project, instrumentId: string, solo: boolean, sectionId?: string): Project {
  const section = sectionId ? sectionById(project, sectionId) : startingSection(project)
  const slot = section?.slots[instrumentId]
  if (!section || !slot || slot.solo === solo) return project
  return {
    ...project,
    sections: project.sections.map((item) => {
      if (item.id !== section.id) return item
      return { ...item, slots: { ...item.slots, [instrumentId]: { ...slot, solo } } }
    }),
  }
}

export function setMaster(project: Project, master: number): Project {
  if (!Number.isFinite(master)) return project
  const next = clampGain(master)
  if (next === project.master) return project
  return { ...project, master: next }
}

export function setProjectKey(project: Project, key: string): Project {
  const label = key.trim()
  if (!label) return project
  return {
    ...project,
    key: label,
    sections: project.sections.map((section) =>
      section.customKey ? section : { ...section, key: label },
    ),
  }
}

export function setProjectMeter(project: Project, meter: Meter): Project {
  let next: Project = { ...project, meter }
  for (const section of project.sections) {
    if (!section.customMeter && section.meter !== meter) {
      next = resizeSection(next, section, meter, section.bars)
    }
  }
  return next
}

export function adhereSection(
  project: Project,
  sectionId: string,
  kind: 'all' | 'bpm' | 'key' | 'meter' = 'all',
): Project {
  const section = project.sections.find((item) => item.id === sectionId)
  if (!section) return project
  let updated = project

  if ((kind === 'all' || kind === 'meter') && section.meter !== project.meter) {
    updated = resizeSection(updated, section, project.meter, section.bars)
  }

  return {
    ...updated,
    sections: updated.sections.map((item) => {
      if (item.id !== sectionId) return item
      return {
        ...item,
        bpm: kind === 'all' || kind === 'bpm' ? project.bpm : item.bpm,
        customBpm: kind === 'all' || kind === 'bpm' ? false : item.customBpm,
        key: kind === 'all' || kind === 'key' ? project.key : item.key,
        customKey: kind === 'all' || kind === 'key' ? false : item.customKey,
        customMeter: kind === 'all' || kind === 'meter' ? false : item.customMeter,
      }
    }),
  }
}

export function setSectionBpm(project: Project, sectionId: string, bpm: number): Project {
  if (!Number.isFinite(bpm)) return project
  const next = clamp(Math.round(bpm), 40, 200)
  return {
    ...project,
    sections: project.sections.map((section) =>
      section.id === sectionId ? { ...section, bpm: next, customBpm: next !== project.bpm } : section,
    ),
  }
}

export function setSectionKey(project: Project, sectionId: string, key: string): Project {
  const label = key.trim()
  if (!label) return project
  return {
    ...project,
    sections: project.sections.map((section) =>
      section.id === sectionId ? { ...section, key: label, customKey: label !== project.key } : section,
    ),
  }
}

export function setSectionMeter(project: Project, sectionId: string, meter: Meter): Project {
  const section = project.sections.find((item) => item.id === sectionId)
  if (!section || section.meter === meter) return project
  const updated = resizeSection(project, section, meter, section.bars)
  return {
    ...updated,
    sections: updated.sections.map((item) =>
      item.id === sectionId ? { ...item, customMeter: meter !== project.meter } : item,
    ),
  }
}

export function setSectionBars(project: Project, sectionId: string, bars: LoopBars): Project {
  const section = project.sections.find((item) => item.id === sectionId)
  if (!section || section.bars === bars) return project
  const previous = section.bars
  let next = resizeSection(project, section, section.meter, bars)
  if (bars <= previous) return next
  const instrumentIds = next.instruments.map((item) => item.id)
  for (let toBar = previous; toBar < bars; toBar += 1) {
    next = copyBarTo(next, sectionId, toBar % previous, [toBar], instrumentIds, true)
  }
  return next
}

export function copyBarTo(
  project: Project,
  sectionId: string,
  fromBar: number,
  toBars: number[],
  instrumentIds: string[],
  copyAccent = false,
): Project {
  const section = sectionById(project, sectionId)
  if (!section) return project
  const stepsPerBar = stepsForMeter(section.meter)
  const barCount = section.bars
  if (fromBar < 0 || fromBar >= barCount) return project
  const targets = [...new Set(toBars)].filter((bar) => bar !== fromBar && bar >= 0 && bar < barCount)
  if (targets.length === 0) return project
  const fromStart = fromBar * stepsPerBar

  let next = project
  if (copyAccent) {
    const accent = section.accent.slice()
    const source = accent.slice(fromStart, fromStart + stepsPerBar)
    for (const toBar of targets) {
      const toStart = toBar * stepsPerBar
      for (let index = 0; index < source.length; index += 1) accent[toStart + index] = source[index] === true
    }
    next = {
      ...next,
      sections: next.sections.map((item) => (item.id === section.id ? { ...item, accent } : item)),
    }
  }

  for (const instrumentId of instrumentIds) {
    const pattern = patternFor(next, instrumentId, sectionId)
    if (!pattern) continue
    next = mapInstrument(next, instrumentId, (instrument) => ({
      ...instrument,
      patterns: instrument.patterns.map((item) => {
        if (item.id !== pattern.id) return item
        const steps = item.steps.map((step) => ({ ...step }))
        const sourceSteps = item.steps.slice(fromStart, fromStart + stepsPerBar)
        for (const toBar of targets) {
          const toStart = toBar * stepsPerBar
          for (let index = 0; index < sourceSteps.length; index += 1) {
            const source = sourceSteps[index]
            if (source && toStart + index < steps.length) steps[toStart + index] = { ...source }
          }
        }
        const kept = item.notes.filter((note) => {
          const start = Math.round(note.start)
          return targets.every((toBar) => {
            const toStart = toBar * stepsPerBar
            return start < toStart || start >= toStart + stepsPerBar
          })
        })
        const copied = item.notes
          .filter((note) => {
            const start = Math.round(note.start)
            return start >= fromStart && start < fromStart + stepsPerBar
          })
          .flatMap((note) =>
            targets.map((toBar) => {
              const toStart = toBar * stepsPerBar
              const start = Math.round(note.start) + (toStart - fromStart)
              const duration = Math.max(1, Math.min(note.duration, toStart + stepsPerBar - start))
              return { ...note, start, duration }
            }),
          )
        return { ...item, steps, notes: [...kept, ...copied] }
      }),
    }))
  }

  const toStarts = targets.map((bar) => bar * stepsPerBar)
  const length = loopSteps(section.meter, section.bars)
  next = {
    ...next,
    sections: next.sections.map((item) => {
      if (item.id !== section.id) return item
      const slots = { ...item.slots }
      for (const instrumentId of instrumentIds) {
        const slot = slots[instrumentId]
        if (!slot?.rack?.automation) continue
        slots[instrumentId] = {
          ...slot,
          rack: {
            ...slot.rack,
            automation: copyAutomationBar(slot.rack.automation, fromStart, toStarts, stepsPerBar, length),
          },
        }
      }
      const groups = item.groups
        ? Object.fromEntries(
            Object.entries(item.groups).map(([id, rack]) => [
              id,
              { ...rack, automation: copyAutomationBar(rack.automation, fromStart, toStarts, stepsPerBar, length) },
            ]),
          )
        : item.groups
      return {
        ...item,
        slots,
        groups,
        bus: item.bus
          ? { ...item.bus, automation: copyAutomationBar(item.bus.automation, fromStart, toStarts, stepsPerBar, length) }
          : item.bus,
      }
    }),
  }
  return next
}

function resizeSection(project: Project, section: Section, meter: Meter, bars: LoopBars): Project {
  const length = loopSteps(meter, bars)
  const patternIds = new Set(Object.values(section.slots).map((slot) => slot.patternId))
  return {
    ...project,
    sections: project.sections.map((item) =>
      item.id === section.id
        ? {
            ...item,
            meter,
            bars,
            accent: resizeFlags(item.accent, length),
            bus: withResizedAutomation(item.bus, length),
            groups: item.groups
              ? Object.fromEntries(
                  Object.entries(item.groups).map(([id, rack]) => [id, withResizedAutomation(rack, length) ?? rack]),
                )
              : item.groups,
            slots: Object.fromEntries(
              Object.entries(item.slots).map(([id, slot]) => [
                id,
                slot.rack ? { ...slot, rack: withResizedAutomation(slot.rack, length) } : slot,
              ]),
            ),
          }
        : item,
    ),
    instruments: project.instruments.map((instrument) => ({
      ...instrument,
      patterns: instrument.patterns.map((item) => {
        if (!patternIds.has(item.id)) return item
        const notes = item.notes
          .filter((note) => note.start < length)
          .map((note) => ({ ...note, duration: Math.max(1, Math.min(note.duration, length - note.start)) }))
        return { ...item, length, steps: resizeSteps(item.steps, length), notes }
      }),
    })),
  }
}

export function addInsert(project: Project, instrumentId: string, insert: InsertId): Project {
  return mapInstrument(project, instrumentId, (instrument) => {
    if (instrument.inserts.includes(insert)) return instrument
    return { ...instrument, inserts: [...instrument.inserts, insert] }
  })
}

export function removeInsert(project: Project, instrumentId: string, insert: InsertId): Project {
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    inserts: instrument.inserts.filter((item) => item !== insert),
    off: instrument.off?.filter((item) => item !== insert),
  }))
}

export function toggleInsert(project: Project, instrumentId: string, insert: InsertId): Project {
  return mapInstrument(project, instrumentId, (instrument) => ({ ...instrument, off: flipOff(instrument.off, insert) }))
}

export function setEnvelope(project: Project, instrumentId: string, key: keyof Envelope, value: number): Project {
  if (!Number.isFinite(value)) return project
  return mapInstrument(project, instrumentId, (instrument) => ({
    ...instrument,
    envelope: { ...instrument.envelope, [key]: clamp(value, 0, 1) },
  }))
}
