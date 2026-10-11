import { CHORD_TONES, KEYS, degreeLabels, inKey, matchingDegree, nameChord } from '../model/harmony.ts'

type ChordBoardProps = {
  songKey: string
  scale: 'major' | 'minor'
  root: string
  tones: number[]
  overwrite: boolean
  onRoot: (root: string) => void
  onToggle: (semi: number) => void
  onDegree: (degree: number) => void
  onOverwrite: (overwrite: boolean) => void
}

const CORE = CHORD_TONES.filter((tone) => tone.semi <= 11)
const COLOR = CHORD_TONES.filter((tone) => tone.semi > 11)

export function ChordBoard({
  songKey,
  scale,
  root,
  tones,
  overwrite,
  onRoot,
  onToggle,
  onDegree,
  onOverwrite,
}: ChordBoardProps) {
  const selected = [0, ...tones]
  const symbol = nameChord(root, selected)
  const activeDegree = matchingDegree(songKey, root, tones, scale)
  const degrees = degreeLabels(scale)
  const hint = overwrite
    ? 'Click a step to stamp this chord. Overwrite replaces notes under the brush.'
    : 'Click an empty step to stamp. Click a lit step to clear it.'

  return (
    <div className="chord-board" role="group" aria-label="Chord brush">
      <div className="chord-pick-group">
        <div className="chord-pick-row">
          <span>Degree</span>
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
        <div className="chord-pick-row">
          <span>Root</span>
          {KEYS.map((note) => {
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
        <div className="chord-pick-row">
          <span>Tones</span>
          {CORE.map((tone) => {
            const on = tone.semi === 0 || tones.includes(tone.semi)
            return (
              <button
                key={tone.label}
                type="button"
                className={on ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={on}
                aria-label={`Tone ${tone.label}`}
                onClick={() => {
                  if (tone.semi !== 0) onToggle(tone.semi)
                }}
              >
                {tone.label}
              </button>
            )
          })}
        </div>
        <div className="chord-pick-row">
          <span>Color</span>
          {COLOR.map((tone) => {
            const on = tones.includes(tone.semi)
            return (
              <button
                key={tone.label}
                type="button"
                className={on ? 'chord-key is-on' : 'chord-key'}
                aria-pressed={on}
                onClick={() => onToggle(tone.semi)}
              >
                {tone.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="chord-commit">
        <p className="chord-symbol" aria-live="polite">
          {symbol}
        </p>
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
