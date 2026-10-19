import { CHORD_TONES, KEYS, degreeLabels, inKey, matchingDegree, nameChordWithBass } from '../model/harmony.ts'
import { beginPadHold } from './InstrumentList.tsx'

type ChordBoardProps = {
  songKey: string
  scale: 'major' | 'minor'
  root: string
  tones: number[]
  bass: number[]
  octave: number
  overwrite: boolean
  onRoot: (root: string) => void
  onToggle: (semi: number) => void
  onToggleBass: (semi: number) => void
  onDegree: (degree: number) => void
  onOctave: (octave: number) => void
  onOverwrite: (overwrite: boolean) => void
  onHear?: (down: boolean) => void
}

const CORE = CHORD_TONES.filter((tone) => tone.semi <= 11)
const COLOR = CHORD_TONES.filter((tone) => tone.semi > 11)
const QUIET_COLOR = new Set(['8', '10', '12', 'b14', '14'])

export function ChordBoard({
  songKey,
  scale,
  root,
  tones,
  bass,
  octave,
  overwrite,
  onRoot,
  onToggle,
  onToggleBass,
  onDegree,
  onOctave,
  onOverwrite,
  onHear,
}: ChordBoardProps) {
  const symbol = nameChordWithBass(root, tones, bass)
  const activeDegree = matchingDegree(songKey, root, tones, scale)
  const degrees = degreeLabels(scale)
  const origin = Math.max(0, KEYS.indexOf(root as (typeof KEYS)[number]))
  const roots = origin === 0 ? KEYS : [...KEYS.slice(origin), ...KEYS.slice(0, origin)]
  const hint = overwrite
    ? 'Click a step to stamp this chord. Overwrite replaces notes under the brush.'
    : 'Click an empty step to stamp. Click a lit step to clear it.'

  return (
    <div className="chord-board" role="group" aria-label="Chord brush">
      <div className="chord-pick-group">
        <div className="chord-pick-row">
          <span>Degree</span>
          <div className="chord-keys">
            {degrees.map((label, degree) => (
              <button
                key={label}
                type="button"
                className={activeDegree === degree ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={activeDegree === degree}
                aria-label={`Degree ${label}`}
                data-testid={`chord-degree-${degree}`}
                onClick={() => onDegree(degree)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="chord-pick-row">
          <span>Octave</span>
          <div className="chord-keys">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={octave === value ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={octave === value}
                aria-label={`Octave ${value}`}
                data-testid={`chord-octave-${value}`}
                onClick={() => onOctave(value)}
              >
                C{value}
              </button>
            ))}
          </div>
        </div>
        <div className="chord-pick-row">
          <span>Root</span>
          <div className="chord-keys">
            {roots.map((note) => {
              const scaleNote = inKey(songKey, note, scale)
              const on = root === note
              return (
                <button
                  key={note}
                  type="button"
                  className={['chord-key', on ? 'is-on' : '', scaleNote ? 'is-scale' : ''].filter(Boolean).join(' ')}
                  aria-pressed={on}
                  aria-label={`Root ${note}`}
                  onClick={() => onRoot(note)}
                >
                  {note}
                </button>
              )
            })}
          </div>
        </div>
        <div className="chord-pick-row">
          <span>Bass</span>
          <div className="chord-keys">
            {CORE.map((tone) => {
              const on = bass.includes(tone.semi)
              return (
                <button
                  key={`bass-${tone.label}`}
                  type="button"
                  className={on ? 'chord-key is-on' : 'chord-key'}
                  aria-pressed={on}
                  aria-label={`Bass ${tone.label}`}
                  onClick={() => onToggleBass(tone.semi)}
                >
                  {tone.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="chord-pick-row">
          <span>Tones</span>
          <div className="chord-keys">
            {CORE.map((tone) => {
              const on = tones.includes(tone.semi)
              return (
                <button
                  key={tone.label}
                  type="button"
                  className={on ? 'chord-key is-on' : 'chord-key'}
                  aria-pressed={on}
                  aria-label={`Tone ${tone.label}`}
                  onClick={() => onToggle(tone.semi)}
                >
                  {tone.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="chord-pick-row">
          <span>Color</span>
          <div className="chord-keys">
            {COLOR.map((tone) => {
              const on = tones.includes(tone.semi)
              const quiet = QUIET_COLOR.has(tone.label)
              return (
                <button
                  key={tone.label}
                  type="button"
                  className={['chord-key', on ? 'is-on' : '', quiet ? 'is-quiet' : ''].filter(Boolean).join(' ')}
                  aria-pressed={on}
                  aria-label={`Tone ${tone.label}`}
                  onClick={() => onToggle(tone.semi)}
                >
                  {tone.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="chord-commit">
        <div className="chord-symbol-row">
          <p className="chord-symbol" aria-live="polite">
            {symbol}
          </p>
          {onHear ? (
            <button
              type="button"
              className="editor-light chord-fire"
              data-testid="chord-fire"
              aria-label={`Play ${symbol}`}
              onPointerDown={(event) => beginPadHold(onHear, event)}
            />
          ) : null}
        </div>
        <div className="chord-modes">
          <div className="chord-mode-row" role="group" aria-label="Overwrite">
            <button
              type="button"
              className={overwrite ? 'is-on' : ''}
              data-testid="chord-overwrite"
              aria-pressed={overwrite}
              onClick={() => onOverwrite(!overwrite)}
            >
              Overwrite
            </button>
          </div>
        </div>
        <p className="chord-hint">{hint}</p>
      </div>
    </div>
  )
}
