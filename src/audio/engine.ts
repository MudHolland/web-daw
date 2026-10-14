import { bassMidi, chordMidis } from '../model/harmony.ts'
import { applyFx, createFx, rampParam, scheduleParam, type FxChain, type FxGrid } from './effects.ts'
import { applyRackAutomation, hasAutomation, lerpAutomation } from '../model/automation.ts'
import {
  catalogVoice,
  DEFAULT_CHORD,
  DEFAULT_SOUND,
  groupSlot,
  insertOn,
  liveInserts,
  openRack,
  rackChance,
  rackFromInstrument,
  syncHz,
  type CatalogId,
  type FxSettings,
  type InsertId,
  type Instrument,
  type Mix,
  type Project,
  type Rack,
  type Section,
} from '../model/project.ts'
import {
  SCHEDULE_AHEAD_SECONDS,
  TICK_MS,
  bpmFor,
  stepDuration,
  takeSteps,
  type CueMode,
  type PlaybackCursor,
} from './scheduler.ts'
import type { TriggerSound, Voice } from './types.ts'
import { createBassVoice } from './voices/bass.ts'
import { createChordVoice } from './voices/chord.ts'
import { create808Voice, createNoiseBuffer, drumNote } from './voices/kit808.ts'

function gateSeconds(project: Project, cursor: PlaybackCursor, duration: number): number {
  const bpm = bpmFor(project, cursor.nodeId)
  const steps = Math.max(1, Math.round(duration))
  let total = 0
  for (let index = 0; index < steps; index += 1) total += stepDuration(bpm, project.swing, cursor.step + index)
  return Math.max(0.05, total * 0.92)
}

function accentVelocity(accent: boolean[], amount: number, stepIndex: number, velocity: number): number {
  if (!accent.some(Boolean)) return velocity
  if (accent[stepIndex]) return Math.min(1.35, velocity * (1 + amount * 0.45))
  return velocity * (1 - amount * 0.5)
}

export type StereoLevel = {
  left: number
  right: number
}

export type PlaybackState = {
  playing: boolean
  step: number
  position: number
  nodeId: string | null
  level: StereoLevel
  voices: Record<string, number>
  queuedNodeId: string | null
  cueMode: CueMode | null
}

const SILENT: StereoLevel = { left: 0, right: 0 }

type Strip = {
  fx: FxChain
  low: BiquadFilterNode
  mid: BiquadFilterNode
  high: BiquadFilterNode
  pan: StereoPannerNode
  gain: GainNode
  meter: AnalyserNode
  meterData: Uint8Array<ArrayBuffer>
  moverRate: AudioParam
  moverDepth: AudioParam
  input: AudioNode
  dest: AudioNode
}

type DisplayEvent = {
  step: number
  time: number
  duration: number
  nodeId: string
}

function createStrip(ctx: AudioContext, mix: Mix, destination: AudioNode, fx: FxSettings, inserts: InsertId[]): Strip {
  const effects = createFx(ctx)
  const low = ctx.createBiquadFilter()
  low.type = 'lowshelf'
  low.frequency.value = 120
  const mid = ctx.createBiquadFilter()
  mid.type = 'peaking'
  mid.frequency.value = 1000
  mid.Q.value = 0.7
  const high = ctx.createBiquadFilter()
  high.type = 'highshelf'
  high.frequency.value = 4000
  const pan = ctx.createStereoPanner()
  const gain = ctx.createGain()
  const mover = ctx.createOscillator()
  const moverDepth = ctx.createGain()
  mover.frequency.value = 0.3
  moverDepth.gain.value = 0
  mover.connect(moverDepth)
  moverDepth.connect(pan.pan)
  mover.start()
  effects.output.connect(low)
  low.connect(mid)
  mid.connect(high)
  high.connect(pan)
  pan.connect(gain)
  gain.connect(destination)
  const meter = ctx.createAnalyser()
  meter.fftSize = 256
  gain.connect(meter)
  const strip = {
    fx: effects,
    low,
    mid,
    high,
    pan,
    gain,
    meter,
    meterData: new Uint8Array(meter.fftSize),
    moverRate: mover.frequency,
    moverDepth: moverDepth.gain,
    input: effects.input,
    dest: destination,
  }
  applyMix(strip, mix, ctx.currentTime, inserts.includes('eq'), fx, inserts, 120)
  return strip
}

