/** Linear amplitude at +6 dB. */
export const GAIN_MAX = 10 ** (6 / 20)

/** Fader throw (0–1) where unity / 0 dB sits. */
export const GAIN_UNITY_POS = 0.75

const TAPER = 1.5
const SILENCE = 1e-4

export function gainToDb(gain: number): number {
  if (gain <= SILENCE) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(gain)
}

export function dbToGain(db: number): number {
  if (!Number.isFinite(db)) return 0
  return 10 ** (db / 20)
}

export function formatGainDb(gain: number): string {
  const db = gainToDb(gain)
  if (!Number.isFinite(db) || db <= -60) return '−∞'
  const rounded = Math.round(db * 10) / 10
  if (rounded === 0) return '0.0'
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}

/** Map fader throw 0–1 to linear amplitude. 0.75 → 0 dB, 1 → +6 dB. */
export function faderToGain(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  if (x <= 0.001) return 0
  if (x >= GAIN_UNITY_POS) {
    const db = ((x - GAIN_UNITY_POS) / (1 - GAIN_UNITY_POS)) * 6
    return Math.min(GAIN_MAX, dbToGain(db))
  }
  return dbToGain(20 * TAPER * Math.log10(x / GAIN_UNITY_POS))
}

export function gainToFader(gain: number): number {
  if (gain <= SILENCE) return 0
  const db = gainToDb(Math.min(GAIN_MAX, gain))
  if (db >= 0) return GAIN_UNITY_POS + (Math.min(6, db) / 6) * (1 - GAIN_UNITY_POS)
  return GAIN_UNITY_POS * 10 ** (db / (20 * TAPER))
}

export function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) return 0
  return Math.min(GAIN_MAX, Math.max(0, gain))
}
