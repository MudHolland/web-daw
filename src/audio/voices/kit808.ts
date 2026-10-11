import type { DrumId, DrumKit, Envelope, SoundParams } from '../../model/project.ts'
import { shapeGain } from '../envelope.ts'
import type { Voice } from '../types.ts'

const DRUM_NOTES: Record<DrumId, number> = {
  kick: 36,
  snare: 38,
  clap: 39,
  hatClosed: 42,
  hatOpen: 46,
  tom: 45,
  lowTom: 41,
  conga: 64,
  rim: 37,
  cowbell: 56,
  clave: 76,
  shaker: 70,
  cymbal: 49,
}

export function drumNote(drum: DrumId): number {
  return DRUM_NOTES[drum]
}

export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  return buffer
}

function shapedOutput(ctx: AudioContext, destination: AudioNode, time: number, envelope: Envelope): GainNode {
  const gain = ctx.createGain()
  shapeGain(gain.gain, time, 1, envelope)
  gain.connect(destination)
  return gain
}

function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

function shaped(base: number, control: number): number {
  const amount = Math.min(1, Math.max(0, control))
  return base * (0.25 + amount * 1.5)
}

function playTone(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  options: {
    type: OscillatorType
    frequency: number
    endFrequency?: number
    pitchTime?: number
    gain: number
    decay: number
  },
): void {
  if (options.decay <= 0) return
  const osc = ctx.createOscillator()
  osc.type = options.type
  const startHz = Math.max(1, options.frequency)
  osc.frequency.setValueAtTime(startHz, time)
  if (options.endFrequency !== undefined && options.pitchTime && options.pitchTime > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.endFrequency), time + options.pitchTime)
  }
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(0.001, options.gain), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + options.decay)
  osc.connect(gain)
  gain.connect(destination)
  remember(live, osc, [gain])
  osc.start(time)
  osc.stop(time + options.decay + 0.05)
}

function playNoise(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  options: {
    filter: BiquadFilterType
    frequency: number
    q?: number
    gain: number
    decay: number
  },
): void {
  if (options.decay <= 0) return
  const source = ctx.createBufferSource()
  source.buffer = noise
  source.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = options.filter
  filter.frequency.setValueAtTime(Math.max(1, options.frequency), time)
  filter.Q.value = options.q ?? 0.7
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(0.001, options.gain), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + options.decay)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  remember(live, source, [filter, gain])
  source.start(time)
  source.stop(time + options.decay + 0.05)
}

function remember(live: AudioScheduledSourceNode[], source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  live.push(source)
  source.onended = () => {
    const index = live.indexOf(source)
    if (index >= 0) live.splice(index, 1)
    source.disconnect()
    for (const node of nodes) node.disconnect()
  }
}

function triggerKick(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  note: number,
  velocity: number,
  sound: SoundParams,
): void {
  const end = Math.max(40, midiToHz(note))
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(end * 6, sound.tone),
    endFrequency: end,
    pitchTime: 0.055,
    gain: 0.95 * velocity,
    decay: shaped(0.45, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: 1200,
    gain: shaped(0.16 * velocity, sound.snap),
    decay: 0.012,
  })
}

function triggerSnare(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(196, sound.tone),
    gain: 0.32 * velocity,
    decay: shaped(0.12, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(1800, sound.tone),
    gain: shaped(0.48 * velocity, sound.snap),
    decay: shaped(0.16, sound.decay),
  })
}

function triggerClap(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  for (const offset of [0, 0.011, 0.022]) {
    playNoise(ctx, noise, live, destination, time + offset, {
      filter: 'bandpass',
      frequency: shaped(1400, sound.tone),
      q: 0.6,
      gain: shaped(0.62 * velocity, sound.snap),
      decay: shaped(0.02, sound.decay),
    })
  }
  playNoise(ctx, noise, live, destination, time + 0.03, {
    filter: 'bandpass',
    frequency: shaped(1100, sound.tone),
    q: 0.5,
    gain: 0.8 * velocity,
    decay: shaped(0.16, sound.decay),
  })
}

function triggerHat(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  open: boolean,
  sound: SoundParams,
): void {
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(open ? 4800 : 5800, sound.tone),
    q: 0.7,
    gain: shaped((open ? 0.62 : 0.85) * velocity, sound.snap),
    decay: shaped(open ? 0.38 : 0.06, sound.decay),
  })
}

function triggerTom(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  note: number,
  velocity: number,
  sound: SoundParams,
  decayScale = 1,
): void {
  const end = Math.max(50, midiToHz(note))
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(end * 2.4, sound.tone),
    endFrequency: end,
    pitchTime: 0.1,
    gain: 0.7 * velocity,
    decay: shaped(0.38 * decayScale, sound.decay),
  })
}

