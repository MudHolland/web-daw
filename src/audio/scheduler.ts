import { lerpAutomation } from '../model/automation.ts'
import { liveInserts, loopSteps, rackFromInstrument, stepsForMeter, stutterBeats, type Project, type Rack, type Section } from '../model/project.ts'

export type PlaybackCursor = {
  nodeId: string
  cycle: number
  step: number
}

export type CueMode = 'repeat' | 'bar'

export const SCHEDULE_AHEAD_SECONDS = 0.1
export const TICK_MS = 25
export const MAX_STEPS_PER_TICK = 64

export function bpmFor(project: Project, nodeId: string): number {
  const node = project.arrangement.find((item) => item.id === nodeId)
  const section = node ? project.sections.find((item) => item.id === node.sectionId) : null
  return section?.bpm ?? project.bpm
}

export function stepDuration(bpm: number, swing: number, stepIndex: number): number {
  const base = 60 / Math.max(1, bpm) / 4
  const pair = base * 2
  const amount = Math.min(1, Math.max(0, swing))
  const first = pair * (0.5 + amount * 0.25)
  const second = pair - first
  return stepIndex % 2 === 0 ? first : second
}

export function sectionStepLength(project: Project, section: Section): number {
  for (const instrument of project.instruments) {
    const patternId = section.slots[instrument.id]?.patternId
    if (!patternId) continue
    const pattern = instrument.patterns.find((item) => item.id === patternId)
    if (pattern && pattern.steps.length > 0) return pattern.steps.length
  }
  return loopSteps(section.meter, section.bars)
}

export function advanceCursor(
  project: Project,
  cursor: PlaybackCursor,
  queuedNodeId: string | null = null,
  cueMode: CueMode = 'repeat',
): { cursor: PlaybackCursor; stopped: boolean; consumedQueue: boolean } {
  const node = project.arrangement.find((item) => item.id === cursor.nodeId)
  if (!node) return { cursor, stopped: true, consumedQueue: false }
  const section = project.sections.find((item) => item.id === node.sectionId)
  if (!section) return { cursor, stopped: true, consumedQueue: false }

  const length = sectionStepLength(project, section)
  const hold = repeatHoldSteps(project, section)
  if (hold != null) {
    const start = Math.floor(cursor.step / hold) * hold
    const end = Math.min(length, start + hold)
    const nextStep = cursor.step + 1
    if (nextStep < end) {
      return { cursor: { ...cursor, step: nextStep }, stopped: false, consumedQueue: false }
    }
    return { cursor: { ...cursor, step: start }, stopped: false, consumedQueue: false }
  }

  const nextStep = cursor.step + 1
  const barLength = Math.max(1, stepsForMeter(section.meter))
  const atBarEnd = nextStep >= length || nextStep % barLength === 0
  const atRepeatEnd = nextStep >= length
  const queued = queuedNodeId && project.arrangement.some((item) => item.id === queuedNodeId) ? queuedNodeId : null
  if (queued && queued !== cursor.nodeId) {
    const take = cueMode === 'bar' ? atBarEnd : atRepeatEnd
    if (take) {
      return { cursor: { nodeId: queued, cycle: 0, step: 0 }, stopped: false, consumedQueue: true }
    }
  }
  if (!atRepeatEnd) {
    return { cursor: { ...cursor, step: nextStep }, stopped: false, consumedQueue: false }
  }
  const alreadyThere = queued === cursor.nodeId

  const nextCycle = cursor.cycle + 1
  if (nextCycle < node.repeat) {
    return { cursor: { nodeId: cursor.nodeId, cycle: nextCycle, step: 0 }, stopped: false, consumedQueue: alreadyThere }
  }
  if (node.nextId == null) {
    return { cursor: { nodeId: cursor.nodeId, cycle: nextCycle, step: 0 }, stopped: true, consumedQueue: alreadyThere }
  }
  const following = project.arrangement.find((item) => item.id === node.nextId)
  if (!following) return { cursor, stopped: true, consumedQueue: alreadyThere }
  return { cursor: { nodeId: following.id, cycle: 0, step: 0 }, stopped: false, consumedQueue: alreadyThere }
}

/** While Repeat is on, loop this many steps instead of leaving the part. */
export function repeatHoldSteps(project: Project, section: Section): number | null {
  let beats = Number.POSITIVE_INFINITY
  const consider = (rack: Rack | undefined) => {
    if (!rack || !liveInserts(rack).includes('stutter')) return
    const slice = stutterBeats(rack.fx.stutter.rate)
    if (slice > 0) beats = Math.min(beats, slice)
  }
  consider(section.bus)
  for (const rack of Object.values(section.groups ?? {})) consider(rack)
  for (const instrument of project.instruments) {
    consider(section.slots[instrument.id]?.rack ?? rackFromInstrument(instrument))
  }
  if (!Number.isFinite(beats) || beats <= 0) return null
  const length = sectionStepLength(project, section)
  return Math.min(length, Math.max(1, Math.round(beats * 4)))
}

export type ScheduledStep = {
  time: number
  duration: number
  cursor: PlaybackCursor
}

/** Walk the arrangement only as far as the audio horizon, so a looping song cannot enqueue forever. */
export function takeSteps(
  project: Project,
  cursor: PlaybackCursor,
  nextNoteTime: number,
  horizon: number,
  queuedNodeId: string | null = null,
  cueMode: CueMode = 'repeat',
): {
  steps: ScheduledStep[]
  cursor: PlaybackCursor
  nextNoteTime: number
  stopped: boolean
  queuedNodeId: string | null
} {
  const steps: ScheduledStep[] = []
  let stopped = false
  let queue = queuedNodeId
  let guard = 0
  while (nextNoteTime < horizon && guard < MAX_STEPS_PER_TICK) {
    const duration = stepDuration(bpmFor(project, cursor.nodeId), swingFor(project, cursor), cursor.step)
    steps.push({ time: nextNoteTime, duration, cursor: { ...cursor } })
    const advanced = advanceCursor(project, cursor, queue, cueMode)
    cursor = advanced.cursor
    if (advanced.consumedQueue) queue = null
    nextNoteTime += duration
    guard += 1
    if (advanced.stopped) {
      stopped = true
      break
    }
  }
  return { steps, cursor, nextNoteTime, stopped, queuedNodeId: queue }
}

function swingFor(project: Project, cursor: PlaybackCursor): number {
  const node = project.arrangement.find((item) => item.id === cursor.nodeId)
  const section = node ? project.sections.find((item) => item.id === node.sectionId) : null
  return lerpAutomation(section?.bus?.automation?.['master.shuffle'], cursor.step, project.swing, 'master.shuffle')
}
