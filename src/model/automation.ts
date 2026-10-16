import { faderToGain, gainToFader, formatGainDb, clampGain } from './gain.ts'
import {
  DEFAULT_FX,
  STUTTER_RATES,
  SYNC_RATES,
  formatHz,
  fxHighCutHz,
  fxLowCutHz,
  liveInserts,
  openRack,
  rackFromInstrument,
  reverbSeconds,
  stutterIndex,
  syncIndex,
  syncRateKey,
  syncTimeKey,
  type FxSettings,
  type InsertId,
  type Project,
  type Rack,
  type Section,
} from './project.ts'

export type AutomationMap = Record<string, (number | null)[]>

export type AutomationTarget = {
  id: string
  label: string
  min: number
  max: number
  ticks?: number
  divider?: boolean
}

const FX_LABEL: Partial<Record<InsertId, string>> = {
  delay: 'Delay',
  echo: 'Echo',
  chorus: 'Chorus',
  flanger: 'Flanger',
  mover: 'Mover',
  tremolo: 'Tremolo',
  distortion: 'Distort',
  shifter: 'Shift',
  cutoff: 'Cutoff',
  reverb: 'Reverb',
  stutter: 'Repeat',
  glide: 'Glide',
}

const FX_INSERTS = Object.keys(FX_LABEL) as InsertId[]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function automationTargets(rack: Rack, options?: { hideLevel?: boolean }): AutomationTarget[] {
  const present = new Set(rack.inserts)
  const targets: AutomationTarget[] = []
  if (!options?.hideLevel) targets.push({ id: 'mix.level', label: 'Mix.level', min: 0, max: 1 })
  targets.push({ id: 'mix.pan', label: 'Mix.pan', min: -1, max: 1 })
  if (present.has('probability')) targets.push({ id: 'mix.probability', label: 'Chance', min: 0, max: 1 })
  if (present.has('eq')) {
    for (const band of ['low', 'mid', 'high'] as const) {
      targets.push({ id: `eq.${band}`, label: `EQ.${band}`, min: -24, max: 24 })
    }
  }
  for (const insert of FX_INSERTS) {
    if (!present.has(insert)) continue
    const settings = DEFAULT_FX[insert as keyof FxSettings] as Record<string, number>
    for (const key of Object.keys(settings)) {
      if (insert === 'shifter' && key === 'mix') continue
      const id = `fx.${insert}.${key}`
      const ticks =
        syncRateKey(insert as keyof FxSettings, key) || syncTimeKey(insert as keyof FxSettings, key)
          ? SYNC_RATES.length
          : insert === 'stutter' && key === 'rate'
            ? STUTTER_RATES.length
            : undefined
      targets.push({
        id,
        label: `${FX_LABEL[insert]}.${key}`,
        min: 0,
        max: 1,
        ticks,
      })
    }
  }
  return targets
}

export function readParam(rack: Rack, id: string): number {
  if (id === 'mix.level') return rack.level
  if (id === 'mix.pan') return rack.pan
  if (id === 'mix.probability') return rack.probability ?? 1
  if (id === 'eq.low') return rack.eq.low
  if (id === 'eq.mid') return rack.eq.mid
  if (id === 'eq.high') return rack.eq.high
  const fx = id.match(/^fx\.([^.]+)\.([^.]+)$/)
  if (fx) {
    const effect = fx[1] as keyof FxSettings
    const key = fx[2]
    const settings = rack.fx[effect] as Record<string, number> | undefined
    if (settings && key in settings) return settings[key] ?? 0
  }
  return 0
}