function triggerRim(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(455, sound.tone),
    gain: shaped(0.55 * velocity, sound.snap),
    decay: shaped(0.05, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(1480, sound.tone),
    gain: 0.22 * velocity,
    decay: shaped(0.03, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: 1800,
    gain: shaped(0.35 * velocity, sound.snap),
    decay: shaped(0.04, sound.decay),
  })
}

function triggerConga(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(340, sound.tone),
    endFrequency: 196,
    pitchTime: 0.08,
    gain: 0.7 * velocity,
    decay: shaped(0.22, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: 2200,
    gain: shaped(0.18 * velocity, sound.snap),
    decay: 0.015,
  })
}

function triggerClave(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'square',
    frequency: shaped(2450, sound.tone),
    gain: shaped(0.18 * velocity, sound.snap),
    decay: shaped(0.035, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(1850, sound.tone),
    gain: 0.28 * velocity,
    decay: shaped(0.05, sound.decay),
  })
}

function triggerShaker(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  for (const offset of [0, 0.018]) {
    playNoise(ctx, noise, live, destination, time + offset, {
      filter: 'highpass',
      frequency: shaped(7000, sound.tone),
      gain: shaped(0.4 * velocity, sound.snap),
      decay: shaped(0.07, sound.decay),
    })
  }
}

function triggerCymbal(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(5200, sound.tone),
    gain: shaped(0.42 * velocity, sound.snap),
    decay: shaped(0.85, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(3400, sound.tone),
    q: 2.4,
    gain: 0.28 * velocity,
    decay: shaped(0.55, sound.decay),
  })
}

function triggerCowbell(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  const decay = shaped(0.18, sound.decay)
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(shaped(850, sound.tone), time)
  filter.Q.value = 5
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(0.001, shaped(0.5 * velocity, sound.snap)), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
  filter.connect(gain)
  gain.connect(destination)

  const oscillators: OscillatorNode[] = []
  for (const frequency of [587, 845]) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(frequency, time)
    osc.connect(filter)
    osc.start(time)
    osc.stop(time + decay + 0.05)
    live.push(osc)
    oscillators.push(osc)
  }
  const tail = oscillators[1]
  if (!tail) return
  tail.onended = () => {
    for (const source of oscillators) {
      const index = live.indexOf(source)
      if (index >= 0) live.splice(index, 1)
      source.disconnect()
    }
    filter.disconnect()
    gain.disconnect()
  }
}

const HAT_SQUARES = [205.3, 304.4, 369.6, 522.7, 540, 800]

function playCluster(
  ctx: AudioContext,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  partials: number[],
  gainAmount: number,
  decay: number,
  highpass = 2800,
): void {
  if (decay <= 0 || partials.length === 0) return
  const filter = ctx.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(highpass, time)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(Math.max(0.001, gainAmount), time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + decay)
  filter.connect(gain)
  gain.connect(destination)
  const oscillators: OscillatorNode[] = []
  for (const frequency of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(Math.max(1, frequency), time)
    osc.connect(filter)
    osc.start(time)
    osc.stop(time + decay + 0.05)
    live.push(osc)
    oscillators.push(osc)
  }
  const tail = oscillators[oscillators.length - 1]
  if (!tail) return
  tail.onended = () => {
    for (const source of oscillators) {
      const index = live.indexOf(source)
      if (index >= 0) live.splice(index, 1)
      source.disconnect()
    }
    filter.disconnect()
    gain.disconnect()
  }
}

function trigger909Kick(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  note: number,
  velocity: number,
  sound: SoundParams,
): void {
  const end = Math.max(48, midiToHz(note) * 0.9)
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(end * 2.35, sound.tone),
    endFrequency: end,
    pitchTime: 0.038,
    gain: 1.08 * velocity,
    decay: shaped(0.36, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(2100, sound.tone),
    gain: shaped(0.14 * velocity, sound.snap),
    decay: 0.004,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: 2800,
    gain: shaped(0.07 * velocity, sound.snap),
    decay: 0.01,
  })
}

function trigger909Snare(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(185, sound.tone),
    gain: 0.34 * velocity,
    decay: shaped(0.085, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(330, sound.tone),
    gain: 0.2 * velocity,
    decay: shaped(0.1, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(1750, sound.tone),
    q: 1.05,
    gain: 0.42 * velocity,
    decay: shaped(0.12, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(6200, sound.tone),
    gain: shaped(0.48 * velocity, sound.snap),
    decay: shaped(0.055, sound.decay),
  })
}

function trigger909Clap(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  for (const offset of [0, 0.008, 0.016, 0.028]) {
    playNoise(ctx, noise, live, destination, time + offset, {
      filter: 'bandpass',
      frequency: shaped(1900, sound.tone),
      q: 1.2,
      gain: shaped(0.5 * velocity, sound.snap),
      decay: 0.016,
    })
  }
  playNoise(ctx, noise, live, destination, time + 0.034, {
    filter: 'highpass',
    frequency: shaped(1600, sound.tone),
    gain: 0.72 * velocity,
    decay: shaped(0.1, sound.decay),
  })
}

function trigger909Hat(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  open: boolean,
  sound: SoundParams,
): void {
  const decay = shaped(open ? 0.28 : 0.048, sound.decay)
  const tune = 0.85 + sound.tone * 0.4
  playCluster(
    ctx,
    live,
    destination,
    time,
    HAT_SQUARES.map((hz) => hz * tune),
    shaped((open ? 0.22 : 0.3) * velocity, sound.snap),
    decay,
    open ? 6200 : 7800,
  )
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(open ? 7200 : 9000, sound.tone),
    gain: shaped((open ? 0.14 : 0.2) * velocity, sound.snap),
    decay: decay * 0.55,
  })
}

