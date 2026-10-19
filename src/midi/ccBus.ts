const STORAGE_KEY = 'loopanvil.midi-cc.v1'

export type MidiInputInfo = { id: string; name: string }

export type MidiMap = {
  portId: string
  channel: number
  cc: number
  targetId: string
}

type Target = {
  min: number
  max: number
  step: number
  apply: (value: number) => void
}

export type MidiSnap = {
  supported: boolean
  ready: boolean
  error: string | null
  inputs: MidiInputInfo[]
  portId: string | null
  learning: boolean
  lastTargetId: string | null
  lastMap: MidiMap | null
}

type Stored = {
  portId: string | null
  maps: MidiMap[]
}

const targets = new Map<string, Target>()
const listeners = new Set<() => void>()

let access: MIDIAccess | null = null
let maps: MidiMap[] = []
let portId: string | null = null
let lastTargetId: string | null = null
let learning = false
let error: string | null = null
let lastMap: MidiMap | null = null

function loadStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { portId: null, maps: [] }
    const parsed = JSON.parse(raw) as Stored
    return {
      portId: typeof parsed.portId === 'string' ? parsed.portId : null,
      maps: Array.isArray(parsed.maps) ? parsed.maps.filter(isMap) : [],
    }
  } catch {
    return { portId: null, maps: [] }
  }
}

function isMap(value: unknown): value is MidiMap {
  if (!value || typeof value !== 'object') return false
  const row = value as MidiMap
  return (
    typeof row.portId === 'string' &&
    typeof row.channel === 'number' &&
    typeof row.cc === 'number' &&
    typeof row.targetId === 'string'
  )
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ portId, maps } satisfies Stored))
}

const stored = loadStored()
portId = stored.portId
maps = stored.maps

let snap: MidiSnap = {
  supported: midiSupported(),
  ready: false,
  error: null,
  inputs: [],
  portId,
  learning: false,
  lastTargetId: null,
  lastMap: null,
}

function refreshSnap() {
  const inputs = listInputs()
  snap = {
    supported: midiSupported(),
    ready: access != null,
    error,
    inputs,
    portId,
    learning,
    lastTargetId,
    lastMap,
  }
}

function emit() {
  refreshSnap()
  for (const listener of listeners) listener()
}

function listInputs(): MidiInputInfo[] {
  if (!access) return []
  return [...access.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name || input.id,
  }))
}

function attachInputs() {
  if (!access) return
  for (const input of access.inputs.values()) {
    input.onmidimessage = onMidiMessage
  }
}

function scaleCc(value: number, target: Target): number {
  const t = Math.min(127, Math.max(0, value)) / 127
  const raw = target.min + t * (target.max - target.min)
  const step = target.step || 0
  if (step <= 0) return raw
  const snapped = Math.round(raw / step) * step
  return Math.min(target.max, Math.max(target.min, snapped))
}

function onMidiMessage(event: MIDIMessageEvent) {
  const data = event.data
  if (!data || data.length < 3) return
  const status = data[0]!
  if ((status & 0xf0) !== 0xb0) return
  const source = event.target as MIDIInput | null
  const sourceId = source?.id ?? ''
  const channel = status & 0x0f
  const cc = data[1]!
  const value = data[2]!

  if (learning) {
    if (portId && sourceId && sourceId !== portId) return
    if (!lastTargetId) return
    maps = maps.filter((row) => row.targetId !== lastTargetId)
    maps = maps.filter((row) => !(row.portId === sourceId && row.channel === channel && row.cc === cc))
    lastMap = { portId: sourceId, channel, cc, targetId: lastTargetId }
    maps.push(lastMap)
    learning = false
    persist()
    const target = targets.get(lastTargetId)
    if (target) target.apply(scaleCc(value, target))
    emit()
    return
  }

  for (const row of maps) {
    if (row.channel !== channel || row.cc !== cc) continue
    if (row.portId && sourceId && row.portId !== sourceId) continue
    const target = targets.get(row.targetId)
    if (target) target.apply(scaleCc(value, target))
  }
}

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
}

export function midiSnapshot(): MidiSnap {
  return snap
}

export function subscribeMidi(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function registerCcTarget(
  id: string,
  spec: { min: number; max: number; step?: number; apply: (value: number) => void },
): () => void {
  targets.set(id, { min: spec.min, max: spec.max, step: spec.step ?? 0, apply: spec.apply })
  return () => {
    const current = targets.get(id)
    if (current?.apply === spec.apply) targets.delete(id)
  }
}

export function touchCcTarget(id: string) {
  lastTargetId = id
  emit()
}

export function setMidiPort(id: string | null) {
  portId = id
  persist()
  emit()
}

export function beginCcLearn(): boolean {
  if (!lastTargetId) {
    error = 'Click a fader first, then Learn CC.'
    emit()
    return false
  }
  error = null
  learning = true
  emit()
  void enableMidi()
  return true
}

export function cancelCcLearn() {
  if (!learning) return
  learning = false
  emit()
}

export function clearCcForTarget(id: string | null = lastTargetId) {
  if (!id) return
  maps = maps.filter((row) => row.targetId !== id)
  if (lastMap?.targetId === id) lastMap = null
  persist()
  emit()
}

export async function enableMidi(): Promise<boolean> {
  if (!midiSupported()) {
    error = 'This browser has no Web MIDI.'
    emit()
    return false
  }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
    error = null
    attachInputs()
    access.onstatechange = () => {
      attachInputs()
      emit()
    }
    const inputs = listInputs()
    if (portId && !inputs.some((input) => input.id === portId)) {
      portId = inputs[0]?.id ?? null
      persist()
    } else if (!portId) {
      portId = inputs[0]?.id ?? null
      persist()
    }
    emit()
    return true
  } catch {
    error = 'MIDI permission denied.'
    emit()
    return false
  }
}
