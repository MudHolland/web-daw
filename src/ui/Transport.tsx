import { useEffect, useRef, useState } from 'react'
import type { StereoLevel } from '../audio/engine.ts'
import { KEYS } from '../model/harmony.ts'
import { METERS, type Meter, type Project } from '../model/project.ts'
import { Fader } from './Fader.tsx'

type TransportProps = {
  playing: boolean
  onToggle: () => void
  recording?: boolean
  onRecord?: () => void
  project: Project
  onBpm: (bpm: number) => void
  onKey: (key: string) => void
  onMeter: (meter: Meter) => void
}

function bpmFromTaps(times: number[]): number | null {
  if (times.length < 2) return null
  let total = 0
  for (let index = 1; index < times.length; index += 1) total += times[index]! - times[index - 1]!
  const bpm = Math.round(60000 / (total / (times.length - 1)))
  if (!Number.isFinite(bpm)) return null
  return Math.min(200, Math.max(40, bpm))
}

export function Transport({ playing, onToggle, recording = false, onRecord, project, onBpm, onKey, onMeter }: TransportProps) {
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const taps = useRef<number[]>([])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        toggleRef.current &&
        !toggleRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function tapTempo() {
    const now = performance.now()
    const previous = taps.current[taps.current.length - 1]
    if (previous != null && now - previous > 2000) taps.current = []
    taps.current.push(now)
    if (taps.current.length > 8) taps.current.shift()
    const bpm = bpmFromTaps(taps.current)
    if (bpm != null) onBpm(bpm)
  }

  return (
    <>
      {onRecord ? (
        <button
          type="button"
          className={['transport-record', recording ? 'is-on' : '', recording && playing ? 'is-live' : ''].filter(Boolean).join(' ')}
          data-testid="record"
          aria-pressed={recording}
          aria-label={recording ? 'Stop recording' : 'Record'}
          title={recording ? 'Recording — tap a track name or A–L to write the current step' : 'Arm record'}
          onClick={onRecord}
        >
          <span className="record-mark" aria-hidden="true" />
        </button>
      ) : null}

      <button
        type="button"
        className={playing ? 'transport-play is-on' : 'transport-play'}
        data-testid="play"
        aria-pressed={playing}
        aria-label={playing ? 'Stop' : 'Play'}
        onClick={onToggle}
      >
        <span className="play-mark" aria-hidden="true" />
      </button>

      <button
        ref={toggleRef}
        type="button"
        className={['transport-timing-btn', open ? 'is-open' : ''].filter(Boolean).join(' ')}
        data-testid="song-timing-toggle"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Song BPM, Key, and Meter"
        title="Song BPM, Key, and Meter"
        onClick={() => setOpen((prev) => !prev)}
      >
        <svg className="chevron-icon" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="transport-pop"
          data-testid="song-timing-popover"
          role="dialog"
          aria-label="Song BPM, Key, and Meter"
        >
          <div className="transport-pop-header">
            <span className="transport-pop-title">Song Master</span>
            <span className="transport-pop-badge">
              {project.bpm} · {project.key} · {project.meter}
            </span>
          </div>

          <div className="transport-pop-body">
            <label className="transport-pop-field transport-pop-bpm">
              <span className="transport-pop-label">BPM</span>
              <div className="transport-pop-fader-row">
                <Fader
                  min={40}
                  max={200}
                  step={1}
                  value={project.bpm}
                  reset={120}
                  testId="song-bpm"
                  onChange={onBpm}
                />
                <b className="transport-pop-value">{project.bpm}</b>
                <button
                  type="button"
                  className="transport-tap"
                  data-testid="tap-bpm"
                  aria-label="Tap tempo"
                  title="Tap along with the beat"
                  onClick={tapTempo}
                >
                  Tap
                </button>
              </div>
            </label>

            <div className="transport-pop-row">
              <label className="transport-pop-field">
                <span className="transport-pop-label">Key</span>
                <select
                  aria-label="Song Key"
                  data-testid="song-key"
                  className="transport-pop-select"
                  value={KEYS.includes(project.key as (typeof KEYS)[number]) ? project.key : 'C'}
                  onChange={(event) => onKey(event.target.value)}
                >
                  {KEYS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="transport-pop-field">
                <span className="transport-pop-label">Meter</span>
                <select
                  aria-label="Song Meter"
                  data-testid="song-meter"
                  className="transport-pop-select"
                  value={project.meter}
                  onChange={(event) => onMeter(event.target.value as Meter)}
                >
                  {METERS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="transport-pop-hint">
            Song parts adhere to this meter, key, and BPM unless customized.
          </div>
        </div>
      ) : null}
    </>
  )
}

export function LevelMeter({ level }: { level: StereoLevel }) {
  return (
    <div className="meter" data-testid="meter" aria-hidden="true">
      <MeterRow level={level.left} />
      <MeterRow level={level.right} />
    </div>
  )
}

function MeterRow({ level }: { level: number }) {
  const lit = Math.round(Math.min(1, level) * 16)
  return (
    <span className="meter-channel">
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} className={index < lit ? 'led is-lit' : 'led'} />
      ))}
    </span>
  )
}

export function Brand({ live, onLive }: { live: boolean; onLive: () => void }) {
  return (
    <div className="brand">
      <div className="wordmark">
        <span className="wordmark-kicker">Groove box</span>
        <strong>Beat Forge</strong>
        <span className="wordmark-version">VERSION 1.4</span>
      </div>
      <button
        type="button"
        className={live ? 'model-badge is-on' : 'model-badge'}
        data-testid="live"
        aria-pressed={live}
        aria-label={live ? 'Viewing playing bar' : 'Show playing bar'}
        onClick={onLive}
      >
        LIVE
      </button>
    </div>
  )
}
