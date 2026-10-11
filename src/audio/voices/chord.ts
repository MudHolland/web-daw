import { chordCutoffHz } from '../../model/project.ts'
import { holdGain, shapeGain } from '../envelope.ts'
import type { Voice } from '../types.ts'

function waveType(wave: string | undefined): OscillatorType {
  if (wave === 'sine' || wave === 'square') return wave
  if (wave === 'saw') return 'sawtooth'
  return 'triangle'
}

export function createChordVoice(ctx: AudioContext): Voice {
  let destination: AudioNode | null = null
  const live: OscillatorNode[] = []

  return {
    connect(next) {
      destination = next
    },
    trigger(time, note, velocity, sound, envelope, gate) {
      if (!destination || !('cutoff' in sound) || 'glide' in sound) return
      const decay = 0.05 + sound.decay * 0.35
      const freq = 440 * 2 ** ((note - 69) / 12)
      const osc = ctx.createOscillator()
      osc.type = waveType(sound.wave)
      osc.frequency.setValueAtTime(freq, time)
      const body = ctx.createOscillator()
      body.type = osc.type
      body.frequency.setValueAtTime(freq * 1.006, time)
      const bodyGain = ctx.createGain()
      bodyGain.gain.setValueAtTime(0.22, time)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 2
      filter.frequency.setValueAtTime(chordCutoffHz(sound.cutoff), time)
      const gain = ctx.createGain()
      const level = Math.max(0.001, 0.16 * Math.min(1.2, velocity))
      const held = typeof gate === 'number' && gate > 0
      const length = held
        ? holdGain(gain.gain, time, level, envelope ?? null, gate)
        : envelope
          ? shapeGain(gain.gain, time, level, envelope)
          : decay
      if (!envelope && !held) {
        gain.gain.setValueAtTime(0.0001, time)
        gain.gain.exponentialRampToValueAtTime(level, time + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
      }
      osc.connect(filter)
      body.connect(bodyGain)
      bodyGain.connect(filter)
      filter.connect(gain)
      gain.connect(destination)
      osc.start(time)
      body.start(time)
      osc.stop(time + length + 0.04)
      body.stop(time + length + 0.04)
      live.push(osc, body)
      osc.onended = () => {
        const index = live.indexOf(osc)
        if (index >= 0) live.splice(index, 1)
      }
      body.onended = () => {
        const index = live.indexOf(body)
        if (index >= 0) live.splice(index, 1)
      }
    },
    silence(time) {
      for (const osc of live) {
        try {
          osc.stop(time)
        } catch {
          /* already stopped */
        }
      }
      live.length = 0
    },
  }
}
