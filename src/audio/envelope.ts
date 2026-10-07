import type { Envelope } from '../model/project.ts'

/** Holds a note for `gate` seconds, then releases. Returns the audible length. */
export function holdGain(
  gain: AudioParam,
  time: number,
  peak: number,
  envelope: Envelope | null,
  gate: number,
): number {
  const attack = envelope ? 0.004 + envelope.attack * 0.4 : 0.01
  const release = envelope ? 0.03 + envelope.release * 0.7 : 0.05
  const level = Math.max(0.0002, peak)
  const sustain = envelope ? Math.max(0.0002, level * Math.max(0.05, envelope.sustain)) : level
  const hold = Math.max(attack + 0.03, gate)
  gain.setValueAtTime(0.0001, time)
  gain.exponentialRampToValueAtTime(level, time + attack)
  if (envelope && Math.abs(sustain - level) > 0.0001) {
    const decay = 0.02 + envelope.decay * 0.55
    gain.exponentialRampToValueAtTime(sustain, time + Math.min(hold, attack + decay))
  }
  gain.setValueAtTime(Math.max(0.0002, sustain), time + hold)
  gain.exponentialRampToValueAtTime(0.0001, time + hold + release)
  return hold + release
}

/** Returns how long the hit stays audible. */
export function shapeGain(gain: AudioParam, time: number, peak: number, envelope: Envelope): number {
  const attack = 0.004 + envelope.attack * 0.4
  const decay = 0.02 + envelope.decay * 0.55
  const release = 0.03 + envelope.release * 0.7
  const level = Math.max(0.0001, peak)
  const sustain = Math.max(0.0001, level * envelope.sustain)
  gain.setValueAtTime(0.0001, time)
  gain.exponentialRampToValueAtTime(level, time + attack)
  gain.exponentialRampToValueAtTime(sustain, time + attack + decay)
  gain.exponentialRampToValueAtTime(0.0001, time + attack + decay + release)
  return attack + decay + release
}
