import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Engine, type StereoLevel } from './audio/engine.ts'
import { degreeCount } from './model/harmony.ts'
import {
  addGroup,
  addPartInSong,
  familyFor,
  groupForFamily,
  createBlankProject,
  addTrack,
  placeTrack,
  removeInstrument,
  removePart,
  patternFor,
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
import { downloadProject, loadStoredProject, readProjectFile, saveStoredProject } from './model/storage.ts'
import { Editor } from './ui/Editor.tsx'
import { GroupList, type Selection } from './ui/InstrumentList.tsx'
import { SongMap } from './ui/SongMap.tsx'
import { Brand, LevelMeter, Transport } from './ui/Transport.tsx'

type PlaybackView = {
  playing: boolean
  step: number
  position: number
  nodeId: string | null
  level: StereoLevel
  voices: Record<string, number>
  queuedNodeId: string | null
}

export function App() {
  const [project, setProject] = useState<Project>(loadStoredProject)
  const [selection, setSelection] = useState<Selection>(
    project.groups[0] ? { kind: 'group', groupId: project.groups[0].id } : { kind: 'song' },
  )
  const [editNodeId, setEditNodeId] = useState(project.startNodeId)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ drums: true })
  const [songOpen, setSongOpen] = useState(true)
  const [tracksOpen, setTracksOpen] = useState(true)
  const [resetArmed, setResetArmed] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [playback, setPlayback] = useState<PlaybackView>({ playing: false, step: -1, position: -1, nodeId: null, level: { left: 0, right: 0 }, voices: {}, queuedNodeId: null })
  const [liveView, setLiveView] = useState(false)
  const [followLive, setFollowLive] = useState(true)
  const [namingSong, setNamingSong] = useState(false)
  const [songDraft, setSongDraft] = useState(project.name)
  const cancelSongName = useRef(false)
  const followLiveRef = useRef(true)
  const editNodeIdRef = useRef(editNodeId)
  followLiveRef.current = followLive
  editNodeIdRef.current = editNodeId
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
      const key = `${next.playing}:${next.step}:${next.nodeId}:${next.queuedNodeId}:${Math.round(next.level.left * 24)}:${Math.round(next.level.right * 24)}:${voiceKey}`
      if (next.playing || key !== previous) {
        previous = key
        setPlayback(next)
        if (followLiveRef.current && next.playing && next.nodeId && next.nodeId !== editNodeIdRef.current) {
          setEditNodeId(next.nodeId)
        }
      }
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

  useEffect(() => {
    const typing = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement

      const onKey = (event: KeyboardEvent) => {
        if (typing(event)) return
      
        if (selection.kind === 'song') {
          // Match zowel Numpad 0-9 als Digit 0-9
          const numpad = event.code.match(/^Numpad([0-9])$/)
          const digit = event.code.match(/^Digit([0-9])$/)
          const match = digit ?? numpad
      
          if (match) {
            // Bepaal de index (1 t/m 9 -> index 0-8, 0 -> index 9)
            const num = Number(match[1])
            const index = num === 0 ? 9 : num - 1
            const instrument = project.instruments[index]
      
            if (instrument) {
              // Ctrl + Nummer (of Cmd op macOS) = Solo
              if (event.ctrlKey || event.metaKey) {
                event.preventDefault()
                solo(instrument.id)
                return
              }
      
              // Gewoon Nummer (zonder modificatietoetsen) = Mute
              if (!event.shiftKey && !event.altKey) {
                event.preventDefault()
                mute(instrument.id)
                return
              }
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
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [engine, selection.kind, project.instruments, sectionId])

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
    setProject((current) => setMuted(current, instrumentId, slotEnabled(current, instrumentId, sectionId), sectionId))
  }

  function solo(instrumentId: string) {
    setProject((current) => {
      const currentSolo = current.sections.find((item) => item.id === sectionId)?.slots[instrumentId]?.solo === true
      return setSolo(current, instrumentId, !currentSolo, sectionId)
    })
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
      setProject(next)
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
                  data-testid="save"
                  onClick={() => {
                    setFileOpen(false)
                    downloadProject(project)
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  data-testid="load"
                  onClick={() => {
                    setFileOpen(false)
                    fileRef.current?.click()
                  }}
                >
                  Load
                </button>
                {resetArmed ? (
                  <button
                    type="button"
                    data-testid="reset-confirm"
                    onClick={() => {
                      engine.stop()
                      const blank = createBlankProject()
                      setProject(blank)
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
              </div>
            ) : null}
          </div>
        </div>
        <Brand live={liveView} onLive={goLive} />
        <Transport
          playing={playback.playing}
          onToggle={() => {
            if (engine.getPlayback().playing) engine.stop()
            else {
              setFollowLive(true)
              engine.play()
            }
          }}
          project={project}
          onBpm={(bpm) => setProject((current) => setProjectBpm(current, bpm))}
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
            })
          }
          onGroupRack={(groupId, update) =>
            setProject((current) => {
              const updated = updateRack(current, sectionId, { kind: 'group', groupId }, update)
              return selection.kind === 'song' ? syncMixToAllParts(updated, sectionId, { kind: 'group', groupId }) : updated
            })
          }
          onSongRack={(update) =>
            setProject((current) => {
              const updated = updateRack(current, sectionId, { kind: 'song' }, update)
              return selection.kind === 'song' ? syncMixToAllParts(updated, sectionId, { kind: 'song' }) : updated
            })
          }
          onAccent={(stepIndex, on) => setProject((current) => setAccentStep(current, stepIndex, on, sectionId))}
          onSwing={(swing) => setProject((current) => setSwing(current, swing))}
          onAccentAmount={(amount) => setProject((current) => setAccentAmount(current, amount))}
          onMaster={(master) => setProject((current) => setMaster(current, master))}
          onSound={(instrumentId, key: keyof SoundParams, value) => setProject((current) => setSound(current, instrumentId, key, value))}
          onBass={(instrumentId, key: 'cutoff' | 'decay' | 'glide', value) => setProject((current) => setBassSound(current, instrumentId, key, value))}
          onChord={(instrumentId, key: 'cutoff' | 'decay', value) => setProject((current) => setChordSound(current, instrumentId, key, value))}
          onWave={(instrumentId, wave: Wave) => setProject((current) => setWave(current, instrumentId, wave))}
          onEnvelope={(instrumentId, key: keyof Envelope, value) => setProject((current) => setEnvelope(current, instrumentId, key, value))}
          onAddInsert={(instrumentId, insert: InsertId) => setProject((current) => addInsert(current, instrumentId, insert))}
          onRemoveInsert={(instrumentId, insert: InsertId) => setProject((current) => removeInsert(current, instrumentId, insert))}
          onToggleInsert={(instrumentId, insert: InsertId) => setProject((current) => toggleInsert(current, instrumentId, insert))}
          onPreview={(instrumentId) => engine.preview(instrumentId)}
          onNotes={(instrumentId, notes) => setProject((current) => setRollNotes(current, instrumentId, notes, sectionId))}
          onSelectInstrument={(instrumentId) => setSelection({ kind: 'instrument', instrumentId })}
          onSelectGroup={(groupId) => setSelection({ kind: 'group', groupId })}
          onMute={mute}
          onSolo={solo}
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
            onMute={mute}
            onSolo={solo}
            onAddGroup={createGroup}
            onAddTrack={createTrack}
            onPreviewCatalog={(catalog) => engine.previewCatalog(catalog)}
            onRenameGroup={(groupId, name) => setProject((current) => renameGroup(current, groupId, name))}
            onRenameInstrument={(instrumentId, name) => setProject((current) => renameInstrument(current, instrumentId, name))}
            onPlace={(instrumentId, groupId, index) => setProject((current) => placeTrack(current, instrumentId, groupId, index))}
            onDelete={(instrumentId) => {
              setProject((current) => removeInstrument(current, instrumentId))
              setSelection((current) => (current.kind === 'instrument' && current.instrumentId === instrumentId ? { kind: 'song' } : current))
            }}
            onColor={(instrumentId, color) => setProject((current) => setInstrumentColor(current, instrumentId, color))}
            playing={playback.playing}
            activity={playback.voices}
          />
        </aside>
      </div>
      <input ref={fileRef} className="file-input" type="file" accept="application/json,.json" onChange={onFile} />
    </div>
  )
}