function applyMix(
  strip: Strip,
  mix: Mix,
  time: number,
  eqEnabled: boolean,
  fx: FxSettings,
  inserts: InsertId[],
  bpm: number,
  snap = false,
  grid: FxGrid = null,
): void {
  scheduleParam(strip.low.gain, eqEnabled ? mix.eq.low : 0, time, snap, 0.01)
  scheduleParam(strip.mid.gain, eqEnabled ? mix.eq.mid : 0, time, snap, 0.01)
  scheduleParam(strip.high.gain, eqEnabled ? mix.eq.high : 0, time, snap, 0.01)
  scheduleParam(strip.pan.pan, mix.pan, time, snap, 0.01)
  scheduleParam(strip.gain.gain, mix.level, time, snap, 0.01)
  applyFx(strip.fx, fx, inserts, time, bpm, snap, grid)
  const moverOn = inserts.includes('mover') && fx.mover.depth > 0.001
  scheduleParam(strip.moverRate, syncHz(fx.mover.rate, bpm), time, snap, 0.05)
  scheduleParam(strip.moverDepth, moverOn ? fx.mover.depth : 0, time, snap, 0.04)
}

function shiftSemis(rack: Rack | undefined): number {
  if (!rack || !insertOn(rack, 'shifter')) return 0
  return Math.round((rack.fx.shifter.semi - 0.5) * 24)
}

function noteShift(project: Project, section: Section, instrumentId: string): number {
  const group = project.groups.find((item) => item.instrumentIds.includes(instrumentId))
  return shiftSemis(section.slots[instrumentId]?.rack) + shiftSemis(group ? section.groups?.[group.id] : undefined) + shiftSemis(section.bus)
}

function shapedSound(instrument: Instrument) {
  if (instrument.voice.type === 'lead' || instrument.voice.type === 'bass' || instrument.voice.type === 'chord') {
    return instrument.voice.sound
  }
  return DEFAULT_CHORD
}

function voiceKind(instrument: Instrument): string {
  if (instrument.voice.type === '808') return `808:${instrument.voice.kit}:${instrument.voice.drum}`
  return instrument.voice.type
}

export class Engine {
  private project: Project
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private meterLeft: AnalyserNode | null = null
  private meterRight: AnalyserNode | null = null
  private levelLeft: Uint8Array<ArrayBuffer> | null = null
  private levelRight: Uint8Array<ArrayBuffer> | null = null
  private noise: AudioBuffer | null = null
  private strips = new Map<string, Strip>()
  private voices = new Map<string, Voice>()
  private voiceKinds = new Map<string, string>()
  private timer: number | null = null
  private playing = false
  private nextNoteTime = 0
  private cursor: PlaybackCursor = { nodeId: '', cycle: 0, step: 0 }
  private queuedNodeId: string | null = null
  private latchedQueue: string | null = null
  private cueMode: CueMode = 'repeat'
  private displayQueue: DisplayEvent[] = []
  private activity = new Map<string, number>()
  private songBus: Strip | null = null
  private groupBuses = new Map<string, Strip>()
  private focusId = ''
  private armedSectionId = ''
  private gridOrigin = 0

  constructor(project: Project) {
    this.project = project
  }

  setProject(project: Project, sectionId?: string): void {
    this.project = project
    if (sectionId) this.focusId = sectionId
    if (!this.ctx) return
    this.ensureGraph()
    if (this.playing) {
      this.applyLiveMix()
    } else {
      this.applyAllMix()
    }
  }

  focus(sectionId: string): void {
    this.focusId = sectionId
    if (!this.ctx) return
    if (this.playing) {
      this.applyLiveMix()
    } else {
      this.applyAllMix()
    }
  }

