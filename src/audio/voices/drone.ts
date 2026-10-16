import { bassCutoffHz, type BassSound, type Envelope } from '../../model/project.ts'
import type { Voice } from '../types.ts'

type DroneSound = BassSound & { glideSeconds?: number }

export function createDroneVoice(ctx: AudioContext): Voice {
  let destination: AudioNode | null = null
  let osc: OscillatorNode | null = null
  let body: OscillatorNode | null = null
  let filter: BiquadFilterNode | null = null
  let gain: GainNode | null = null
  let freq = 0
  let hard = false

  function ensure(time: number, sound: BassSound, velocity: number, envelope?: Envelope | null) {
    if (!destination) return
    if (!filter || !gain) {
      filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 0.6
      gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, time)
      filter.connect(gain)
      gain.connect(destination)
    }
    filter.frequency.setTargetAtTime(bassCutoffHz(sound.cutoff) * 0.65, time, 0.05)
    const level = Math.max(0.001, 0.2 * Math.min(1.2, velocity))
    const fresh = !osc || !body
    if (!osc || !body) {
      osc = ctx.createOscillator()
      body = ctx.createOscillator()
      body.type = 'sine'
      const tone = ctx.createGain()
      const sub = ctx.createGain()
      tone.gain.value = 0.55
      sub.gain.value = 0.5
      osc.connect(tone)
      body.connect(sub)
      tone.connect(filter)
      sub.connect(filter)
      osc.start(time)
      body.start(time)
      freq = 0
    }
    osc.type = waveType(sound.wave)
    if (fresh) {
      gain.gain.cancelScheduledValues(time)
      gain.gain.setValueAtTime(0.0001, time)
      if (envelope) {
        const attack = 0.004 + envelope.attack * 0.4
        const decay = 0.02 + envelope.decay * 0.55
        const sustain = Math.max(0.0002, level * Math.max(0.05, envelope.sustain))
        gain.gain.exponentialRampToValueAtTime(level, time + attack)
        gain.gain.exponentialRampToValueAtTime(sustain, time + attack + decay)
      } else {
        gain.gain.exponentialRampToValueAtTime(level, time + 0.08)
      }
    } else {
      const hold = envelope ? Math.max(0.0002, level * Math.max(0.05, envelope.sustain)) : level
      gain.gain.setTargetAtTime(hold, time, 0.08)
    }
  }

  function slide(when: number, note: number, seconds: number) {
    if (!osc || !body) return
    const target = midiFrequency(note)
    const now = Math.max(when, ctx.currentTime)
    const late = Math.max(0, now - when)
    const dur = Math.max(0, seconds - late)
    const from = Math.max(1, freq > 0 ? freq : target)
    for (const [node, goal] of [
      [osc, target],
      [body, target / 2],
    ] as const) {
      node.frequency.cancelScheduledValues(now)
      node.frequency.setValueAtTime(Math.max(1, node === body ? from / 2 : from), now)
      if (dur <= 0.012 || Math.abs(from - target) < 0.4) node.frequency.setValueAtTime(Math.max(1, goal), now)
      else node.frequency.exponentialRampToValueAtTime(Math.max(1, goal), now + dur)
    }
    freq = target
  }

  return {
    connect(next) {
      destination = next
    },
    trigger(time, note, velocity, sound, envelope) {
      if (!destination || !('cutoff' in sound)) return
      const tone = sound as DroneSound
      ensure(time, tone, velocity, envelope)
      const seconds = hard ? 0 : Math.max(0, tone.glideSeconds ?? 0)
      hard = false
      slide(time, note, seconds)
    },
    rearticulate() {
      hard = true
    },
    silence(time) {
      if (gain) {
        const at = Math.max(time, ctx.currentTime)
        gain.gain.cancelScheduledValues(at)
        gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), at)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
      }
      for (const node of [osc, body]) {
        if (!node) continue
        try {
          node.stop(time + 0.14)
        } catch {
          /* already stopped */
        }
      }
      osc = null
      body = null
      filter = null
      gain = null
      freq = 0
      hard = false
    },
  }
}

function waveType(wave: string | undefined): OscillatorType {
  if (wave === 'sine' || wave === 'triangle' || wave === 'square') return wave
  return 'sawtooth'
}

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}
