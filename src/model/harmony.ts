export const SCALE = [0, 2, 3, 5, 7, 8, 10] as const

export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export const KEY_SHIFTS = Array.from({ length: 25 }, (_, index) => index - 12)

const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const ROOTS: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
}

const LEGACY_CHORDS = [
  { name: 'i', degree: 0, third: 3, fifth: 7 },
  { name: 'VI', degree: 5, third: 4, fifth: 7 },
  { name: 'III', degree: 2, third: 4, fifth: 7 },
  { name: 'VII', degree: 6, third: 4, fifth: 7 },
  { name: 'iv', degree: 3, third: 3, fifth: 7 },
  { name: 'v', degree: 4, third: 3, fifth: 7 },
] as const

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'] as const

export const CHORD_QUALITIES = ['triad', '6', '7', 'maj7'] as const
export type ChordQuality = (typeof CHORD_QUALITIES)[number]

export const CHORD_TYPES = ['major', 'minor', '6', 'm6', '7', 'm7', 'maj7', 'mmaj7', 'sus2', 'sus4', 'dim', 'aug'] as const
export type ChordType = (typeof CHORD_TYPES)[number]

const CHORD_INTERVALS: Record<ChordType, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  mmaj7: [0, 3, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
}

export const CHORD_TYPE_LABEL: Record<ChordType, string> = {
  major: 'Major',
  minor: 'minor',
  '6': '6',
  m6: 'm6',
  '7': '7',
  m7: 'm7',
  maj7: 'maj7',
  mmaj7: 'mMaj7',
  sus2: 'sus2',
  sus4: 'sus4',
  dim: 'dim',
  aug: 'aug',
}

export function spellChord(root: string, type: ChordType): number[] {
  const base = 60 + keyRoot(root)
  return CHORD_INTERVALS[type].map((interval) => base + interval)
}

export const CHORD_TONES = [
  { label: '1', semi: 0 },
  { label: 'b2', semi: 1 },
  { label: '2', semi: 2 },
  { label: 'b3', semi: 3 },
  { label: '3', semi: 4 },
  { label: '4', semi: 5 },
  { label: 'b5', semi: 6 },
  { label: '5', semi: 7 },
  { label: '#5', semi: 8 },
  { label: '6', semi: 9 },
  { label: 'b7', semi: 10 },
  { label: '7', semi: 11 },
  { label: 'b9', semi: 13 },
  { label: '9', semi: 14 },
  { label: '#9', semi: 15 },
  { label: '11', semi: 17 },
  { label: '#11', semi: 18 },
  { label: 'b13', semi: 20 },
  { label: '13', semi: 21 },
] as const

export function spellIntervals(root: string, semitones: number[]): number[] {
  const base = 60 + keyRoot(root)
  return [...new Set(semitones)].sort((a, b) => a - b).map((semi) => base + semi)
}

export function nameChord(root: string, semitones: number[]): string {
  const tones = [...new Set(semitones)].sort((a, b) => a - b)
  const pc = new Set(tones.map((semi) => ((semi % 12) + 12) % 12))
  const has = (semi: number) => tones.includes(semi)
  const third = pc.has(3) ? 'minor' : pc.has(4) ? 'major' : 'none'
  const dim = third === 'minor' && pc.has(6) && !pc.has(7) && !pc.has(4)
  const aug = third === 'major' && pc.has(8) && !pc.has(7) && !pc.has(3)
  const sus2 = third === 'none' && pc.has(2) && pc.has(7)
  const sus4 = third === 'none' && pc.has(5) && pc.has(7)
  const dom = pc.has(10)
  const maj = pc.has(11)
  const dim7 = dim && pc.has(9) && !dom && !maj

  if (tones.length === 0) return root
  if (dim7) return `${root}dim7`
  if (dim && dom) return withColor(`${root}m7b5`, tones)
  if (dim && !dom && !maj) return withColor(`${root}dim`, tones)

  let core = root
  if (aug) core = `${root}aug`
  else if (sus2) core = `${root}sus2`
  else if (sus4) core = `${root}sus4`
  else if (third === 'minor') core = `${root}m`
  else if (third === 'none' && !sus2 && !sus4) return formula(root, tones)

  const add13 = has(21)
  const add11 = has(17)
  const add9 = has(14)
  if (add13 && dom && third === 'major') return withColor(`${root}13`, tones, [14, 17, 21])
  if (add13 && maj) return withColor(`${core}maj13`, tones, [14, 17, 21])
  if (add13 && dom && third === 'minor') return withColor(`${root}m13`, tones, [14, 17, 21])
  if (add11 && dom && third === 'none') return withColor(`${root}11`, tones, [14, 17])
  if (add9 && dom && third === 'major' && !add13) return withColor(`${root}9`, tones, [14])
  if (add9 && maj && !add13) return withColor(`${core}maj9`, tones, [14])
  if (add9 && dom && third === 'minor' && !add13) return withColor(`${root}m9`, tones, [14])
  if (dom && !maj) return withColor(`${core}7`, tones)
  if (maj && !dom) return withColor(`${core}maj7`, tones)
  if (add9 && !dom && !maj) return withColor(`${core}add9`, tones, [14])
  if (pc.has(9) && !dom && !maj && third !== 'none') return withColor(third === 'minor' ? `${root}m6` : `${root}6`, tones)
  if (core === root && third === 'none') return formula(root, tones)
  return withColor(core, tones)
}