  play(fromNodeId?: string): void {
    const ctx = this.ensureContext()
    if (this.playing) return
    const nodeId =
      fromNodeId && this.project.arrangement.some((node) => node.id === fromNodeId)
        ? fromNodeId
        : this.project.startNodeId
    this.playing = true
    this.clearCue()
    this.armedSectionId = ''
    this.cursor = { nodeId, cycle: 0, step: 0 }
    this.displayQueue = []
    const start = () => {
      if (!this.playing) return
      this.ensureGraph()
      this.nextNoteTime = ctx.currentTime + 0.06
      this.queueTick()
    }
    if (ctx.state === 'running') start()
    else void ctx.resume().then(start)
  }

  jump(nodeId: string): void {
    if (!this.project.arrangement.some((node) => node.id === nodeId)) return
    if (!this.playing) {
      this.play(nodeId)
      return
    }
    const here = this.soundingNode()
    if (nodeId === here) {
      this.clearCue()
      return
    }
    if (nodeId === this.queuedNodeId || nodeId === this.latchedQueue) {
      if (this.cueMode === 'repeat') {
        this.cueMode = 'bar'
        return
      }
      this.clearCue()
      return
    }
    this.queuedNodeId = nodeId
    this.latchedQueue = nodeId
    this.cueMode = 'repeat'
  }

  private clearCue(): void {
    this.queuedNodeId = null
    this.latchedQueue = null
    this.cueMode = 'repeat'
  }

  private soundingNode(): string {
    const now = this.ctx?.currentTime ?? 0
    let nodeId = this.cursor.nodeId
    for (const event of this.displayQueue) {
      if (event.time <= now) nodeId = event.nodeId
    }
    return nodeId
  }

  stop(): void {
    this.playing = false
    this.clearCue()
    this.armedSectionId = ''
    if (this.timer !== null) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
    this.displayQueue = []
    if (!this.ctx) return
    const time = this.ctx.currentTime
    for (const voice of this.voices.values()) voice.silence(time)
    this.applyAllMix()
  }

  preview(instrumentId: string): void {
    const ctx = this.ensureContext()
    void ctx.resume()
    this.ensureGraph()
    const instrument = this.project.instruments.find((item) => item.id === instrumentId)
    const voice = this.voices.get(instrumentId)
    if (!instrument || !voice) return
    const time = ctx.currentTime + 0.02
    const envelope = insertOn(instrument, 'adsr') ? instrument.envelope : null
    const section = this.project.sections.find((item) => item.id === this.focusId) ?? this.project.sections[0]
    const semis = section ? noteShift(this.project, section, instrumentId) : 0
    const play = (pitch: number, velocity: number, sound: TriggerSound) => {
      voice.trigger(time, Math.max(0, Math.min(127, Math.round(pitch + semis))), velocity, sound, envelope)
    }
    if (instrument.voice.type === '808') {
      const sound = insertOn(instrument, 'processing') ? (instrument.voice.sound ?? DEFAULT_SOUND) : DEFAULT_SOUND
      play(drumNote(instrument.voice.drum), 0.9, sound)
      return
    }
    if (instrument.voice.type === 'bass' || instrument.voice.type === 'lead') {
      const note = bassMidi(section?.key ?? this.project.key, 0) + (instrument.voice.type === 'lead' ? 12 : 0)
      play(note, 0.9, shapedSound(instrument))
      return
    }
    const sound = shapedSound(instrument)
    for (const note of chordMidis(section?.key ?? this.project.key, 0, 'triad')) play(note, 0.8, sound)
  }