export function writeParam(rack: Rack, id: string, value: number): Rack {
  if (id === 'mix.level') return { ...rack, level: clampGain(value) }
  if (id === 'mix.pan') return { ...rack, pan: clamp(value, -1, 1) }
  if (id === 'mix.probability') return { ...rack, probability: clamp(value, 0, 1) }
  if (id === 'eq.low' || id === 'eq.mid' || id === 'eq.high') {
    const band = id.slice(3) as 'low' | 'mid' | 'high'
    return { ...rack, eq: { ...rack.eq, [band]: clamp(value, -24, 24) } }
  }
  const fx = id.match(/^fx\.([^.]+)\.([^.]+)$/)
  if (!fx) return rack
  const effect = fx[1] as keyof FxSettings
  const key = fx[2]
  const current = rack.fx[effect] as Record<string, number> | undefined
  if (!current || !(key in current)) return rack
  return {
    ...rack,
    fx: { ...rack.fx, [effect]: { ...current, [key]: clamp(value, 0, 1) } },
  }
}

export function sliderOf(id: string, stored: number): number {
  if (id === 'mix.level' || id === 'master.level' || id.endsWith('.level')) return gainToFader(stored)
  return stored
}

export function storeOf(id: string, slider: number): number {
  if (id === 'mix.level' || id === 'master.level' || id.endsWith('.level')) return faderToGain(slider)
  return slider
}

export function formatAutomation(id: string, stored: number): string {
  if (id === 'mix.level' || id === 'master.level' || id.endsWith('.level')) return formatGainDb(stored)
  if (id === 'master.shuffle' || id === 'master.accent') return String(Math.round(stored * 100))
  if (id === 'mix.probability' || id.endsWith('.probability')) return `${Math.round(stored * 100)}%`
  if (id === 'mix.pan' || id === 'master.pan' || id.endsWith('.pan')) {
    const rounded = Math.round(stored * 100)
    if (rounded === 0) return 'C'
    return rounded < 0 ? `L${Math.abs(rounded)}` : `R${rounded}`
  }
  if (id.startsWith('eq.')) {
    const rounded = Math.round(stored)
    return rounded > 0 ? `+${rounded}` : String(rounded)
  }
  const fx = id.match(/^fx\.([^.]+)\.([^.]+)$/)
  if (!fx) return String(Math.round(stored * 100))
  const effect = fx[1]
  const key = fx[2]
  if (effect === 'stutter' && key === 'rate') return STUTTER_RATES[stutterIndex(stored)]?.label ?? '1/8'
  if (effect === 'reverb' && key === 'size') return `${reverbSeconds(stored).toFixed(1)}s`
  if (syncRateKey(effect as keyof FxSettings, key) || syncTimeKey(effect as keyof FxSettings, key)) {
    return SYNC_RATES[syncIndex(stored)]?.label ?? '1/4'
  }
  if (key === 'semi') {
    const semis = Math.round((stored - 0.5) * 24)
    return semis > 0 ? `+${semis}` : String(semis)
  }
  if (effect === 'cutoff' && key === 'low') return stored <= 0.01 ? 'Open' : formatHz(fxLowCutHz(stored))
  if (effect === 'cutoff' && key === 'high') return stored >= 0.99 ? 'Open' : formatHz(fxHighCutHz(stored))
  return String(Math.round(stored * 100))
}

export function lerpAutomation(
  steps: (number | null)[] | undefined,
  position: number,
  fallback: number,
  id = 'mix.pan',
): number {
  if (!steps || steps.length === 0 || position < 0) return fallback
  const n = steps.length
  const locks: number[] = []
  for (let index = 0; index < n; index += 1) {
    const value = steps[index]
    if (value != null && Number.isFinite(value)) locks.push(index)
  }
  if (locks.length === 0) return fallback
  if (locks.length === 1) return steps[locks[0]!] ?? fallback
  const pos = ((position % n) + n) % n
  let prev = locks[locks.length - 1]!
  let next = locks[0]!
  for (const index of locks) {
    if (index <= pos) prev = index
    if (index > pos) {
      next = index
      break
    }
  }
  let span = next - prev
  let along = pos - prev
  if (span <= 0) {
    span += n
    if (along < 0) along += n
  }
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, along / span))
  const a = sliderOf(id, steps[prev]!)
  const b = sliderOf(id, steps[next]!)
  return storeOf(id, a + (b - a) * t)
}