function trigger909Tom(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  note: number,
  velocity: number,
  sound: SoundParams,
  decayScale = 1,
): void {
  const end = Math.max(72, midiToHz(note) * 1.08)
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(end * 2.1, sound.tone),
    endFrequency: end,
    pitchTime: 0.028,
    gain: 0.78 * velocity,
    decay: shaped(0.2 * decayScale, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(end * 6, sound.tone),
    q: 1.4,
    gain: shaped(0.12 * velocity, sound.snap),
    decay: 0.018,
  })
}

function trigger909Rim(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(455, sound.tone),
    gain: shaped(0.38 * velocity, sound.snap),
    decay: 0.018,
  })
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(980, sound.tone),
    gain: 0.16 * velocity,
    decay: 0.014,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: 2400,
    q: 2.2,
    gain: shaped(0.28 * velocity, sound.snap),
    decay: 0.016,
  })
}

function trigger909Cymbal(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  const decay = shaped(0.95, sound.decay)
  const tune = 0.9 + sound.tone * 0.3
  playCluster(
    ctx,
    live,
    destination,
    time,
    [...HAT_SQUARES, 1049.5, 1236].map((hz) => hz * tune),
    0.18 * velocity,
    decay,
    5200,
  )
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(6800, sound.tone),
    gain: shaped(0.2 * velocity, sound.snap),
    decay: decay * 0.7,
  })
}

function triggerRockKick(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  const end = shaped(56, sound.tone)
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: end * 3.2,
    endFrequency: end,
    pitchTime: 0.09,
    gain: 1.05 * velocity,
    decay: shaped(0.42, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: end * 0.98,
    gain: 0.35 * velocity,
    decay: shaped(0.28, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(2800, sound.tone),
    q: 1.6,
    gain: shaped(0.32 * velocity, sound.snap),
    decay: 0.018,
  })
}

function triggerRockSnare(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(186, sound.tone),
    gain: 0.42 * velocity,
    decay: shaped(0.1, sound.decay),
  })
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(328, sound.tone),
    gain: 0.16 * velocity,
    decay: shaped(0.14, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(900, sound.tone),
    q: 0.8,
    gain: 0.28 * velocity,
    decay: shaped(0.12, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(2400, sound.tone),
    gain: shaped(0.55 * velocity, sound.snap),
    decay: shaped(0.22, sound.decay),
  })
}

function triggerRockHat(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  open: boolean,
  sound: SoundParams,
): void {
  const decay = shaped(open ? 0.32 : 0.04, sound.decay)
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(open ? 6200 : 7800, sound.tone),
    gain: shaped((open ? 0.28 : 0.34) * velocity, sound.snap),
    decay,
  })
  playTone(ctx, live, destination, time, {
    type: 'square',
    frequency: shaped(open ? 5400 : 6800, sound.tone),
    gain: 0.04 * velocity,
    decay: Math.min(0.05, decay),
  })
}

function triggerRockTom(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  note: number,
  velocity: number,
  sound: SoundParams,
  decayScale = 1,
): void {
  const end = Math.max(70, midiToHz(note))
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(end * 2.4, sound.tone),
    endFrequency: end,
    pitchTime: 0.08,
    gain: 0.8 * velocity,
    decay: shaped(0.36 * decayScale, sound.decay),
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: end * 4,
    q: 1.2,
    gain: shaped(0.16 * velocity, sound.snap),
    decay: 0.03,
  })
}

function triggerRockStick(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  playTone(ctx, live, destination, time, {
    type: 'triangle',
    frequency: shaped(420, sound.tone),
    gain: shaped(0.35 * velocity, sound.snap),
    decay: 0.028,
  })
  playTone(ctx, live, destination, time, {
    type: 'sine',
    frequency: shaped(980, sound.tone),
    gain: 0.18 * velocity,
    decay: 0.02,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: 2200,
    q: 2,
    gain: 0.22 * velocity,
    decay: 0.016,
  })
}