  previewCatalog(catalog: CatalogId): void {
    const ctx = this.ensureContext()
    void ctx.resume()
    this.ensureGraph()
    if (!this.master) return
    const dest = this.songBus?.input ?? this.master
    const time = ctx.currentTime + 0.02
    const section = this.project.sections.find((item) => item.id === this.focusId) ?? this.project.sections[0]
    const key = section?.key ?? this.project.key
    const params = catalogVoice(catalog)
    if (params.type === '808') {
      if (!this.noise) return
      const voice = create808Voice(ctx, params.drum, this.noise, params.kit)
      voice.connect(dest)
      voice.trigger(time, drumNote(params.drum), 0.9, params.sound)
      return
    }
    if (params.type === 'bass' || params.type === 'lead') {
      const voice = createBassVoice(ctx)
      voice.connect(dest)
      const note = bassMidi(key, 0) + (params.type === 'lead' ? 12 : 0)
      voice.trigger(time, note, 0.9, params.sound)
      return
    }
    const voice = createChordVoice(ctx)
    voice.connect(dest)
    for (const note of chordMidis(key, 0, 'triad')) voice.trigger(time, note, 0.8, params.sound)
  }

  getPlayback(): PlaybackState {
    const level = this.readLevels()
    const voices = this.readActivity()
    if (!this.playing || !this.ctx) {
      return { playing: false, step: -1, position: -1, nodeId: null, level, voices, queuedNodeId: null, cueMode: null }
    }
    const now = this.ctx.currentTime
    let step = -1
    let position = -1
    let nodeId: string | null = this.cursor.nodeId
    for (const event of this.displayQueue) {
      if (event.time <= now) {
        step = event.step
        nodeId = event.nodeId
        const phase = Math.min(0.999, Math.max(0, (now - event.time) / Math.max(0.0001, event.duration)))
        position = event.step + phase
      }
    }
    if (this.latchedQueue && nodeId === this.latchedQueue) this.latchedQueue = null
    const queuedNodeId = this.queuedNodeId ?? (this.latchedQueue && this.latchedQueue !== nodeId ? this.latchedQueue : null)
    return { playing: true, step, position, nodeId, level, voices, queuedNodeId, cueMode: queuedNodeId ? this.cueMode : null }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext()
    return this.ctx
  }

  private ensureGraph(): void {
    const ctx = this.ensureContext()
    if (!this.master) {
      this.master = ctx.createGain()
      this.master.gain.value = this.project.master
      this.master.connect(ctx.destination)
      const split = ctx.createChannelSplitter(2)
      this.master.connect(split)
      this.meterLeft = ctx.createAnalyser()
      this.meterRight = ctx.createAnalyser()
      this.meterLeft.fftSize = 256
      this.meterRight.fftSize = 256
      split.connect(this.meterLeft, 0)
      split.connect(this.meterRight, 1)
      this.levelLeft = new Uint8Array(this.meterLeft.fftSize)
      this.levelRight = new Uint8Array(this.meterRight.fftSize)
      this.noise = createNoiseBuffer(ctx)
    }
    if (!this.songBus && this.master) {
      this.songBus = createStrip(ctx, { level: 1, pan: 0, eq: { low: 0, mid: 0, high: 0 } }, this.master, openRack().fx, [])
    }
    for (const group of this.project.groups) {
      if (this.groupBuses.has(group.id) || !this.songBus) continue
      this.groupBuses.set(
        group.id,
        createStrip(ctx, { level: 1, pan: 0, eq: { low: 0, mid: 0, high: 0 } }, this.songBus.input, openRack().fx, []),
      )
    }
    for (const instrument of this.project.instruments) {
      if (!this.master || !this.songBus) continue
      const kind = voiceKind(instrument)
      if (this.voices.has(instrument.id) && this.voiceKinds.get(instrument.id) !== kind) {
        this.voices.get(instrument.id)?.silence(ctx.currentTime)
        this.voices.delete(instrument.id)
        this.voiceKinds.delete(instrument.id)
      }
      if (!this.strips.has(instrument.id)) {
        this.strips.set(instrument.id, createStrip(ctx, instrument.mix, this.busInput(instrument.id), instrument.fx, instrument.inserts))
      }
      if (this.voices.has(instrument.id)) continue
      const strip = this.strips.get(instrument.id)
      const voice =
        instrument.voice.type === '808' && this.noise
          ? create808Voice(ctx, instrument.voice.drum, this.noise, instrument.voice.kit)
          : instrument.voice.type === 'bass' || instrument.voice.type === 'lead'
            ? createBassVoice(ctx)
            : instrument.voice.type === 'chord'
              ? createChordVoice(ctx)
              : null
      if (!voice || !strip) continue
      voice.connect(strip.input)
      this.voices.set(instrument.id, voice)
      this.voiceKinds.set(instrument.id, kind)
    }
    this.routeTracks()
  }