function withColor(symbol: string, tones: number[], absorbed: number[] = []): string {
  const extra = tones.filter((semi) => semi > 11 && !absorbed.includes(semi))
  const labels = extra.flatMap((semi) => {
    const label = CHORD_TONES.find((tone) => tone.semi === semi)?.label
    return label ? [label] : []
  })
  const fifth = tones.some((semi) => semi % 12 === 6)
  const sharpFive = tones.some((semi) => semi % 12 === 8) && !symbol.includes('aug')
  const marks = [...(fifth && !symbol.includes('b5') && !symbol.includes('dim') ? ['b5'] : []), ...(sharpFive ? ['#5'] : []), ...labels]
  if (marks.length === 0) return symbol
  return `${symbol}(${marks.join(',')})`
}

function formula(root: string, tones: number[]): string {
  const labels = tones.flatMap((semi) => {
    const label = CHORD_TONES.find((tone) => tone.semi === semi)?.label
    return label ? [label] : []
  })
  return labels.length > 0 ? `${root} ${labels.join(' ')}` : root
}

export function keyRoot(key: string): number {
  return ROOTS[key] ?? 0
}

export function wrapPitchClass(semitones: number): number {
  return ((Math.round(semitones) % 12) + 12) % 12
}

export function keyAtOffset(songKey: string, offset: number): string {
  return KEYS[wrapPitchClass(keyRoot(songKey) + offset)] ?? 'C'
}

export function keyRegister(offset: number): number {
  return Math.trunc(Math.round(offset) / 12) * 12
}

export function inferKeyOffset(songKey: string, partKey: string): number {
  let delta = keyRoot(partKey) - keyRoot(songKey)
  if (delta > 6) delta -= 12
  if (delta < -6) delta += 12
  return delta
}

export function formatKeyShift(songKey: string, offset: number): string {
  const pc = wrapPitchClass(keyRoot(songKey) + offset)
  const name = pc === 6 ? `${SHARP_KEYS[pc]}/${FLAT_KEYS[pc]}` : FLAT_KEYS[pc]
  const mark = offset === 0 ? '0' : offset > 0 ? `+${offset}` : `${offset}`
  return `${name} (${mark})`
}

export function noteName(key: string, degree: number): string {
  const semi = (keyRoot(key) + SCALE[wrap(degree, SCALE.length)]) % 12
  return KEYS[semi] ?? 'C'
}

export function bassMidi(key: string, degree: number): number {
  return 36 + keyRoot(key) + SCALE[wrap(degree, SCALE.length)]
}

export function chordMidis(key: string, degree: number, quality: ChordQuality | null): number[] {
  if (quality == null) {
    const chord = LEGACY_CHORDS[wrap(degree, LEGACY_CHORDS.length)]
    const root = 48 + keyRoot(key) + SCALE[chord.degree]
    return [root, root + chord.third, root + chord.fifth]
  }
  const step = wrap(degree, MAJOR.length)
  const root = 48 + keyRoot(key) + MAJOR[step]
  const triad = step === 6 ? [0, 3, 6] : step === 1 || step === 2 || step === 5 ? [0, 3, 7] : [0, 4, 7]
  if (quality === 'triad') return triad.map((interval) => root + interval)
  if (quality === '6') return [...triad, 9].map((interval) => root + interval)
  if (quality === '7') return [...triad, 10].map((interval) => root + interval)
  return [...triad, 11].map((interval) => root + interval)
}

export function chordName(index: number): string {
  return LEGACY_CHORDS[wrap(index, LEGACY_CHORDS.length)].name
}

export function describeChord(key: string, degree: number, quality: ChordQuality | null): { roman: string; symbol: string } {
  if (quality == null) {
    const chord = LEGACY_CHORDS[wrap(degree, LEGACY_CHORDS.length)]
    const root = KEYS[(keyRoot(key) + SCALE[chord.degree]) % 12] ?? 'C'
    const minor = chord.third === 3
    return { roman: chord.name, symbol: minor ? `${root}m` : root }
  }
  const step = wrap(degree, MAJOR.length)
  const root = KEYS[(keyRoot(key) + MAJOR[step]) % 12] ?? 'C'
  const minor = step === 1 || step === 2 || step === 5
  const dim = step === 6
  const roman = ROMAN[step] ?? 'I'
  if (quality === 'triad') {
    return { roman: dim ? 'vii°' : roman, symbol: dim ? `${root}°` : minor ? `${root}m` : root }
  }
  if (quality === '6') {
    return { roman: dim ? 'vii°6' : `${roman}6`, symbol: dim ? `${root}°6` : minor ? `${root}m6` : `${root}6` }
  }
  if (quality === '7') {
    return { roman: dim ? 'viiø' : `${roman}7`, symbol: dim ? `${root}m7♭5` : minor ? `${root}m7` : `${root}7` }
  }
  return { roman: dim ? 'vii°maj7' : `${roman}maj7`, symbol: dim ? `${root}°maj7` : minor ? `${root}mmaj7` : `${root}maj7` }
}