export function heldAutomation(steps: (number | null)[] | undefined, index: number, fallback: number): number {
  return lerpAutomation(steps, index, fallback)
}

export function hasAutomation(steps: (number | null)[] | undefined): boolean {
  if (!steps || steps.length === 0) return false
  return steps.some((value) => value != null && Number.isFinite(value))
}

export function paramAvailable(rack: Rack, id: string): boolean {
  if (id === 'mix.level' || id === 'mix.pan') return true
  const inserts = new Set(liveInserts(rack))
  if (id === 'mix.probability') return inserts.has('probability')
  if (id.startsWith('eq.')) return inserts.has('eq')
  const fx = id.match(/^fx\.([^.]+)\./)
  if (fx) return inserts.has(fx[1] as InsertId)
  return false
}

export function applyRackAutomation(rack: Rack, stepIndex: number): Rack {
  const map = rack.automation
  if (!map || stepIndex < 0) return rack
  let next = rack
  for (const [id, steps] of Object.entries(map)) {
    if (id.startsWith('master.') || id.startsWith('track.')) continue
    if (!paramAvailable(rack, id)) continue
    next = writeParam(next, id, lerpAutomation(steps, stepIndex, readParam(rack, id), id))
  }
  return next
}

export function channelLabel(index: number): string {
  return `CH${String(index + 1).padStart(2, '0')}`
}

export function groupLabel(index: number): string {
  return `GR${String(index + 1).padStart(2, '0')}`
}

export function songAutomationTargets(project: Project, section?: Section): AutomationTarget[] {
  const targets: AutomationTarget[] = [
    { id: 'master.level', label: 'Master.level', min: 0, max: 1 },
    { id: 'master.pan', label: 'Master.pan', min: -1, max: 1 },
    { id: 'master.shuffle', label: 'Master.shuffle', min: 0, max: 1 },
    { id: 'master.accent', label: 'Master.accent', min: 0, max: 1 },
  ]
  const bus = section?.bus ?? openRack(1)
  for (const item of automationTargets(bus, { hideLevel: true })) {
    if (item.id === 'mix.pan' || item.id === 'mix.probability') continue
    targets.push(item)
  }
  if (project.groups.length > 0) targets.push({ id: 'div-groups', label: '', min: 0, max: 0, divider: true })
  project.groups.forEach((group) => {
    const name = group.name.trim() || 'Group'
    targets.push({ id: `group.${group.id}.level`, label: `${name}.level`, min: 0, max: 1 })
    targets.push({ id: `group.${group.id}.pan`, label: `${name}.pan`, min: -1, max: 1 })
    const groupRack = section?.groups?.[group.id]
    if (groupRack?.inserts.includes('probability')) {
      targets.push({ id: `group.${group.id}.probability`, label: `${name}.chance`, min: 0, max: 1 })
    }
  })
  if (project.instruments.length > 0) targets.push({ id: 'div-channels', label: '', min: 0, max: 0, divider: true })
  project.instruments.forEach((instrument) => {
    const name = instrument.name.trim() || 'Channel'
    targets.push({ id: `track.${instrument.id}.level`, label: `${name}.level`, min: 0, max: 1 })
    targets.push({ id: `track.${instrument.id}.pan`, label: `${name}.pan`, min: -1, max: 1 })
    const trackRack = section?.slots[instrument.id]?.rack ?? rackFromInstrument(instrument)
    if (trackRack.inserts.includes('probability')) {
      targets.push({ id: `track.${instrument.id}.probability`, label: `${name}.chance`, min: 0, max: 1 })
    }
  })
  return targets
}

function mixParamOf(field: string): string {
  if (field === 'level') return 'mix.level'
  if (field === 'pan') return 'mix.pan'
  return 'mix.probability'
}