  private busInput(instrumentId: string): AudioNode {
    const group = this.project.groups.find((item) => item.instrumentIds.includes(instrumentId))
    const bus = group ? this.groupBuses.get(group.id) : null
    return bus?.input ?? this.songBus?.input ?? this.master!
  }

  private routeTracks(): void {
    for (const instrument of this.project.instruments) {
      const strip = this.strips.get(instrument.id)
      if (!strip) continue
      const dest = this.busInput(instrument.id)
      if (strip.dest === dest) continue
      strip.gain.disconnect()
      strip.gain.connect(strip.meter)
      strip.gain.connect(dest)
      strip.dest = dest
    }
  }

  private heardSectionId(): string {
    if (!this.playing) return this.focusId || this.project.sections[0]?.id || ''
    const nodeId = this.soundingNode()
    return this.project.arrangement.find((node) => node.id === nodeId)?.sectionId ?? this.focusId
  }

  private applyAllMix(at?: number, snap = false): void {
    if (!this.ctx) return
    const time = at ?? this.ctx.currentTime
    this.routeTracks()
    const section = this.project.sections.find((item) => item.id === (snap ? this.armedSectionId : this.heardSectionId()))
    const bpm = section?.bpm ?? 120
    if (this.songBus) {
      const bus = section?.bus ?? openRack(1)
      this.applyRack(this.songBus, { ...bus, level: 1 }, time, bpm, snap)
    }
    for (const [id, strip] of this.groupBuses) this.applyRack(strip, section?.groups?.[id] ?? openRack(1), time, bpm, snap)
    for (const instrument of this.project.instruments) {
      const strip = this.strips.get(instrument.id)
      if (!strip) continue
      const rack = section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument)
      this.applyRack(strip, rack, time, bpm, snap)
    }
    if (this.master && !snap) scheduleParam(this.master.gain, this.project.master, time, false, 0.02)
  }

  private applyLiveMix(): void {
    if (!this.ctx) return
    const time = this.ctx.currentTime
    this.routeTracks()
    const section = this.project.sections.find((item) => item.id === (this.playing && this.armedSectionId ? this.armedSectionId : this.heardSectionId()))
    const bpm = section?.bpm ?? 120

    if (this.master) {
      if (!hasAutomation(section?.bus?.automation?.['master.level'])) {
        scheduleParam(this.master.gain, this.project.master, time, false, 0.02)
      }
    }
    if (this.songBus) {
      const bus = section?.bus ?? openRack(1)
      this.applyRackLive(this.songBus, { ...bus, level: 1 }, time, bpm)
    }
    for (const [id, strip] of this.groupBuses) {
      const rack = section?.groups?.[id] ?? openRack(1)
      this.applyRackLive(strip, rack, time, bpm)
    }
    for (const instrument of this.project.instruments) {
      const strip = this.strips.get(instrument.id)
      if (!strip) continue
      const rack = section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument)
      this.applyRackLive(strip, rack, time, bpm)
    }
  }

  private applyRackLive(strip: Strip, rack: Rack, time: number, bpm: number): void {
    const auto = rack.automation
    if (!hasAutomation(auto?.['mix.level'])) {
      scheduleParam(strip.gain.gain, rack.level, time, false, 0.02)
    }
    if (!hasAutomation(auto?.['mix.pan'])) {
      scheduleParam(strip.pan.pan, rack.pan, time, false, 0.02)
    }
    const inserts = liveInserts(rack)
    const eq = inserts.includes('eq')
    if (eq) {
      if (!hasAutomation(auto?.['eq.low'])) scheduleParam(strip.low.gain, rack.eq.low, time, false, 0.02)
      if (!hasAutomation(auto?.['eq.mid'])) scheduleParam(strip.mid.gain, rack.eq.mid, time, false, 0.02)
      if (!hasAutomation(auto?.['eq.high'])) scheduleParam(strip.high.gain, rack.eq.high, time, false, 0.02)
    } else {
      scheduleParam(strip.low.gain, 0, time, false, 0.02)
      scheduleParam(strip.mid.gain, 0, time, false, 0.02)
      scheduleParam(strip.high.gain, 0, time, false, 0.02)
    }
    const grid = this.playing && this.armedSectionId ? { origin: this.gridOrigin } : null
    applyFx(strip.fx, rack.fx, inserts, time, bpm, false, grid)
    const moverOn = inserts.includes('mover') && rack.fx.mover.depth > 0.001
    scheduleParam(strip.moverRate, syncHz(rack.fx.mover.rate, bpm), time, false, 0.05)
    scheduleParam(strip.moverDepth, moverOn ? rack.fx.mover.depth : 0, time, false, 0.04)
  }

  private armSection(time: number, cursor: PlaybackCursor): void {
    if (!this.ctx) return
    const node = this.project.arrangement.find((item) => item.id === cursor.nodeId)
    const sectionId = node?.sectionId ?? ''
    if (!sectionId || sectionId === this.armedSectionId) return
    this.armedSectionId = sectionId
    this.gridOrigin = time
    const at = Math.max(this.ctx.currentTime + 0.001, time - 0.005)
    this.applyAllMix(at, true)
    for (const voice of this.voices.values()) voice.rearticulate?.()
  }

  private applyStepMix(time: number, cursor: PlaybackCursor, duration: number): void {
    if (!this.ctx) return
    const node = this.project.arrangement.find((item) => item.id === cursor.nodeId)
    const section = node ? this.project.sections.find((item) => item.id === node.sectionId) : null
    if (!section || !sectionHasMotion(section)) return
    const bpm = section.bpm ?? 120
    const step = cursor.step
    if (this.songBus && section.bus && rackHasMotion(section.bus)) {
      const bus = section.bus
      this.applyRackMotion(this.songBus, { ...applyRackAutomation(bus, step), level: 1 }, { ...applyRackAutomation(bus, step + 1), level: 1 }, time, duration, bpm)
    }
    for (const [id, strip] of this.groupBuses) {
      const rack = section.groups?.[id]
      if (rack && rackHasMotion(rack)) {
        this.applyRackMotion(strip, applyRackAutomation(rack, step), applyRackAutomation(rack, step + 1), time, duration, bpm)
      }
    }
    for (const instrument of this.project.instruments) {
      const strip = this.strips.get(instrument.id)
      if (!strip) continue
      const rack = section.slots[instrument.id]?.rack
      if (rack && rackHasMotion(rack)) {
        this.applyRackMotion(strip, applyRackAutomation(rack, step), applyRackAutomation(rack, step + 1), time, duration, bpm)
      }
    }
    if (this.master) {
      const auto = section.bus?.automation?.['master.level']
      if (hasAutomation(auto)) {
        rampParam(
          this.master.gain,
          lerpAutomation(auto, step, this.project.master, 'master.level'),
          lerpAutomation(auto, step + 1, this.project.master, 'master.level'),
          time,
          duration,
        )
      }
    }
  }

  private applyRack(strip: Strip, rack: Rack, time: number, bpm: number, snap = false): void {
    const mix: Mix = { level: rack.level, pan: rack.pan, eq: rack.eq }
    const inserts = liveInserts(rack)
    const grid = this.playing && this.armedSectionId ? { origin: this.gridOrigin } : null
    applyMix(strip, mix, time, inserts.includes('eq'), rack.fx, inserts, bpm, snap, grid)
  }

  private applyRackMotion(strip: Strip, from: Rack, to: Rack, time: number, duration: number, bpm: number): void {
    const inserts = liveInserts(from)
    const eq = inserts.includes('eq')
    const grid = this.playing && this.armedSectionId ? { origin: this.gridOrigin } : null
    rampParam(strip.low.gain, eq ? from.eq.low : 0, eq ? to.eq.low : 0, time, duration)
    rampParam(strip.mid.gain, eq ? from.eq.mid : 0, eq ? to.eq.mid : 0, time, duration)
    rampParam(strip.high.gain, eq ? from.eq.high : 0, eq ? to.eq.high : 0, time, duration)
    rampParam(strip.pan.pan, from.pan, to.pan, time, duration)
    rampParam(strip.gain.gain, from.level, to.level, time, duration)
    applyFx(strip.fx, from.fx, inserts, time, bpm, true, grid)
    const moverFrom = inserts.includes('mover') && from.fx.mover.depth > 0.001
    const moverTo = inserts.includes('mover') && to.fx.mover.depth > 0.001
    rampParam(strip.moverRate, syncHz(from.fx.mover.rate, bpm), syncHz(to.fx.mover.rate, bpm), time, duration)
    rampParam(strip.moverDepth, moverFrom ? from.fx.mover.depth : 0, moverTo ? to.fx.mover.depth : 0, time, duration)
  }

  private queueTick(): void {
    if (this.timer !== null || !this.playing) return
    this.timer = window.setTimeout(this.tick, TICK_MS)
  }

  private tick = (): void => {
    this.timer = null
    if (!this.playing || !this.ctx) return
    const now = this.ctx.currentTime
    if (this.nextNoteTime < now - 0.05) this.nextNoteTime = now + 0.02
    const batch = takeSteps(
      this.project,
      this.cursor,
      this.nextNoteTime,
      now + SCHEDULE_AHEAD_SECONDS,
      this.queuedNodeId,
      this.cueMode,
    )
    for (const step of batch.steps) {
      this.armSection(step.time, step.cursor)
      this.applyStepMix(step.time, step.cursor, step.duration)
      this.fireStep(step.time, step.cursor, step.duration)
    }
    this.cursor = batch.cursor
    this.queuedNodeId = batch.queuedNodeId
    this.nextNoteTime = batch.nextNoteTime
    this.displayQueue = this.displayQueue.filter((event) => event.time > now - 1)
    if (batch.stopped) {
      this.playing = false
      this.armedSectionId = ''
      this.applyAllMix()
      return
    }
    this.queueTick()
  }

  private fireStep(time: number, cursor: PlaybackCursor, duration: number): void {
    const node = this.project.arrangement.find((item) => item.id === cursor.nodeId)
    if (!node) return
    const section = this.project.sections.find((item) => item.id === node.sectionId)
    if (!section) return
    this.displayQueue.push({ step: cursor.step, time, duration, nodeId: cursor.nodeId })
    const anyTrackSolo = this.project.instruments.some((item) => section.slots[item.id]?.solo)
    const anyGroupSolo = this.project.groups.some((group) => groupSlot(section, group.id).solo)
    for (const instrument of this.project.instruments) {
      const slot = section.slots[instrument.id]
      if (!slot) continue
      const group = this.project.groups.find((item) => item.instrumentIds.includes(instrument.id))
      const flags = group ? groupSlot(section, group.id) : { enabled: true, solo: false }
      if (!slot.solo) {
        if (anyTrackSolo && !anyGroupSolo) continue
        if (anyGroupSolo && !flags.solo) continue
        if (!slot.enabled) continue
        if (!flags.enabled) continue
      }
      const trackRack = applyRackAutomation(slot.rack ?? rackFromInstrument(instrument), cursor.step)
      const groupRack = group ? applyRackAutomation(section.groups?.[group.id] ?? openRack(1), cursor.step) : undefined
      const busRack = applyRackAutomation(section.bus ?? openRack(1), cursor.step)
      const chance = rackChance(trackRack) * rackChance(groupRack) * rackChance(busRack)
      if (chance < 0.999 && Math.random() >= chance) continue
      const pattern = instrument.patterns.find((item) => item.id === slot.patternId)
      if (!pattern) continue
      const voice = this.voices.get(instrument.id)
      if (!voice) continue
      const envelope = insertOn(instrument, 'adsr') ? instrument.envelope : null
      const semis = shiftSemis(trackRack) + shiftSemis(groupRack) + shiftSemis(busRack)
      const play = (pitch: number, velocity: number, sound: TriggerSound, gate?: number) => {
        voice.trigger(time, Math.max(0, Math.min(127, Math.round(pitch + semis))), velocity, sound, envelope, gate)
      }
      const step = pattern.steps[cursor.step]
      if (step?.on && step.pitch != null && instrument.voice.type !== '808') {
        play(step.pitch, step.velocity, shapedSound(instrument))
        continue
      }
      if (instrument.voice.type !== '808' && pattern.notes.length > 0) {
        const sound = shapedSound(instrument)
        for (const note of pattern.notes) {
          if (note.start < cursor.step || note.start >= cursor.step + 1) continue
          play(note.pitch, note.velocity, sound, gateSeconds(this.project, cursor, note.duration))
        }
        continue
      }
      if (!step?.on) continue
      if (instrument.voice.type === '808') {
        const sound = insertOn(instrument, 'processing') ? (instrument.voice.sound ?? DEFAULT_SOUND) : DEFAULT_SOUND
        play(
          drumNote(instrument.voice.drum),
          accentVelocity(
            section.accent,
            lerpAutomation(section.bus?.automation?.['master.accent'], cursor.step, this.project.accentAmount, 'master.accent'),
            cursor.step,
            step.velocity,
          ),
          sound,
        )
        continue
      }
      if (instrument.voice.type === 'bass' || instrument.voice.type === 'lead') {
        const note = (step.pitch ?? bassMidi(section.key, step.degree)) + (instrument.voice.type === 'lead' && step.pitch == null ? 12 : 0)
        play(note, step.velocity, shapedSound(instrument))
        continue
      }
      const sound = shapedSound(instrument)
      for (const note of chordMidis(section.key, step.degree, step.quality)) {
        play(note, step.velocity, sound)
      }
    }
  }

  private readLevels(): StereoLevel {
    return {
      left: peak(this.meterLeft, this.levelLeft),
      right: peak(this.meterRight, this.levelRight),
    }
  }

  private readActivity(): Record<string, number> {
    const levels: Record<string, number> = {}
    for (const [id, strip] of this.strips) {
      const value = peak(strip.meter, strip.meterData)
      const previous = this.activity.get(id) ?? 0
      const next = value >= previous ? value : previous * 0.82
      this.activity.set(id, next)
      levels[id] = next
    }
    for (const [id, strip] of this.groupBuses) {
      const value = peak(strip.meter, strip.meterData)
      const previous = this.activity.get(id) ?? 0
      const next = value >= previous ? value : previous * 0.82
      this.activity.set(id, next)
      levels[id] = next
    }
    return levels
  }
}

function sectionHasMotion(section: Section): boolean {
  if (rackHasMotion(section.bus)) return true
  for (const rack of Object.values(section.groups ?? {})) {
    if (rackHasMotion(rack)) return true
  }
  for (const slot of Object.values(section.slots)) {
    if (rackHasMotion(slot.rack)) return true
  }
  return false
}

function rackHasMotion(rack?: Rack): boolean {
  if (!rack?.automation) return false
  for (const steps of Object.values(rack.automation)) {
    if (hasAutomation(steps)) return true
  }
  return false
}

function peak(analyser: AnalyserNode | null, data: Uint8Array<ArrayBuffer> | null): number {
  if (!analyser || !data) return SILENT.left
  analyser.getByteTimeDomainData(data)
  let high = 0
  for (const sample of data) {
    const value = Math.abs(sample - 128) / 128
    if (value > high) high = value
  }
  return high
}
