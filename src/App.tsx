import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Engine, type StereoLevel } from './audio/engine.ts'
import type { CueMode } from './audio/scheduler.ts'
import { degreeCount } from './model/harmony.ts'
import {
  addGroup,
  addPartInSong,
  familyFor,
  groupForFamily,
  createBlankProject,
  addTrack,
  placeGroup,
  placeTrack,
  removeGroup,
  removeInstrument,
  removePart,
  patternFor,
  recordStepIndex,
  renameGroup,
  renameInstrument,
  renameSection,
  renameSong,
  reorderPart,
  setAccentAmount,
  setAccentStep,
  setBassSound,
  setChordSound,
  setDegree,
  setEnvelope,
  setMaster,
  setMuted,
  setGroupMuted,
  setGroupSolo,
  setNext,
  setRepeat,
  setRollNotes,
  setSectionBpm,
  setSectionKey,
  setSectionBars,
  setSectionMeter,
  setProjectBpm,
  setProjectKey,
  setProjectMeter,
  adhereSection,
  setWave,
  setSolo,
  setSound,
  setStep,
  setStepPitch,
  updateRack,
  setSwing,
  slotEnabled,
  addInsert,
  removeInsert,
  toggleInsert,
  syncInsertToAllParts,
  syncMixToAllParts,
  addInsertToAllParts,
  copyBarTo,
  retuneInstrument,
  setGroupColor,
  setInstrumentColor,
  type CatalogId,
  type Envelope,
  type InsertId,
  type LoopBars,
  type Meter,
  type Wave,
  type Project,
  type SoundParams,
} from './model/project.ts'
import { createHistory } from './model/history.ts'
import { downloadProject, loadStoredProject, readProjectFile, saveStoredProject } from './model/storage.ts'
import { Editor } from './ui/Editor.tsx'
import { GroupList, type Selection } from './ui/InstrumentList.tsx'
import { SongMap } from './ui/SongMap.tsx'
import { DocsOverlay, type DocsPage } from './ui/DocsOverlay.tsx'
import { Brand, LevelMeter, Transport } from './ui/Transport.tsx'

type PlaybackView = {
  playing: boolean
  step: number
  position: number
  nodeId: string | null
  level: StereoLevel
  voices: Record<string, number>
  queuedNodeId: string | null
  cueMode: CueMode | null
}

const NUMPAD_GROUP: Record<string, number> = {
  Numpad1: 0,
  NumpadEnd: 0,
  Numpad2: 1,
  NumpadDown: 1,
  Numpad3: 2,
  NumpadPageDown: 2,
  Numpad4: 3,
  NumpadLeft: 3,
  Numpad5: 4,
  NumpadClear: 4,
  Numpad6: 5,
  NumpadRight: 5,
  Numpad7: 6,
  NumpadHome: 6,
  Numpad8: 7,
  NumpadUp: 7,
  Numpad9: 8,
  NumpadPageUp: 8,
  Numpad0: 9,
  NumpadInsert: 9,
}