export function songReadSteps(project: Project, section: Section | undefined, id: string): (number | null)[] {
  if (!section) return []
  const track = id.match(/^track\.([^.]+)\.(level|pan|probability)$/)
  if (track) {
    const instrument = project.instruments.find((item) => item.id === track[1])
    const rack = section.slots[track[1]]?.rack ?? (instrument ? rackFromInstrument(instrument) : openRack())
    return rack.automation?.[mixParamOf(track[2]!)] ?? []
  }
  const group = id.match(/^group\.([^.]+)\.(level|pan|probability)$/)
  if (group) {
    const rack = section.groups?.[group[1]] ?? openRack(1)
    return rack.automation?.[mixParamOf(group[2]!)] ?? []
  }
  if (id === 'master.pan') return section.bus?.automation?.['mix.pan'] ?? []
  return section.bus?.automation?.[id] ?? []
}

export function songReadBase(project: Project, section: Section | undefined, id: string): number {
  if (id === 'master.level') return project.master
  if (id === 'master.shuffle') return project.swing
  if (id === 'master.accent') return project.accentAmount
  if (!section) return 0
  if (id === 'master.pan') return section.bus?.pan ?? 0
  if (id.startsWith('eq.') || id.startsWith('fx.')) return readParam(section.bus ?? openRack(1), id)
  const track = id.match(/^track\.([^.]+)\.(level|pan|probability)$/)
  if (track) {
    const instrument = project.instruments.find((item) => item.id === track[1])
    const rack = section.slots[track[1]]?.rack ?? (instrument ? rackFromInstrument(instrument) : openRack())
    if (track[2] === 'level') return rack.level
    if (track[2] === 'pan') return rack.pan
    return rack.probability ?? 1
  }
  const group = id.match(/^group\.([^.]+)\.(level|pan|probability)$/)
  if (group) {
    const rack = section.groups?.[group[1]] ?? openRack(1)
    if (group[2] === 'level') return rack.level
    if (group[2] === 'pan') return rack.pan
    return rack.probability ?? 1
  }
  return 0
}

export function songWriteStep(
  _project: Project,
  _section: Section,
  id: string,
  index: number,
  stored: number | null,
  length: number,
  onTrack: (instrumentId: string, update: (rack: Rack) => Rack) => void,
  onBus: (update: (rack: Rack) => Rack) => void,
  onGroup: (groupId: string, update: (rack: Rack) => Rack) => void,
): void {
  const track = id.match(/^track\.([^.]+)\.(level|pan|probability)$/)
  if (track) {
    onTrack(track[1]!, (rack) => setAutomationStep(rack, mixParamOf(track[2]!), index, stored, length))
    return
  }
  const group = id.match(/^group\.([^.]+)\.(level|pan|probability)$/)
  if (group) {
    onGroup(group[1]!, (rack) => setAutomationStep(rack, mixParamOf(group[2]!), index, stored, length))
    return
  }
  const param = id === 'master.pan' ? 'mix.pan' : id
  onBus((rack) => setAutomationStep(rack, param, index, stored, length))
}

export function heardMasterMix(project: Project, section: Section | undefined, position: number) {
  if (!section || position < 0) {
    return { master: project.master, swing: project.swing, accentAmount: project.accentAmount }
  }
  const auto = section.bus?.automation
  return {
    master: lerpAutomation(auto?.['master.level'], position, project.master, 'master.level'),
    swing: lerpAutomation(auto?.['master.shuffle'], position, project.swing, 'master.shuffle'),
    accentAmount: lerpAutomation(auto?.['master.accent'], position, project.accentAmount, 'master.accent'),
  }
}

export function setAutomationStep(rack: Rack, id: string, index: number, value: number | null, length: number): Rack {
  const size = Math.max(1, length)
  const current = resizeList(rack.automation?.[id], size)
  const nextList = current.slice()
  if (index < 0 || index >= size) return rack
  nextList[index] = value
  const automation: AutomationMap = { ...(rack.automation ?? {}) }
  if (nextList.every((item) => item == null)) delete automation[id]
  else automation[id] = nextList
  return { ...rack, automation: Object.keys(automation).length > 0 ? automation : undefined }
}

function resizeList(steps: (number | null)[] | undefined, length: number): (number | null)[] {
  return Array.from({ length }, (_, index) => steps?.[index] ?? null)
}
