import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  DEFAULT_BASS,
  DEFAULT_CHORD,
  DEFAULT_ENVELOPE,
  DEFAULT_FX,
  DEFAULT_LEAD,
  DEFAULT_SOUND,
  STUTTER_RATES,
  SYNC_RATES,
  WAVES,
  bassCutoffHz,
  chordCutoffHz,
  formatHz,
  fxHighCutHz,
  fxLowCutHz,
  reverbSeconds,
  stutterIndex,
  stutterValue,
  syncIndex,
  syncRateKey,
  syncTimeKey,
  syncValue,
  type Envelope,
  type FxSettings,
  type InsertId,
  type Instrument,
  type SoundParams,
  type Wave,
} from '../model/project.ts'
import { instrumentColor } from './drums.ts'
import { Fader, GainFader, formatGainDb } from './Fader.tsx'

type ChannelStripProps = {
  instrument: Instrument
  layout: 'full' | 'compact'
  onLevel: (level: number) => void
  onPan: (pan: number) => void
  probability?: number
  onProbability?: (value: number) => void
  onEq: (band: 'low' | 'mid' | 'high', value: number) => void
  onSound: (key: keyof SoundParams, value: number) => void
  onBass: (key: 'cutoff' | 'decay' | 'glide', value: number) => void
  onChord: (key: 'cutoff' | 'decay', value: number) => void
  onWave: (wave: Wave) => void
  onFx: (effect: keyof FxSettings, key: string, value: number) => void
  onEnvelope: (key: keyof Envelope, value: number) => void
  onAddInsert: (insert: InsertId, allParts?: boolean) => void
  onRemoveInsert: (insert: InsertId) => void
  onToggleInsert: (insert: InsertId) => void
  onSyncInsert?: (insert: InsertId) => void
  onSyncMix?: () => void
  onPreview: () => void
  bus?: boolean
  collapsed?: boolean
  onToggleCollapsed?: () => void
  masterGroove?: {
    swing: number
    accentAmount: number
    master: number
    onSwing: (val: number) => void
    onAccentAmount: (val: number) => void
    onMaster: (val: number) => void
  }
}

const INSERTS: { id: InsertId; label: string }[] = [
  { id: 'probability', label: 'Chance' },
  { id: 'eq', label: 'EQ' },
  { id: 'adsr', label: 'ADSR' },
  { id: 'processing', label: 'Tone' },
  { id: 'cutoff', label: 'Cutoff' },
  { id: 'mover', label: 'Mover' },
  { id: 'tremolo', label: 'Tremolo' },
  { id: 'distortion', label: 'Distort' },
  { id: 'shifter', label: 'Shift' },
  { id: 'delay', label: 'Delay' },
  { id: 'echo', label: 'Echo' },
  { id: 'chorus', label: 'Chorus' },
  { id: 'flanger', label: 'Flanger' },
  { id: 'reverb', label: 'Reverb' },
  { id: 'tape', label: 'Tape Stop' },
  { id: 'stutter', label: 'Repeat' },
]

const VOICE_INSERTS = new Set<InsertId>(['adsr', 'processing'])

