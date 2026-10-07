import { bassMidi, chordMidis } from '../model/harmony.ts'
import { applyFx, createFx, scheduleParam, type FxChain, type FxGrid } from './effects.ts'
import {
  DEFAULT_BASS,
  DEFAULT_CHORD,
  DEFAULT_LEAD,
  DEFAULT_SOUND,
  insertOn,
  liveInserts,
  openRack,
  rackFromInstrument,
  syncHz,
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
  nodeId: string | null
  level: StereoLevel
  voices: Record<string, number>
  queuedNodeId: string | null
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
  const shaped = insertOn(instrument, 'processing')
  if (instrument.voice.type === 'lead') return shaped ? instrument.voice.sound : DEFAULT_LEAD
  if (instrument.voice.type === 'bass') return shaped ? instrument.voice.sound : DEFAULT_BASS
  return shaped && instrument.voice.type === 'chord' ? instrument.voice.sound : DEFAULT_CHORD
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
  private timer: number | null = null
  private playing = false
  private nextNoteTime = 0
  private cursor: PlaybackCursor = { nodeId: '', cycle: 0, step: 0 }
  private queuedNodeId: string | null = null
  private latchedQueue: string | null = null
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
    this.applyAllMix()
  }

  focus(sectionId: string): void {
    this.focusId = sectionId
    if (!this.ctx || this.playing) return
    this.applyAllMix()
  }

  play(fromNodeId?: string): void {
    const ctx = this.ensureContext()
    if (this.playing) return
    const nodeId =
      fromNodeId && this.project.arrangement.some((node) => node.id === fromNodeId)
        ? fromNodeId
        : this.project.startNodeId
    this.playing = true
    this.queuedNodeId = null
    this.latchedQueue = null
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
    if (nodeId === here || nodeId === this.queuedNodeId || nodeId === this.latchedQueue) {
      this.queuedNodeId = null
      this.latchedQueue = null
      return
    }
    this.queuedNodeId = nodeId
    this.latchedQueue = nodeId
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
    this.queuedNodeId = null
    this.latchedQueue = null
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
    const sound = insertOn(instrument, 'processing') ? instrument.voice.sound : DEFAULT_CHORD
    for (const note of chordMidis(section?.key ?? this.project.key, 0, 'triad')) play(note, 0.8, sound)
  }

  getPlayback(): PlaybackState {
    const level = this.readLevels()
    const voices = this.readActivity()
    if (!this.playing || !this.ctx) {
      return { playing: false, step: -1, nodeId: null, level, voices, queuedNodeId: null }
    }
    const now = this.ctx.currentTime
    let step = -1
    let nodeId: string | null = this.cursor.nodeId
    for (const event of this.displayQueue) {
      if (event.time <= now) {
        step = event.step
        nodeId = event.nodeId
      }
    }
    if (this.latchedQueue && nodeId === this.latchedQueue) this.latchedQueue = null
    const queuedNodeId = this.queuedNodeId ?? (this.latchedQueue && this.latchedQueue !== nodeId ? this.latchedQueue : null)
    return { playing: true, step, nodeId, level, voices, queuedNodeId }
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
      if (this.voices.has(instrument.id) || !this.master || !this.songBus) continue
      const strip = createStrip(ctx, instrument.mix, this.busInput(instrument.id), instrument.fx, instrument.inserts)
      const voice =
        instrument.voice.type === '808' && this.noise
          ? create808Voice(ctx, instrument.voice.drum, this.noise, instrument.voice.kit)
          : instrument.voice.type === 'bass' || instrument.voice.type === 'lead'
            ? createBassVoice(ctx)
            : instrument.voice.type === 'chord'
              ? createChordVoice(ctx)
              : null
      if (!voice) continue
      voice.connect(strip.input)
      this.strips.set(instrument.id, strip)
      this.voices.set(instrument.id, voice)
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
    if (this.songBus) this.applyRack(this.songBus, section?.bus ?? openRack(1), time, bpm, snap)
    for (const [id, strip] of this.groupBuses) this.applyRack(strip, section?.groups?.[id] ?? openRack(1), time, bpm, snap)
    for (const instrument of this.project.instruments) {
      const strip = this.strips.get(instrument.id)
      if (!strip) continue
      const rack = section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument)
      this.applyRack(strip, rack, time, bpm, snap)
    }
    if (this.master && !snap) this.master.gain.setTargetAtTime(this.project.master, time, 0.02)
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

  private applyRack(strip: Strip, rack: Rack, time: number, bpm: number, snap = false): void {
    const mix: Mix = { level: rack.level, pan: rack.pan, eq: rack.eq }
    const inserts = liveInserts(rack)
    const grid = this.playing && this.armedSectionId ? { origin: this.gridOrigin } : null
    applyMix(strip, mix, time, inserts.includes('eq'), rack.fx, inserts, bpm, snap, grid)
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
    )
    for (const step of batch.steps) {
      this.armSection(step.time, step.cursor)
      this.fireStep(step.time, step.cursor)
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

  private fireStep(time: number, cursor: PlaybackCursor): void {
    const node = this.project.arrangement.find((item) => item.id === cursor.nodeId)
    if (!node) return
    const section = this.project.sections.find((item) => item.id === node.sectionId)
    if (!section) return
    this.displayQueue.push({ step: cursor.step, time, nodeId: cursor.nodeId })
    const soloing = this.project.instruments.some((item) => section.slots[item.id]?.solo)
    for (const instrument of this.project.instruments) {
      const slot = section.slots[instrument.id]
      if (!slot?.enabled) continue
      if (soloing && !slot.solo) continue
      const pattern = instrument.patterns.find((item) => item.id === slot.patternId)
      if (!pattern) continue
      const voice = this.voices.get(instrument.id)
      if (!voice) continue
      const envelope = insertOn(instrument, 'adsr') ? instrument.envelope : null
      const semis = noteShift(this.project, section, instrument.id)
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
          accentVelocity(section.accent, this.project.accentAmount, cursor.step, step.velocity),
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
    return levels
  }
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
