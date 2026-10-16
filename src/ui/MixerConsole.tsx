import { applyRackAutomation, heardMasterMix } from '../model/automation.ts'
import { groupSlot, mixerNumbers, openRack, padMixerIndex, type Project, type Rack } from '../model/project.ts'
import { formatPan } from './ChannelStrip.tsx'
import { groupColor, instrumentColor } from './drums.ts'
import { Fader, GainFader, formatGainDb } from './Fader.tsx'

type MixerConsoleProps = {
  project: Project
  sectionId: string
  partName: string
  activity: Record<string, number>
  level: { left: number; right: number }
  onSelectInstrument: (instrumentId: string) => void
  onSelectGroup: (groupId: string) => void
  onMute: (instrumentId: string) => void
  onSolo: (instrumentId: string) => void
  onMuteGroup?: (groupId: string) => void
  onSoloGroup?: (groupId: string) => void
  recording?: boolean
  onRecordHold?: (instrumentId: string, down: boolean) => void
  onTrackRack: (instrumentId: string, update: (rack: Rack) => Rack) => void
  onGroupRack: (groupId: string, update: (rack: Rack) => Rack) => void
  onMaster: (master: number) => void
  onMasterPan: (pan: number) => void
  onPreview?: (instrumentId: string, down: boolean) => void
  motionAt?: number
}