const NUMPAD_SHIFT_KEYS = new Set(['End', 'Home', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Clear', 'Insert'])

const RECORD_KEYS = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
]

function recordTargets(project: Project, selection: Selection): string[] {
  if (selection.kind === 'instrument') return [selection.instrumentId]
  if (selection.kind === 'group') {
    return project.groups.find((group) => group.id === selection.groupId)?.instrumentIds ?? []
  }
  return project.instruments.map((item) => item.id)
}

export function App() {
  const [project, setProjectState] = useState<Project>(loadStoredProject)
  const historyRef = useRef(createHistory<Project>())
  const skipHistory = useRef(false)
  const [recording, setRecording] = useState(false)

  function setProject(action: Project | ((current: Project) => Project), kind = 'edit') {
    setProjectState((current) => {
      const next = typeof action === 'function' ? action(current) : action
      if (next === current) return current
      if (!skipHistory.current) historyRef.current.push(current, kind)
      skipHistory.current = false
      return next
    })
  }

  function undo() {
    setProjectState((current) => historyRef.current.undo(current) ?? current)
  }

  function redo() {
    setProjectState((current) => historyRef.current.redo(current) ?? current)
  }

  function replaceSong(next: Project) {
    historyRef.current.clear()
    setProjectState(next)
  }
  const [selection, setSelection] = useState<Selection>(
    project.groups[0] ? { kind: 'group', groupId: project.groups[0].id } : { kind: 'song' },
  )
  const [editNodeId, setEditNodeId] = useState(project.startNodeId)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ drums: true })
  const [songOpen, setSongOpen] = useState(true)
  const [tracksOpen, setTracksOpen] = useState(true)
  const [resetArmed, setResetArmed] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [docs, setDocs] = useState<DocsPage | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playback, setPlayback] = useState<PlaybackView>({ playing: false, step: -1, position: -1, nodeId: null, level: { left: 0, right: 0 }, voices: {}, queuedNodeId: null, cueMode: null })
  const [liveView, setLiveView] = useState(false)
  const [followLive, setFollowLive] = useState(true)
  const [namingSong, setNamingSong] = useState(false)
  const [songDraft, setSongDraft] = useState(project.name)
  const cancelSongName = useRef(false)
  const followLiveRef = useRef(true)
  const editNodeIdRef = useRef(editNodeId)
  const recordingRef = useRef(false)
  const selectionRef = useRef(selection)
  const sectionIdRef = useRef('')
  const projectRef = useRef(project)
  const heldPads = useRef(new Map<string, number>())
  const shiftHeld = useRef(false)
  const docsRef = useRef<DocsPage | null>(null)
  followLiveRef.current = followLive
  editNodeIdRef.current = editNodeId
  recordingRef.current = recording
  selectionRef.current = selection
  projectRef.current = project
  docsRef.current = docs
  if (!recording) heldPads.current.clear()
  const fileRef = useRef<HTMLInputElement>(null)
  const engineRef = useRef<Engine | null>(null)
  if (!engineRef.current) engineRef.current = new Engine(project)
  const engine = engineRef.current

  useEffect(() => {
    const heard = project.arrangement.find((node) => node.id === editNodeId)?.sectionId ?? project.sections[0]?.id
    engine.setProject(project, heard)
    saveStoredProject(project)
  }, [engine, project, editNodeId])

  useEffect(() => {
    if (import.meta.env.DEV) {
      const target = window as Window & { __daw?: Engine }
      target.__daw = engine
    }
    return () => engine.stop()
  }, [engine])

  useEffect(() => {
    let frame = 0
    let previous = ''
    const tick = () => {
      const next = engine.getPlayback()
      const voiceKey = Object.keys(next.voices)
        .sort()
        .map((id) => `${id}:${Math.round((next.voices[id] ?? 0) * 8)}`)
        .join(',')
      const key = `${next.playing}:${next.step}:${next.nodeId}:${next.queuedNodeId}:${next.cueMode}:${Math.round(next.level.left * 24)}:${Math.round(next.level.right * 24)}:${voiceKey}`
      if (next.playing || key !== previous) {
        previous = key
        setPlayback(next)
        if (followLiveRef.current && next.playing && next.nodeId && next.nodeId !== editNodeIdRef.current) {
          setEditNodeId(next.nodeId)
        }
      }
      recordHeldSteps()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [engine])

  useEffect(() => {
    if (!resetArmed && !fileOpen) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('.song-home')) {
        if (!target.closest('[data-testid="reset-confirm"]')) setResetArmed(false)
        return
      }
      setFileOpen(false)
      setResetArmed(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [resetArmed, fileOpen])

  const editNode = project.arrangement.find((node) => node.id === editNodeId) ?? project.arrangement[0]
  const sectionId = editNode?.sectionId ?? ''
  const section = project.sections.find((item) => item.id === sectionId)
  sectionIdRef.current = sectionId

  useEffect(() => {
    const typing = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement

    const padIndex = (code: string) => {
      const index = RECORD_KEYS.indexOf(code)
      return index
    }

    const getDigitOrNumpad = (event: KeyboardEvent) => {
      const match = event.code.match(/^(?:Digit|Numpad)([0-9])$/)
      if (!match) return -1
      const num = Number(match[1])
      return num === 0 ? 9 : num - 1
    }

    const shifted = (event: KeyboardEvent) =>
      event.shiftKey || event.getModifierState('Shift') || shiftHeld.current

    const numpadShifted = (event: KeyboardEvent) =>
      (event.code.startsWith('Numpad') && NUMPAD_SHIFT_KEYS.has(event.key)) ||
      (event.code in NUMPAD_GROUP && !/^Numpad[0-9]$/.test(event.code))

    const groupIndex = (event: KeyboardEvent) => {
      const mapped = NUMPAD_GROUP[event.code]
      if (!shifted(event) && !numpadShifted(event)) return -1
      if (mapped != null) return mapped
      const digit = event.code.match(/^Digit([0-9])$/)
      if (!digit) return -1
      const num = Number(digit[1])
      return num === 0 ? 9 : num - 1
    }

    const channelIndex = (event: KeyboardEvent) => {
      if (shifted(event) || numpadShifted(event)) return -1
      return getDigitOrNumpad(event)
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') shiftHeld.current = true
      if (docsRef.current) return
      if (typing(event)) return

      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyZ') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyY') {
        event.preventDefault()
        redo()
        return
      }

      if (event.code === 'KeyR' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        setRecording((value) => !value)
        return
      }

      const grouped = groupIndex(event)
      if (grouped >= 0 && !event.altKey) {
        const group = project.groups[grouped]
        if (group) {
          event.preventDefault()
          if (event.ctrlKey || event.metaKey) soloGroup(group.id)
          else muteGroup(group.id)
        }
        return
      }

      const index = channelIndex(event)
      if (index >= 0 && !event.altKey && !event.shiftKey) {
        if (event.ctrlKey || event.metaKey) {
          const instrument = project.instruments[index]
          if (instrument) {
            event.preventDefault()
            solo(instrument.id)
          }
          return
        }
        const instrument = project.instruments[index]
        if (instrument) {
          event.preventDefault()
          mute(instrument.id)
        }
        return
      }

      if (recordingRef.current && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        const pad = padIndex(event.code)
        if (pad >= 0) {
          const ids = recordTargets(project, selectionRef.current)
          const instrumentId = ids[pad]
          if (instrumentId) {
            event.preventDefault()
            if (!event.repeat) recordHold(instrumentId, true)
            return
          }
        }
      }

      if (event.code !== 'Space') return
      event.preventDefault()
      if (engine.getPlayback().playing) engine.stop()
      else {
        setFollowLive(true)
        engine.play()
      }
    }

    const onUp = (event: KeyboardEvent) => {
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') shiftHeld.current = false
      if (typing(event)) return
      const pad = padIndex(event.code)
      if (pad < 0) return
      const ids = recordTargets(projectRef.current, selectionRef.current)
      const instrumentId = ids[pad]
      if (instrumentId) recordHold(instrumentId, false)
    }

    const onBlur = () => {
      shiftHeld.current = false
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [engine, project, sectionId])

  useLayoutEffect(() => {
    if (!followLive || !playback.playing || !playback.nodeId) return
    if (playback.nodeId === editNodeId) return
    setEditNodeId(playback.nodeId)
  }, [followLive, playback.playing, playback.nodeId, editNodeId])

  function goLive() {
    setFollowLive(true)
    const nodeId = engine.getPlayback().nodeId
    if (nodeId) setEditNodeId(nodeId)
  }

  function paint(instrumentId: string, stepIndex: number, on: boolean) {
    setProject((current) => setStep(current, instrumentId, stepIndex, on, sectionId))
  }

  function nudge(instrumentId: string, stepIndex: number, delta: number) {
    setProject((current) => {
      const instrument = current.instruments.find((item) => item.id === instrumentId)
      const step = patternFor(current, instrumentId, sectionId)?.steps[stepIndex]
      if (!instrument || !step || instrument.voice.type === '808') return current
      const count = degreeCount(instrument.voice.type)
      const degree = (step.degree + delta + count) % count
      return setDegree(current, instrumentId, stepIndex, degree, sectionId)
    })
  }

  function mute(instrumentId: string) {
    setProject((current) => setMuted(current, instrumentId, slotEnabled(current, instrumentId, sectionIdRef.current), sectionIdRef.current))
  }

  function solo(instrumentId: string) {
    setProject((current) => {
      const id = sectionIdRef.current
      const currentSolo = current.sections.find((item) => item.id === id)?.slots[instrumentId]?.solo === true
      return setSolo(current, instrumentId, !currentSolo, id)
    })
  }

  function muteGroup(groupId: string) {
    setProject((current) => {
      const id = sectionIdRef.current
      const section = current.sections.find((item) => item.id === id)
      const enabled = section?.groupSlots?.[groupId]?.enabled !== false
      return setGroupMuted(current, groupId, enabled, id)
    })
  }

  function soloGroup(groupId: string) {
    setProject((current) => {
      const id = sectionIdRef.current
      const section = current.sections.find((item) => item.id === id)
      const currentSolo = section?.groupSlots?.[groupId]?.solo === true
      return setGroupSolo(current, groupId, !currentSolo, id)
    })
  }

  function recordHold(instrumentId: string, down: boolean) {
    if (down) {
      if (heldPads.current.has(instrumentId)) return
      heldPads.current.set(instrumentId, -1)
      engine.preview(instrumentId)
      recordHeldSteps()
      return
    }
    heldPads.current.delete(instrumentId)
  }

  function recordHeldSteps() {
    if (!recordingRef.current || heldPads.current.size === 0) return
    const heard = engine.getPlayback()
    if (!heard.playing) return
    const id = sectionIdRef.current
    const current = projectRef.current
    for (const [instrumentId, last] of heldPads.current) {
      const pattern = patternFor(current, instrumentId, id)
      const length = pattern?.steps.length ?? 16
      const position = heard.position >= 0 ? heard.position : heard.step
      const stepIndex = recordStepIndex(position, length)
      if (stepIndex < 0 || stepIndex === last) continue
      heldPads.current.set(instrumentId, stepIndex)
      if (last >= 0) engine.preview(instrumentId)
      setProject((next) => setStep(next, instrumentId, stepIndex, true, id), 'record')
    }
  }

  function createGroup(name: string) {
    let groupId = ''
    setProject((current) => {
      const added = addGroup(current, name)
      groupId = added.groupId
      return added.project
    })
    setSelection({ kind: 'group', groupId })
    setOpenGroups((current) => ({ ...current, [groupId]: true }))
  }

  function createTrack(groupId: string | null, catalog: CatalogId) {
    let instrumentId = ''
    setProject((current) => {
      let next = current
      let target = groupId
      if (!target) {
        const created = groupForFamily(next, familyFor(catalog))
        next = created.project
        target = created.groupId
      }
      const added = addTrack(next, target, catalog)
      if (!added) return current
      instrumentId = added.instrumentId
      return added.project
    })
    if (instrumentId) setSelection({ kind: 'instrument', instrumentId })
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const next = await readProjectFile(file)
      if (!next) {
        setLoadError('That file is not a version 1 song.')
        return
      }
      setLoadError(null)
      replaceSong(next)
      setSelection(next.groups[0] ? { kind: 'group', groupId: next.groups[0].id } : { kind: 'song' })
      setEditNodeId(next.startNodeId)
    } catch {
      setLoadError('That file is not a version 1 song.')
    }
  }

  return (
    <div className={['app', songOpen ? '' : 'is-song-closed', tracksOpen ? '' : 'is-tracks-closed'].filter(Boolean).join(' ')}>
      <header className="top">
        <div className="top-side">
          <button
            type="button"
            className={songOpen ? 'drawer-toggle is-on' : 'drawer-toggle'}
            data-testid="menu"
            aria-expanded={songOpen}
            aria-label={songOpen ? 'Hide song' : 'Show song'}
            onClick={() => setSongOpen((open) => !open)}
          >
            <span />
          </button>
          <div className="song-home">
            {namingSong ? (
              <input
                className="song-banner-input"
                value={songDraft}
                aria-label="Song name"
                autoFocus
                onChange={(event) => setSongDraft(event.target.value)}
                onBlur={(event) => {
                  const cancel = cancelSongName.current
                  cancelSongName.current = false
                  const value = event.currentTarget.value
                  setNamingSong(false)
                  if (!cancel) setProject((current) => renameSong(current, value))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur()
                  if (event.key === 'Escape') {
                    cancelSongName.current = true
                    setNamingSong(false)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="song-banner"
                data-testid="song-title"
                onClick={() => {
                  setFileOpen(false)
                  setSongDraft(project.name)
                  setNamingSong(true)
                }}
              >
                {project.name}
              </button>
            )}
            <button
              type="button"
              className="song-file"
              data-testid="file-menu"
              aria-expanded={fileOpen}
              aria-label="Song file"
              onClick={() => setFileOpen((open) => !open)}
            >
              ▾
            </button>
            {fileOpen ? (
              <div className="menu-pop" role="menu">
                <button
                  type="button"
                  data-testid="undo"
                  disabled={!historyRef.current.canUndo()}
                  onClick={() => {
                    setFileOpen(false)
                    undo()
                  }}
                >
                  Undo
                </button>
                <button
                  type="button"
                  data-testid="redo"
                  disabled={!historyRef.current.canRedo()}
                  onClick={() => {
                    setFileOpen(false)
                    redo()
                  }}
                >
                  Redo
                </button>
                <hr className="menu-line" />
                <button
                  type="button"
                  data-testid="load"
                  onClick={() => {
                    setFileOpen(false)
                    fileRef.current?.click()
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  data-testid="save"
                  onClick={() => {
                    setFileOpen(false)
                    downloadProject(project)
                  }}
                >
                  Save
                </button>
                <hr className="menu-line" />
                {resetArmed ? (
                  <button
                    type="button"
                    className="menu-danger"
                    data-testid="reset-confirm"
                    onClick={() => {
                      engine.stop()
                      const blank = createBlankProject()
                      replaceSong(blank)
                      setRecording(false)
                      setSelection({ kind: 'song' })
                      setEditNodeId(blank.startNodeId)
                      setOpenGroups({})
                      setLoadError(null)
                      setResetArmed(false)
                      setFileOpen(false)
                    }}
                  >
                    Start over
                  </button>
                ) : (
                  <button type="button" data-testid="reset" onClick={() => setResetArmed(true)}>
                    Reset
                  </button>
                )}
                <hr className="menu-line" />
                <button
                  type="button"
                  data-testid="help"
                  onClick={() => {
                    setFileOpen(false)
                    setResetArmed(false)
                    setDocs('help')
                  }}
                >
                  Help
                </button>
                <button
                  type="button"
                  data-testid="shortcuts"
                  onClick={() => {
                    setFileOpen(false)
                    setResetArmed(false)
                    setDocs('keys')
                  }}
                >
                  Shortcuts
                </button>
                <button
                  type="button"
                  data-testid="changelog"
                  onClick={() => {
                    setFileOpen(false)
                    setResetArmed(false)
                    setDocs('log')
                  }}
                >
                  Change log
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <Brand live={liveView} onLive={goLive} />
        <Transport
          playing={playback.playing}
          recording={recording}
          onRecord={() => setRecording((value) => !value)}
          onToggle={() => {
            if (engine.getPlayback().playing) engine.stop()
            else {
              setFollowLive(true)
              engine.play()
            }
          }}
          project={project}
          onBpm={(bpm) => setProject((current) => setProjectBpm(current, bpm), 'live:bpm')}
          onKey={(key) => setProject((current) => setProjectKey(current, key))}
          onMeter={(meter) => setProject((current) => setProjectMeter(current, meter))}
        />
        <div className="top-side is-end">
          <LevelMeter level={playback.level} />
          <button
            type="button"
            className={tracksOpen ? 'drawer-toggle is-on' : 'drawer-toggle'}
            data-testid="tracks-menu"
            aria-expanded={tracksOpen}
            aria-label={tracksOpen ? 'Hide tracks' : 'Show tracks'}
            onClick={() => setTracksOpen((open) => !open)}
          >
            <span />
          </button>
        </div>
      </header>
      <div className="body">
        <aside className="song-drawer">
          <SongMap
            project={project}
            activeNodeId={playback.playing ? playback.nodeId : null}
            queuedNodeId={playback.queuedNodeId}
            cueMode={playback.cueMode}
            editNodeId={editNode?.id ?? project.startNodeId}
            onSelect={(nodeId) => {
              setFollowLive(false)
              setEditNodeId(nodeId)
            }}
            onJump={(nodeId) => {
              setFollowLive(true)
              setEditNodeId(nodeId)
              engine.jump(nodeId)
            }}
            onRename={(sectionId, name) => setProject((current) => renameSection(current, sectionId, name))}
            onRepeat={(nodeId, repeat) => setProject((current) => setRepeat(current, nodeId, repeat))}
            onNext={(nodeId, nextId) => setProject((current) => setNext(current, nodeId, nextId))}
            onReorder={(nodeId, toIndex) => setProject((current) => reorderPart(current, nodeId, toIndex))}
            onDelete={(nodeId) => {
              setProject((current) => {
                const next = removePart(current, nodeId)
                if (!next.arrangement.some((node) => node.id === editNodeId)) setEditNodeId(next.startNodeId)
                return next
              })
            }}
            onAdd={() => {
              const added = addPartInSong(project, editNode?.id ?? project.startNodeId)
              setProject(added.project)
              setEditNodeId(added.nodeId)
            }}
            onBpm={(targetSectionId, bpm) => setProject((current) => setSectionBpm(current, targetSectionId, bpm))}
            onKey={(targetSectionId, key) => setProject((current) => setSectionKey(current, targetSectionId, key))}
            onMeter={(targetSectionId, meter: Meter) => setProject((current) => setSectionMeter(current, targetSectionId, meter))}
            onBars={(targetSectionId, bars: LoopBars) => setProject((current) => setSectionBars(current, targetSectionId, bars))}
            onAdhere={(targetSectionId) => setProject((current) => adhereSection(current, targetSectionId))}
          />
          {loadError ? (
            <footer className="drawer-foot">
              <p className="banner" role="alert">
                {loadError}
              </p>
            </footer>
          ) : null}
        </aside>
        <div className="stage">
          <Editor
          project={project}
          selection={selection}
          sectionId={sectionId}
          partName={section?.name ?? 'Part'}
          playing={playback.playing}
          activity={playback.voices}
          level={playback.level}
          playhead={playback.playing && playback.nodeId === editNode?.id ? playback.step : -1}
          motionAt={playback.playing && playback.nodeId === editNode?.id ? playback.position : -1}
          onPaint={paint}
          onNudge={nudge}
          onPitch={(instrumentId, stepIndex, pitch) => setProject((current) => setStepPitch(current, instrumentId, stepIndex, pitch, sectionId))}
          onTrackRack={(instrumentId, update) =>
            setProject((current) => {
              const updated = updateRack(current, sectionId, { kind: 'track', instrumentId }, update)
              return selection.kind === 'song' ? syncMixToAllParts(updated, sectionId, { kind: 'track', instrumentId }) : updated
            }, 'live:track-rack')
          }
          onGroupRack={(groupId, update) =>
            setProject((current) => {
              const updated = updateRack(current, sectionId, { kind: 'group', groupId }, update)
              return selection.kind === 'song' ? syncMixToAllParts(updated, sectionId, { kind: 'group', groupId }) : updated
            }, 'live:group-rack')
          }
          onSongRack={(update) =>
            setProject((current) => {
              const updated = updateRack(current, sectionId, { kind: 'song' }, update)
              return selection.kind === 'song' ? syncMixToAllParts(updated, sectionId, { kind: 'song' }) : updated
            }, 'live:song-rack')
          }
          onAccent={(stepIndex, on) => setProject((current) => setAccentStep(current, stepIndex, on, sectionId))}
          onSwing={(swing) => setProject((current) => setSwing(current, swing), 'live:swing')}
          onAccentAmount={(amount) => setProject((current) => setAccentAmount(current, amount), 'live:accent')}
          onMaster={(master) => setProject((current) => setMaster(current, master), 'live:master')}
          onSound={(instrumentId, key: keyof SoundParams, value) => setProject((current) => setSound(current, instrumentId, key, value), `live:sound:${instrumentId}:${key}`)}
          onBass={(instrumentId, key: 'cutoff' | 'decay' | 'glide', value) => setProject((current) => setBassSound(current, instrumentId, key, value), `live:bass:${instrumentId}:${key}`)}
          onChord={(instrumentId, key: 'cutoff' | 'decay', value) => setProject((current) => setChordSound(current, instrumentId, key, value), `live:chord:${instrumentId}:${key}`)}
          onWave={(instrumentId, wave: Wave) => setProject((current) => setWave(current, instrumentId, wave))}
          onEnvelope={(instrumentId, key: keyof Envelope, value) => setProject((current) => setEnvelope(current, instrumentId, key, value), `live:env:${instrumentId}:${key}`)}
          onAddInsert={(instrumentId, insert: InsertId) => setProject((current) => addInsert(current, instrumentId, insert))}
          onRemoveInsert={(instrumentId, insert: InsertId) => setProject((current) => removeInsert(current, instrumentId, insert))}
          onToggleInsert={(instrumentId, insert: InsertId) => setProject((current) => toggleInsert(current, instrumentId, insert))}
          onPreview={(instrumentId) => engine.preview(instrumentId)}
          onRecordHold={recordHold}
          recording={recording}
          onNotes={(instrumentId, notes) => setProject((current) => setRollNotes(current, instrumentId, notes, sectionId))}
          onSelectInstrument={(instrumentId) => setSelection({ kind: 'instrument', instrumentId })}
          onSelectGroup={(groupId) => setSelection({ kind: 'group', groupId })}
          onMute={mute}
          onSolo={solo}
          onMuteGroup={muteGroup}
          onSoloGroup={soloGroup}
          onSyncInsert={(scope, insert) => setProject((current) => syncInsertToAllParts(current, sectionId, scope, insert))}
          onSyncMix={(scope) => setProject((current) => syncMixToAllParts(current, sectionId, scope))}
          onAddInsertAll={(scope, insert) => setProject((current) => addInsertToAllParts(current, sectionId, scope, insert))}
          onCopyBar={(instrumentIds, fromBar, toBars, copyAccent) =>
            setProject((current) => copyBarTo(current, sectionId, fromBar, toBars, instrumentIds, copyAccent))
          }
          onLiveView={setLiveView}
          followLive={followLive}
          onFollowLive={setFollowLive}
          onPreviewCatalog={(catalog) => engine.previewCatalog(catalog)}
          onRetune={(instrumentId, catalog) =>
            setProject((current) => {
              const next = retuneInstrument(current, instrumentId, catalog)
              engine.setProject(next, sectionId)
              engine.preview(instrumentId)
              return next
            })
          }
        />
        </div>
        <aside className="instruments">
          <GroupList
            project={project}
            selection={selection}
            openGroups={openGroups}
            sectionId={sectionId}
            onToggleGroup={(groupId) => setOpenGroups((current) => ({ ...current, [groupId]: current[groupId] === false }))}
            onSelectSong={() => setSelection({ kind: 'song' })}
            onSelectGroup={(groupId) => setSelection({ kind: 'group', groupId })}
            onSelectInstrument={(instrumentId) => setSelection({ kind: 'instrument', instrumentId })}
            onPreview={(instrumentId) => engine.preview(instrumentId)}
            onRecordHold={recordHold}
            recording={recording}
            onMute={mute}
            onSolo={solo}
            onMuteGroup={muteGroup}
            onSoloGroup={soloGroup}
            onAddGroup={createGroup}
            onAddTrack={createTrack}
            onPreviewCatalog={(catalog) => engine.previewCatalog(catalog)}
            onRenameGroup={(groupId, name) => setProject((current) => renameGroup(current, groupId, name))}
            onRenameInstrument={(instrumentId, name) => setProject((current) => renameInstrument(current, instrumentId, name))}
            onPlace={(instrumentId, groupId, index) => setProject((current) => placeTrack(current, instrumentId, groupId, index))}
            onPlaceGroup={(groupId, index) => setProject((current) => placeGroup(current, groupId, index))}
            onDelete={(instrumentId) => {
              setProject((current) => removeInstrument(current, instrumentId))
              setSelection((current) => (current.kind === 'instrument' && current.instrumentId === instrumentId ? { kind: 'song' } : current))
            }}
            onDeleteGroup={(groupId) => {
              const members = project.groups.find((group) => group.id === groupId)?.instrumentIds ?? []
              setProject((current) => removeGroup(current, groupId))
              setSelection((current) => {
                if (current.kind === 'group' && current.groupId === groupId) return { kind: 'song' }
                if (current.kind === 'instrument' && members.includes(current.instrumentId)) return { kind: 'song' }
                return current
              })
            }}
            onColor={(instrumentId, color) => setProject((current) => setInstrumentColor(current, instrumentId, color))}
            onGroupColor={(groupId, color) => setProject((current) => setGroupColor(current, groupId, color))}
            playing={playback.playing}
            activity={playback.voices}
          />
        </aside>
      </div>
      <input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={onFile} />
      {docs ? <DocsOverlay page={docs} onClose={() => setDocs(null)} /> : null}
    </div>
  )
}