export function degreeCount(kind: 'bass' | 'chord' | 'lead'): number {
  return kind === 'chord' ? LEGACY_CHORDS.length : SCALE.length
}

export function midiName(midi: number): string {
  const pc = ((Math.round(midi) % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return `${KEYS[pc] ?? 'C'}${octave}`
}

export function scaleTone(key: string, midi: number, scale: 'major' | 'minor'): boolean {
  const pc = ((Math.round(midi) % 12) + 12) % 12
  const root = keyRoot(key)
  const steps = scale === 'major' ? MAJOR : SCALE
  return steps.some((step) => (root + step) % 12 === pc)
}

export function diatonicCore(songKey: string, root: string): number[] | null {
  const interval = (keyRoot(root) - keyRoot(songKey) + 12) % 12
  const degree = MAJOR.findIndex((step) => step === interval)
  if (degree < 0) return null
  if (degree === 6) return [3, 6]
  if (degree === 1 || degree === 2 || degree === 5) return [3, 7]
  return [4, 7]
}

export const DEGREE_LABELS_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const
export const DEGREE_LABELS_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const

export function degreeLabels(scale: 'major' | 'minor'): readonly string[] {
  return scale === 'minor' ? DEGREE_LABELS_MINOR : DEGREE_LABELS_MAJOR
}

export function diatonicDegree(
  songKey: string,
  degree: number,
  scale: 'major' | 'minor' = 'major',
): { root: string; tones: number[] } {
  const steps = scale === 'minor' ? SCALE : MAJOR
  const step = wrap(degree, steps.length)
  const tonic = keyRoot(songKey)
  const rootPc = (tonic + steps[step]!) % 12
  const thirdPc = (tonic + steps[(step + 2) % steps.length]!) % 12
  const fifthPc = (tonic + steps[(step + 4) % steps.length]!) % 12
  return {
    root: KEYS[rootPc] ?? 'C',
    tones: [(thirdPc - rootPc + 12) % 12, (fifthPc - rootPc + 12) % 12],
  }
}

export function matchingDegree(
  songKey: string,
  root: string,
  tones: number[],
  scale: 'major' | 'minor' = 'major',
): number | null {
  const core = [...new Set(tones.filter((semi) => semi > 0 && semi <= 11))].sort((a, b) => a - b)
  if (core.length !== 2) return null
  for (let degree = 0; degree < 7; degree += 1) {
    const next = diatonicDegree(songKey, degree, scale)
    const nextCore = [...next.tones].sort((a, b) => a - b)
    if (next.root === root && nextCore[0] === core[0] && nextCore[1] === core[1]) return degree
  }
  return null
}

export function inKey(songKey: string, note: string, scale: 'major' | 'minor' = 'major'): boolean {
  return scaleTone(songKey, 60 + keyRoot(note), scale)
}

export function compactChordLabel(root: string, semitones: number[]): string {
  const pcs = [...new Set(semitones.map((semi) => ((semi % 12) + 12) % 12))]
  const pc = new Set(pcs)
  const color = semitones.some((semi) => semi > 11)
  const odd = pc.has(1) || pc.has(2) || pc.has(5) || pc.has(8) || pc.has(11) || pc.has(6)
  const has3 = pc.has(4)
  const hasb3 = pc.has(3)
  const has5 = pc.has(7)
  const has6 = pc.has(9)
  const hasb7 = pc.has(10)
  if (color || odd || (has3 && hasb3)) return `${root}*`
  if (has3 && hasb7 && !has6 && !hasb3) return `${root}7`
  if (has3 && has5 && has6 && !hasb7 && !hasb3) return `${root}6`
  if (has3 && has5 && !has6 && !hasb7 && !hasb3) return `${root}M`
  if (hasb3 && has5 && !has6 && !hasb7 && !has3) return `${root}m`
  return `${root}*`
}

export function transposeScale(key: string, origin: number, steps: number, low = 24, high = 84): number {
  const tones: number[] = []
  for (let midi = low; midi <= high; midi += 1) {
    if (scaleTone(key, midi, 'major')) tones.push(midi)
  }
  if (tones.length === 0) return Math.max(low, Math.min(high, origin))
  const exact = tones.indexOf(Math.round(origin))
  if (exact >= 0) return tones[clampIndex(exact + steps, tones.length)]
  if (steps >= 0) {
    const above = tones.findIndex((tone) => tone > origin)
    const start = above < 0 ? tones.length - 1 : above
    return tones[clampIndex(start + Math.max(0, steps - 1), tones.length)]
  }
  let below = 0
  for (let index = 0; index < tones.length; index += 1) {
    if (tones[index] < origin) below = index
  }
  return tones[clampIndex(below + steps + 1, tones.length)]
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index))
}

function wrap(value: number, length: number): number {
  return ((Math.round(value) % length) + length) % length
}