export function MixerConsole({
  project,
  sectionId,
  activity,
  level,
  onSelectInstrument,
  onSelectGroup,
  onMute,
  onSolo,
  onMuteGroup,
  onSoloGroup,
  recording = false,
  onRecordHold,
  onTrackRack,
  onGroupRack,
  onMaster,
  onMasterPan,
  onPreview,
  motionAt = -1,
}: MixerConsoleProps) {
  const section = project.sections.find((item) => item.id === sectionId)
  const masterRack = motionAt >= 0 && section?.bus ? applyRackAutomation(section.bus, motionAt) : section?.bus
  const groove = heardMasterMix(project, section, motionAt)
  const grouped = new Set(project.groups.flatMap((group) => group.instrumentIds))
  const loose = project.instruments.filter((instrument) => !grouped.has(instrument.id))
  const numbers = mixerNumbers(project)

  function trackStrip(instrument: (typeof project.instruments)[number]) {
    const slot = section?.slots[instrument.id]
    const stored = slot?.rack ?? {
      level: instrument.mix.level,
      pan: instrument.mix.pan,
      eq: { ...instrument.mix.eq },
      fx: { ...instrument.fx },
      inserts: [...instrument.inserts],
      off: instrument.off ? [...instrument.off] : [],
    }
    const rack = motionAt >= 0 ? applyRackAutomation(stored, motionAt) : stored
    const isMuted = slot ? !slot.enabled : false
    const isSoloed = slot?.solo === true
    const color = instrumentColor(instrument)
    const chNum = padMixerIndex(numbers.channels.get(instrument.id) ?? 1)
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
            className={['console-strip-name', recording ? 'is-record' : ''].filter(Boolean).join(' ')}
            title={recording ? `Record ${instrument.name}` : `Open ${instrument.name} in editor`}
            onPointerDown={(event) => {
              if (!recording) return
              beginPadHold((down) => onRecordHold?.(instrument.id, down), event)
            }}
            onClick={() => {
              if (!recording) onSelectInstrument(instrument.id)
            }}
          >
            {instrument.name}
          </button>
          <button
            type="button"
            className="console-strip-badge console-strip-preview"
            title={recording ? `Record ${instrument.name}` : `Audition ${instrument.name}`}
            aria-label={recording ? `Record ${instrument.name}` : `Audition ${instrument.name}`}
            data-testid={`console-preview-${instrument.id}`}
            onPointerDown={(event) => {
              event.stopPropagation()
              if (recording) beginPadHold((down) => onRecordHold?.(instrument.id, down), event)
              else beginPadHold((down) => onPreview?.(instrument.id, down), event)
            }}
          >
            {voiceBadge}
          </button>
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
            <ConsoleLedColumn level={activity[instrument.id] ?? 0} />
          </div>
          <div className="console-fader-column">
            <span className="console-val">{formatGainDb(rack.level)}</span>
            <GainFader
              gain={rack.level}
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
        <InsertLights rack={rack} />
      </div>
    )
  }

  return (
    <div className="mixer-console" data-testid="mixer-console">
      <div className="mixer-console-strips">
        <div className="mixer-console-channels">
        {project.groups.map((group, index) => {
          const stored = section?.groups?.[group.id] ?? openRack(1)
          const rack = motionAt >= 0 ? applyRackAutomation(stored, motionAt) : stored
          const color = groupColor(group, project.instruments)
          const voiceLevel = activity[group.id] ?? Math.max(0, ...group.instrumentIds.map((id) => activity[id] ?? 0))
          const flags = groupSlot(section, group.id)
          const groupMuted = !flags.enabled
          const groupSoloed = flags.solo
          const grNum = padMixerIndex(numbers.groups.get(group.id) ?? index + 1)
          const members = group.instrumentIds
            .map((id) => project.instruments.find((item) => item.id === id))
            .filter((item): item is (typeof project.instruments)[number] => item != null)

          return (
            <div key={group.id} className="console-bay">
              <div
                className={['console-strip', 'console-strip-group', groupMuted ? 'is-muted' : '', groupSoloed ? 'is-soloed' : ''].filter(Boolean).join(' ')}
                style={{ '--voice': color } as React.CSSProperties}
                data-testid={`console-strip-group-${group.id}`}
              >
                <div className="console-strip-color" style={{ background: color }} />
                <div className="console-strip-head">
                  <span className="console-strip-ch">GR {grNum}</span>
                  <button
                    type="button"
                    className="console-strip-name"
                    title={`Open ${group.name} in editor`}
                    onClick={() => onSelectGroup(group.id)}
                  >
                    {group.name}
                  </button>
                  <span className="console-strip-badge">GRP</span>
                </div>
                <div className="console-strip-actions">
                  <button
                    type="button"
                    className={['console-btn', 'console-btn-mute', groupMuted ? 'is-active' : ''].filter(Boolean).join(' ')}
                    aria-pressed={groupMuted}
                    title={groupMuted ? `Unmute ${group.name}` : `Mute ${group.name}`}
                    data-testid={`console-mute-group-${group.id}`}
                    onClick={() => onMuteGroup?.(group.id)}
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={['console-btn', 'console-btn-solo', groupSoloed ? 'is-active' : ''].filter(Boolean).join(' ')}
                    aria-pressed={groupSoloed}
                    title={groupSoloed ? `Unsolo ${group.name}` : `Solo ${group.name}`}
                    data-testid={`console-solo-group-${group.id}`}
                    onClick={() => onSoloGroup?.(group.id)}
                  >
                    S
                  </button>
                </div>
                <div className="console-strip-fader-area">
                  <div className="console-channel-meter" aria-hidden="true">
                    <ConsoleLedColumn level={voiceLevel} />
                  </div>
                  <div className="console-fader-column">
                    <span className="console-val">{formatGainDb(rack.level)}</span>
                    <GainFader
                      gain={rack.level}
                      testId={`console-level-group-${group.id}`}
                      onChange={(val) => onGroupRack(group.id, (r) => ({ ...r, level: val }))}
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
                    testId={`console-pan-group-${group.id}`}
                    onChange={(val) => onGroupRack(group.id, (r) => ({ ...r, pan: val }))}
                  />
                  <span className="console-unit">PAN</span>
                </div>
                <InsertLights rack={rack} />
              </div>
              {members.map((instrument) => trackStrip(instrument))}
            </div>
          )
        })}
        {loose.length > 0 ? <div className="console-bay">{loose.map((instrument) => trackStrip(instrument))}</div> : null}
        </div>

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
              <span className="console-val">{formatGainDb(groove.master)}</span>
              <GainFader
                gain={groove.master}
                testId="console-master-level"
                onChange={onMaster}
              />
              <span className="console-unit">GAIN</span>
            </div>
          </div>

          <div className="console-strip-pan">
            <span className="console-pan-val">{formatPan(masterRack?.pan ?? 0)}</span>
            <Fader
              min={-1}
              max={1}
              step={0.01}
              value={masterRack?.pan ?? 0}
              reset={0}
              testId="console-master-pan"
              onChange={onMasterPan}
            />
            <span className="console-unit">PAN</span>
          </div>

          <InsertLights rack={masterRack} />
        </div>
      </div>
    </div>
  )
}

function InsertLights({ rack }: { rack?: { inserts: string[]; off?: string[] } }) {
  const inserts = rack?.inserts ?? []
  if (inserts.length === 0) return <div className="console-strip-inserts"><span className="console-fx-empty">—</span></div>
  return (
    <div className="console-strip-inserts">
      {inserts.map((ins) => (
        <span
          key={ins}
          className={['console-fx-tag', rack?.off?.includes(ins) ? 'is-off' : ''].filter(Boolean).join(' ')}
          title={ins}
        >
          {ins.slice(0, 3)}
        </span>
      ))}
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

function beginPadHold(hold: ((down: boolean) => void) | undefined, event: { button: number; preventDefault(): void }) {
  if (!hold || event.button !== 0) return
  event.preventDefault()
  hold(true)
  const up = () => {
    hold(false)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
