import { bassCutoffHz } from '../../model/project.ts'
import { holdGain, shapeGain } from '../envelope.ts'
import type { Voice } from '../types.ts'

export function createBassVoice(ctx: AudioContext): Voice {
  let destination: AudioNode | null = null
  let lastFreq = 0
  let lastTime = 0
  const live: OscillatorNode[] = []

  return {
    connect(next) {
      destination = next
    },
    trigger(time, note, velocity, sound, envelope, gate) {
      if (!destination || !('glide' in sound)) return
      const freq = midiFrequency(note)
      const glide = lastFreq > 0 && time - lastTime < 0.45 ? sound.glide * 0.09 : 0
      const decay = 0.06 + sound.decay * 0.5
      const osc = ctx.createOscillator()
      osc.type = waveType(sound.wave)
      if (glide > 0) {
        osc.frequency.setValueAtTime(Math.max(1, lastFreq), time)
        osc.frequency.exponentialRampToValueAtTime(freq, time + glide)
      } else {
        osc.frequency.setValueAtTime(freq, time)
      }
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 7
      filter.frequency.setValueAtTime(bassCutoffHz(sound.cutoff), time)
      const gain = ctx.createGain()
      const level = Math.max(0.001, 0.28 * Math.min(1.2, velocity))
      const held = typeof gate === 'number' && gate > 0
      const length = held
        ? holdGain(gain.gain, time, level, envelope ?? null, gate)
        : envelope
          ? shapeGain(gain.gain, time, level, envelope)
          : decay
      if (!envelope && !held) {
        gain.gain.setValueAtTime(0.0001, time)
        gain.gain.exponentialRampToValueAtTime(level, time + 0.012)
        gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
      }
      filter.frequency.exponentialRampToValueAtTime(180, time + length)
      osc.connect(filter)
      filter.connect(gain)
      gain.connect(destination)
      osc.start(time)
      osc.stop(time + length + 0.05)
      live.push(osc)
      osc.onended = () => {
        const index = live.indexOf(osc)
        if (index >= 0) live.splice(index, 1)
      }
      lastFreq = freq
      lastTime = time
    },
    rearticulate() {
      lastFreq = 0
      lastTime = 0
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
      lastFreq = 0
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