export function ChannelStrip({
  instrument,
  layout,
  onLevel,
  onPan,
  probability = 1,
  onProbability,
  onEq,
  onSound,
  onBass,
  onChord,
  onWave,
  onFx,
  onEnvelope,
  onAddInsert,
  onRemoveInsert,
  onToggleInsert,
  onSyncInsert,
  onSyncMix,
  onPreview,
  bus = false,
  collapsed = false,
  onToggleCollapsed,
  masterGroove,
}: ChannelStripProps) {
  const [addAll, setAddAll] = useState(false)
  const [syncedInsert, setSyncedInsert] = useState<InsertId | null>(null)
  const [syncedMix, setSyncedMix] = useState(false)
  const color = instrumentColor(instrument)
  const style = { '--voice': color, '--step-on': color } as CSSProperties
  const available = INSERTS.filter((item) => !instrument.inserts.includes(item.id) && !(bus && VOICE_INSERTS.has(item.id)))

  return (
    <article className={[layout === 'full' ? 'strip strip-full' : 'strip strip-compact', collapsed ? 'is-collapsed' : ''].filter(Boolean).join(' ')} style={style}>
      {layout === 'full' && onToggleCollapsed ? (
        <button
          type="button"
          className="strip-fold"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Show effects' : 'Minimize effects'}
          onClick={onToggleCollapsed}
        >
          <span>Effects</span>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.2 4.2 L6 8 L9.8 4.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      ) : null}
      {collapsed ? null : (
        <>
      {layout === 'compact' ? (
        <header className="strip-head">
          <button type="button" className="pad" style={{ background: color }} aria-label={`Play ${instrument.name}`} onClick={onPreview} />
          <h3>{instrument.name}</h3>
        </header>
      ) : null}
      <div className="mixer">
        {masterGroove ? (
          <section className="fader-bank" data-testid="master-groove-bank">
            <header className="bank-name">
              <h4>Master</h4>
            </header>
            <div className="bank-faders">
              <Knob label="Shuffle" valueLabel={String(Math.round(masterGroove.swing * 100))}>
                <Fader
                  vertical
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(masterGroove.swing * 100)}
                  reset={0}
                  testId="shuffle"
                  onChange={(val) => masterGroove.onSwing(val / 100)}
                />
              </Knob>
              <Knob label="Accent" valueLabel={String(Math.round(masterGroove.accentAmount * 100))}>
                <Fader
                  vertical
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(masterGroove.accentAmount * 100)}
                  reset={70}
                  testId="accent-amount"
                  onChange={(val) => masterGroove.onAccentAmount(val / 100)}
                />
              </Knob>
              <Knob label="Level" valueLabel={formatGainDb(masterGroove.master)}>
                <GainFader gain={masterGroove.master} testId="master" onChange={masterGroove.onMaster} />
              </Knob>
              <Knob label="Pan" valueLabel={formatPan(instrument.mix.pan)}>
                <Fader vertical min={-1} max={1} step={0.01} value={instrument.mix.pan} reset={0} testId={`pan-${instrument.id}`} onChange={onPan} />
              </Knob>
            </div>
          </section>
        ) : (
        <section className="fader-bank">
          <header className="bank-name">
            <h4>Mix</h4>
            {onSyncMix ? (
              <button
                type="button"
                className={['fx-sync-btn', syncedMix ? 'is-synced' : ''].filter(Boolean).join(' ')}
                aria-label="Apply Level and Pan to all parts"
                title="Apply Level and Pan to all song parts"
                data-testid={`sync-mix-${instrument.id}`}
                onClick={() => {
                  onSyncMix()
                  setSyncedMix(true)
                  setTimeout(() => setSyncedMix(false), 1200)
                }}
              >
                <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 8h11M10 4.5l3.5 3.5L10 11.5" />
                </svg>
                <span>{syncedMix ? 'Synced' : 'All'}</span>
              </button>
            ) : null}
          </header>
          <div className="bank-faders">
            <Knob label="Level" valueLabel={formatGainDb(instrument.mix.level)}>
              <GainFader gain={instrument.mix.level} testId={`level-${instrument.id}`} onChange={onLevel} />
            </Knob>
            <Knob label="Pan" valueLabel={formatPan(instrument.mix.pan)}>
              <Fader vertical min={-1} max={1} step={0.01} value={instrument.mix.pan} reset={0} testId={`pan-${instrument.id}`} onChange={onPan} />
            </Knob>
          </div>
        </section>
        )}
        {instrument.inserts.map((insert) => {
          const live = !instrument.off?.includes(insert)
          const label = INSERTS.find((item) => item.id === insert)?.label ?? insert
          return (
          <section key={insert} className={live ? 'fader-bank' : 'fader-bank is-off'} data-testid={`insert-${insert}-${instrument.id}`}>
            <header className="bank-name">
              <button
                type="button"
                className={live ? 'fx-light is-on' : 'fx-light'}
                aria-pressed={live}
                aria-label={live ? `Turn ${label} off` : `Turn ${label} on`}
                data-testid={`light-${insert}-${instrument.id}`}
                onClick={() => onToggleInsert(insert)}
              />
              <h4>{label}</h4>
              {onSyncInsert ? (
                <button
                  type="button"
                  className={['fx-sync-btn', syncedInsert === insert ? 'is-synced' : ''].filter(Boolean).join(' ')}
                  aria-label={`Apply ${label} settings to all parts`}
                  title="Apply this effect and its settings to all song parts"
                  data-testid={`sync-${insert}-${instrument.id}`}
                  onClick={() => {
                    onSyncInsert(insert)
                    setSyncedInsert(insert)
                    setTimeout(() => setSyncedInsert(null), 1200)
                  }}
                >
                  <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 8h11M10 4.5l3.5 3.5L10 11.5" />
                  </svg>
                  <span>{syncedInsert === insert ? 'Synced' : 'All'}</span>
                </button>
              ) : null}
              <button type="button" aria-label={`Remove ${insert}`} onClick={() => onRemoveInsert(insert)}>
                ×
              </button>
            </header>
            <div className="bank-faders">
              {insert === 'eq'
                ? (['low', 'mid', 'high'] as const).map((band) => (
                    <Knob key={band} label={band} valueLabel={formatDb(instrument.mix.eq[band])}>
                      <Fader
                        vertical
                        min={-24}
                        max={24}
                        step={1}
                        value={instrument.mix.eq[band]}
                        reset={0}
                        testId={`eq-${band}-${instrument.id}`}
                        onChange={(value) => onEq(band, value)}
                      />
                    </Knob>
                  ))
                : null}
              {insert === 'adsr'
                ? (['attack', 'decay', 'sustain', 'release'] as const).map((key) => (
                    <Knob key={key} label={key.slice(0, 3)} valueLabel={String(Math.round(instrument.envelope[key] * 100))}>
                      <Fader
                        vertical
                        min={0}
                        max={1}
                        step={0.01}
                        value={instrument.envelope[key]}
                        reset={DEFAULT_ENVELOPE[key]}
                        testId={`${key}-${instrument.id}`}
                        onChange={(value) => onEnvelope(key, value)}
                      />
                    </Knob>
                  ))
                : null}
              {insert === 'processing' ? (
                <Processing instrument={instrument} onSound={onSound} onBass={onBass} onChord={onChord} onWave={onWave} />
              ) : null}
              {insert === 'probability' && onProbability ? (
                <Knob label="Chance" valueLabel={`${Math.round(probability * 100)}%`}>
                  <Fader
                    vertical
                    min={0}
                    max={1}
                    step={0.01}
                    value={probability}
                    reset={1}
                    testId={`probability-${instrument.id}`}
                    onChange={onProbability}
                  />
                </Knob>
              ) : null}
              {insert !== 'adsr' && insert !== 'processing' && insert !== 'eq' && insert !== 'probability' ? (
                <EffectKnobs instrument={instrument} effect={insert} onFx={onFx} />
              ) : null}
            </div>
          </section>
          )
        })}
        {available.length > 0 ? (
          <section className="fader-bank add-bank">
            <header className="bank-name">
              <h4>Add</h4>
              <button
                type="button"
                className={['add-scope-toggle', addAll ? 'is-all' : ''].filter(Boolean).join(' ')}
                aria-pressed={addAll}
                data-testid={`add-scope-${instrument.id}`}
                title={addAll ? 'New effects are added to ALL song parts' : 'New effects are added only to this part'}
                onClick={() => setAddAll((prev) => !prev)}
              >
                {addAll ? 'All parts' : 'This part'}
              </button>
            </header>
            <div className="add-plugins">
              {available.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`add-${option.id}`}
                  onClick={() => onAddInsert(option.id, addAll)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
        </>
      )}
    </article>
  )
}

function Processing({
  instrument,
  onSound,
  onBass,
  onChord,
  onWave,
}: {
  instrument: Instrument
  onSound: (key: keyof SoundParams, value: number) => void
  onBass: (key: 'cutoff' | 'decay' | 'glide', value: number) => void
  onChord: (key: 'cutoff' | 'decay', value: number) => void
  onWave: (wave: Wave) => void
}) {
  const sound = instrument.voice.type === '808' ? instrument.voice.sound : null
  const bass = instrument.voice.type === 'bass' || instrument.voice.type === 'lead' ? instrument.voice.sound : null
  const chord = instrument.voice.type === 'chord' ? instrument.voice.sound : null
  const wave = bass?.wave ?? chord?.wave
  return (
    <>
      {wave ? <WavePick wave={wave} onWave={onWave} /> : null}
      {sound ? (
        <>
          <Knob label="Tone" valueLabel={String(Math.round(sound.tone * 100))}>
            <Fader vertical min={0} max={1} step={0.01} value={sound.tone} reset={DEFAULT_SOUND.tone} testId={`tone-${instrument.id}`} onChange={(value) => onSound('tone', value)} />
          </Knob>
          <Knob label="Snap" valueLabel={String(Math.round(sound.snap * 100))}>
            <Fader vertical min={0} max={1} step={0.01} value={sound.snap} reset={DEFAULT_SOUND.snap} testId={`snap-${instrument.id}`} onChange={(value) => onSound('snap', value)} />
          </Knob>
        </>
      ) : null}
      {bass ? (
        <>
          <Knob label="Cutoff" valueLabel={formatHz(bassCutoffHz(bass.cutoff))}>
            <Fader vertical min={0} max={1} step={0.01} value={bass.cutoff} reset={(instrument.voice.type === 'lead' ? DEFAULT_LEAD : DEFAULT_BASS).cutoff} testId={`cutoff-${instrument.id}`} onChange={(value) => onBass('cutoff', value)} />
          </Knob>
          <Knob label="Decay" valueLabel={String(Math.round(bass.decay * 100))}>
            <Fader vertical min={0} max={1} step={0.01} value={bass.decay} reset={(instrument.voice.type === 'lead' ? DEFAULT_LEAD : DEFAULT_BASS).decay} testId={`decay-${instrument.id}`} onChange={(value) => onBass('decay', value)} />
          </Knob>
          <Knob label="Glide" valueLabel={String(Math.round(bass.glide * 100))}>
            <Fader vertical min={0} max={1} step={0.01} value={bass.glide} reset={(instrument.voice.type === 'lead' ? DEFAULT_LEAD : DEFAULT_BASS).glide} testId={`glide-${instrument.id}`} onChange={(value) => onBass('glide', value)} />
          </Knob>
        </>
      ) : null}
      {chord ? (
        <>
          <Knob label="Cutoff" valueLabel={formatHz(chordCutoffHz(chord.cutoff))}>
            <Fader vertical min={0} max={1} step={0.01} value={chord.cutoff} reset={DEFAULT_CHORD.cutoff} testId={`cutoff-${instrument.id}`} onChange={(value) => onChord('cutoff', value)} />
          </Knob>
          <Knob label="Decay" valueLabel={String(Math.round(chord.decay * 100))}>
            <Fader vertical min={0} max={1} step={0.01} value={chord.decay} reset={DEFAULT_CHORD.decay} testId={`decay-${instrument.id}`} onChange={(value) => onChord('decay', value)} />
          </Knob>
        </>
      ) : null}
    </>
  )
}

function WavePick({ wave, onWave }: { wave: Wave; onWave: (wave: Wave) => void }) {
  return (
    <div className="wave-pick" role="group" aria-label="Waveform">
      {WAVES.map((item) => (
        <button
          key={item}
          type="button"
          className={item === wave ? 'is-on' : ''}
          aria-pressed={item === wave}
          onClick={() => onWave(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}

function EffectKnobs({
  instrument,
  effect,
  onFx,
}: {
  instrument: Instrument
  effect: keyof FxSettings
  onFx: (effect: keyof FxSettings, key: string, value: number) => void
}) {
  const settings = instrument.fx[effect]
  const keys = Object.keys(settings) as (keyof typeof settings)[]
  return (
    <>
      {keys.map((key) => {
        if (effect === 'shifter' && key === 'mix') return null
        const steps = stepScale(effect, key)
        const home = DEFAULT_FX[effect][key]
        return (
          <Knob key={key} label={knobLabel(key)} valueLabel={formatFx(effect, key, settings[key])}>
            <Fader
              vertical
              min={0}
              max={steps ? steps.count - 1 : 1}
              step={steps ? 1 : 0.01}
              value={steps ? steps.index(settings[key]) : settings[key]}
              reset={steps ? steps.index(home) : home}
              split={key === 'mix'}
              testId={`${effect}-${key}-${instrument.id}`}
              onChange={(value) => onFx(effect, key, steps ? steps.value(value) : value)}
            />
          </Knob>
        )
      })}
    </>
  )
}

function stepScale(effect: keyof FxSettings, key: string) {
  if (syncRateKey(effect, key) || syncTimeKey(effect, key)) return { count: SYNC_RATES.length, index: syncIndex, value: syncValue }
  if (effect === 'stutter' && key === 'rate') return { count: STUTTER_RATES.length, index: stutterIndex, value: stutterValue }
  return null
}

function knobLabel(key: string): string {
  if (key === 'semi') return 'oct'
  return key
}

function formatFx(effect: string, key: string, value: number): string {
  if (effect === 'stutter' && key === 'rate') return STUTTER_RATES[stutterIndex(value)]?.label ?? '1/8'
  if (effect === 'reverb' && key === 'size') return `${reverbSeconds(value).toFixed(1)}s`
  if (syncRateKey(effect as keyof FxSettings, key) || syncTimeKey(effect as keyof FxSettings, key)) {
    return SYNC_RATES[syncIndex(value)]?.label ?? '1/4'
  }
  if (key === 'semi') {
    const semis = Math.round((value - 0.5) * 24)
    return semis > 0 ? `+${semis}` : String(semis)
  }
  if (effect === 'cutoff' && key === 'low') return value <= 0.01 ? 'Open' : formatHz(fxLowCutHz(value))
  if (effect === 'cutoff' && key === 'high') return value >= 0.99 ? 'Open' : formatHz(fxHighCutHz(value))
  return String(Math.round(value * 100))
}

function Knob({ label, valueLabel, children }: { label: string; valueLabel: string; children: ReactNode }) {
  return (
    <label className="vknob">
      <b>{valueLabel}</b>
      {children}
      <span>{label}</span>
    </label>
  )
}

function formatDb(value: number): string {
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}` : String(rounded)
}

export function formatPan(value: number): string {
  const rounded = Math.round(value * 100)
  if (rounded === 0) return 'C'
  return rounded < 0 ? `L${Math.abs(rounded)}` : `R${rounded}`
}
