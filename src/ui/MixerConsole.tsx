import type { Project, Rack } from '../model/project.ts'
import { formatPan } from './ChannelStrip.tsx'
import { instrumentColor } from './drums.ts'
import { Fader } from './Fader.tsx'

type MixerConsoleProps = {
  project: Project
  sectionId: string
  partName: string
  activity: Record<string, number>
  level: { left: number; right: number }
  onSelectInstrument: (instrumentId: string) => void
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onTrackRack: (instrumentId: string, update: (rack: Rack) => Rack) => void
  onMaster: (master: number) => void
}

export function MixerConsole({
  project,
  sectionId,
  // partName,
  activity,
  level,
  onSelectInstrument,
  onMute,
  onSolo,
  onTrackRack,
  onMaster,
}: MixerConsoleProps) {
  const section = project.sections.find((item) => item.id === sectionId)

  return (
    <div className="mixer-console" data-testid="mixer-console">
      {/* <div className="mixer-console-banner">
        <div className="mixer-console-watermark">
          <span className="watermark-kicker">GROOVE BOX · BEAT FORGE LIVE</span>
          <strong className="watermark-title">STUDIO MIX CONSOLE</strong>
        </div>
        <div className="mixer-console-meta">
          <span className="console-part-badge">{partName}</span>
          <span className="console-channel-count">{project.instruments.length} TRACKS</span>
        </div>
      </div> */}

      <div className="mixer-console-strips">
        {project.instruments.map((instrument, index) => {
          const slot = section?.slots[instrument.id]
          const rack = slot?.rack ?? {
            level: instrument.mix.level,
            pan: instrument.mix.pan,
            eq: { ...instrument.mix.eq },
            fx: { ...instrument.fx },
            inserts: [...instrument.inserts],
            off: instrument.off ? [...instrument.off] : [],
          }
          const isMuted = slot ? !slot.enabled : false
          const isSoloed = slot?.solo === true
          const color = instrumentColor(instrument)
          const voiceLevel = activity[instrument.id] ?? 0
          const chNum = String(index + 1).padStart(2, '0')
          const voiceBadge =
            instrument.voice.type === '808'
              ? '808'
              : instrument.voice.type === 'bass'
                ? 'BASS'
                : instrument.voice.type === 'lead'
                  ? 'LEAD'
                  : 'CHORD'

          return (
            <div
              key={instrument.id}
              className={['console-strip', isMuted ? 'is-muted' : '', isSoloed ? 'is-soloed' : ''].filter(Boolean).join(' ')}
              style={{ '--voice': color } as React.CSSProperties}
              data-testid={`console-strip-${instrument.id}`}
            >
              <div className="console-strip-color" style={{ background: color }} />

              <div className="console-strip-head">
                <span className="console-strip-ch">CH {chNum}</span>
                <button
                  type="button"
                  className="console-strip-name"
                  title={`Open ${instrument.name} in editor`}
                  onClick={() => onSelectInstrument(instrument.id)}
                >
                  {instrument.name}
                </button>
                <span className="console-strip-badge">{voiceBadge}</span>
              </div>

              <div className="console-strip-actions">
                <button
                  type="button"
                  className={['console-btn', 'console-btn-mute', isMuted ? 'is-active' : ''].filter(Boolean).join(' ')}
                  aria-pressed={isMuted}
                  title={isMuted ? `Unmute ${instrument.name}` : `Mute ${instrument.name}`}
                  onClick={() => onMute(instrument.id)}
                >
                  M
                </button>
                <button
                  type="button"
                  className={['console-btn', 'console-btn-solo', isSoloed ? 'is-active' : ''].filter(Boolean).join(' ')}
                  aria-pressed={isSoloed}
                  title={isSoloed ? `Unsolo ${instrument.name}` : `Solo ${instrument.name}`}
                  onClick={() => onSolo(instrument.id)}
                >
                  S
                </button>
              </div>

              <div className="console-strip-fader-area">
                <div className="console-channel-meter" aria-hidden="true">
                  <ConsoleLedColumn level={voiceLevel} />
                </div>

                <div className="console-fader-column">
                  <span className="console-val">{Math.round(rack.level * 100)}</span>
                  <Fader
                    vertical
                    min={0}
                    max={1}
                    step={0.01}
                    value={rack.level}
                    reset={0.9}
                    testId={`console-level-${instrument.id}`}
                    onChange={(val) => onTrackRack(instrument.id, (r) => ({ ...r, level: val }))}
                  />
                  <span className="console-unit">VOL</span>
                </div>
              </div>

              <div className="console-strip-pan">
                <span className="console-pan-val">{formatPan(rack.pan)}</span>
                <Fader
                  min={-1}
                  max={1}
                  step={0.01}
                  value={rack.pan}
                  reset={0}
                  testId={`console-pan-${instrument.id}`}
                  onChange={(val) => onTrackRack(instrument.id, (r) => ({ ...r, pan: val }))}
                />
                <span className="console-unit">PAN</span>
              </div>

              <div className="console-strip-inserts">
                {rack.inserts.length > 0 ? (
                  rack.inserts.map((ins) => (
                    <span
                      key={ins}
                      className={['console-fx-tag', rack.off?.includes(ins) ? 'is-off' : ''].filter(Boolean).join(' ')}
                      title={ins}
                    >
                      {ins.slice(0, 3)}
                    </span>
                  ))
                ) : (
                  <span className="console-fx-empty">—</span>
                )}
              </div>
            </div>
          )
        })}

        <div className="console-strip console-strip-master">
          <div className="console-strip-color is-master" />

          <div className="console-strip-head">
            <span className="console-strip-ch">OUT</span>
            <span className="console-strip-name is-static">MASTER</span>
            <span className="console-strip-badge">BUS</span>
          </div>

          <div className="console-strip-actions is-placeholder" aria-hidden="true">
            <span className="console-master-label">STEREO</span>
          </div>

          <div className="console-strip-fader-area">
            <div className="console-stereo-meter" aria-hidden="true">
              <ConsoleLedColumn level={level.left} />
              <ConsoleLedColumn level={level.right} />
            </div>

            <div className="console-fader-column">
              <span className="console-val">{Math.round(project.master * 100)}</span>
              <Fader
                vertical
                min={0}
                max={1}
                step={0.01}
                value={project.master}
                reset={0.85}
                testId="console-master-level"
                onChange={onMaster}
              />
              <span className="console-unit">GAIN</span>
            </div>
          </div>

          <div className="console-strip-pan is-placeholder" aria-hidden="true">
            <span className="console-master-sub">MAIN L/R</span>
          </div>

          <div className="console-strip-inserts">
            <span className="console-master-status">100% CLEAN</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsoleLedColumn({ level }: { level: number }) {
  const lit = Math.round(Math.min(1, Math.max(0, level)) * 14)
  return (
    <span className="console-meter-bar">
      {Array.from({ length: 14 }, (_, i) => {
        const indexFromTop = 13 - i
        const isLit = indexFromTop < lit
        const isHot = indexFromTop >= 12
        const isWarm = indexFromTop >= 9 && indexFromTop < 12
        const cls = [
          'console-led',
          isLit ? 'is-lit' : '',
          isHot ? 'is-hot' : '',
          isWarm ? 'is-warm' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return <span key={i} className={cls} />
      })}
    </span>
  )
}