function triggerRockCrash(
  ctx: AudioContext,
  noise: AudioBuffer,
  live: AudioScheduledSourceNode[],
  destination: AudioNode,
  time: number,
  velocity: number,
  sound: SoundParams,
): void {
  const decay = shaped(1.45, sound.decay)
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(9000, sound.tone),
    gain: shaped(0.38 * velocity, sound.snap),
    decay: 0.07,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(6200, sound.tone),
    q: 0.7,
    gain: 0.28 * velocity,
    decay: decay * 0.4,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'bandpass',
    frequency: shaped(3400, sound.tone),
    q: 0.5,
    gain: 0.22 * velocity,
    decay: decay * 0.75,
  })
  playNoise(ctx, noise, live, destination, time, {
    filter: 'highpass',
    frequency: shaped(2400, sound.tone),
    gain: 0.16 * velocity,
    decay,
  })
}

export function create808Voice(ctx: AudioContext, drum: DrumId, noise: AudioBuffer, kit: DrumKit = '808'): Voice {
  let destination: AudioNode | null = null
  const live: AudioScheduledSourceNode[] = []

  return {
    connect(next) {
      destination = next
    },
    trigger(time, note, velocity, sound, envelope) {
      if (!destination || !('snap' in sound)) return
      const output = envelope ? shapedOutput(ctx, destination, time, envelope) : destination
      const level = Math.min(1.35, Math.max(0, velocity))
      if (kit === 'rock') {
        switch (drum) {
          case 'kick':
            triggerRockKick(ctx, noise, live, output, time, level, sound)
            return
          case 'snare':
            triggerRockSnare(ctx, noise, live, output, time, level, sound)
            return
          case 'hatClosed':
            triggerRockHat(ctx, noise, live, output, time, level, false, sound)
            return
          case 'hatOpen':
            triggerRockHat(ctx, noise, live, output, time, level, true, sound)
            return
          case 'tom':
            triggerRockTom(ctx, noise, live, output, time, note, level, sound)
            return
          case 'lowTom':
            triggerRockTom(ctx, noise, live, output, time, note, level, sound, 1.35)
            return
          case 'rim':
            triggerRockStick(ctx, noise, live, output, time, level, sound)
            return
          case 'cymbal':
            triggerRockCrash(ctx, noise, live, output, time, level, sound)
            return
          default:
            break
        }
      }
      if (kit === '909') {
        switch (drum) {
          case 'kick':
            trigger909Kick(ctx, noise, live, output, time, note, level, sound)
            return
          case 'snare':
            trigger909Snare(ctx, noise, live, output, time, level, sound)
            return
          case 'clap':
            trigger909Clap(ctx, noise, live, output, time, level, sound)
            return
          case 'hatClosed':
            trigger909Hat(ctx, noise, live, output, time, level, false, sound)
            return
          case 'hatOpen':
            trigger909Hat(ctx, noise, live, output, time, level, true, sound)
            return
          case 'tom':
            trigger909Tom(ctx, noise, live, output, time, note, level, sound)
            return
          case 'lowTom':
            trigger909Tom(ctx, noise, live, output, time, note, level, sound, 1.6)
            return
          case 'rim':
            trigger909Rim(ctx, noise, live, output, time, level, sound)
            return
          case 'cymbal':
            trigger909Cymbal(ctx, noise, live, output, time, level, sound)
            return
          default:
            break
        }
      }
      switch (drum) {
        case 'kick':
          triggerKick(ctx, live, output, time, note, level, sound)
          break
        case 'snare':
          triggerSnare(ctx, noise, live, output, time, level, sound)
          break
        case 'clap':
          triggerClap(ctx, noise, live, output, time, level, sound)
          break
        case 'hatClosed':
          triggerHat(ctx, noise, live, output, time, level, false, sound)
          break
        case 'hatOpen':
          triggerHat(ctx, noise, live, output, time, level, true, sound)
          break
        case 'tom':
          triggerTom(ctx, live, output, time, note, level, sound)
          break
        case 'lowTom':
          triggerTom(ctx, live, output, time, note, level, sound, 1.5)
          break
        case 'conga':
          triggerConga(ctx, noise, live, output, time, level, sound)
          break
        case 'rim':
          triggerRim(ctx, noise, live, output, time, level, sound)
          break
        case 'cowbell':
          triggerCowbell(ctx, live, output, time, level, sound)
          break
        case 'clave':
          triggerClave(ctx, live, output, time, level, sound)
          break
        case 'shaker':
          triggerShaker(ctx, noise, live, output, time, level, sound)
          break
        case 'cymbal':
          triggerCymbal(ctx, noise, live, output, time, level, sound)
          break
      }
    },
    silence(time) {
      for (const source of live) {
        try {
          source.stop(time)
        } catch {
          // The source already finished.
        }
      }
      live.length = 0
    },
  }
}
